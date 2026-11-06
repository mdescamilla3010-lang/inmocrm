import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { envPublico } from "@/lib/env";
import { ETIQUETA_SCORE } from "@/lib/leads/etiquetas";
import type { Database } from "@/lib/supabase/database.types";
import { formatearTelefono } from "@/lib/telefono";
import { cargarCalendarioAsesor, marcarCalendarioDesconectado } from "./cargar";
import { describirHorarioCita, esHorarioLibre, horariosLibres, type HorarioVisitas, type Intervalo } from "./disponibilidad";
import { ErrorCalendario } from "./tipos";

type Admin = SupabaseClient<Database>;

// Cliente admin: lo usan el agente y las acciones del panel (que antes
// verifican con RLS que el usuario puede tocar ese lead/cita).

export const DIAS_AGENDA = 14;

export type ConfigAgenda = {
  zonaHoraria: string;
  duracionMin: number;
  margenMin: number;
  anticipacionMin: number;
  horario: HorarioVisitas;
};

async function configAgenda(admin: Admin, inmobiliariaId: string): Promise<ConfigAgenda> {
  const { data, error } = await admin
    .from("inmobiliarias")
    .select("zona_horaria, duracion_cita_min, margen_traslado_min, anticipacion_min, horario_visitas")
    .eq("id", inmobiliariaId)
    .single();
  if (error || !data) throw new Error("No se encontró la inmobiliaria");
  return {
    zonaHoraria: data.zona_horaria,
    duracionMin: data.duracion_cita_min,
    margenMin: data.margen_traslado_min,
    anticipacionMin: data.anticipacion_min,
    horario: (data.horario_visitas ?? {}) as HorarioVisitas,
  };
}

export type Disponibilidad = {
  libres: Intervalo[];
  config: ConfigAgenda;
  /** google: se consultó su calendario; solo_citas: el asesor no ha conectado Google. */
  fuente: "google" | "solo_citas";
};

/**
 * Horarios libres de un asesor: horario de visitas − sus citas en InmoCRM −
 * lo ocupado en su Google Calendar. Si Google falla, lanza error: es mejor no
 * ofrecer horarios que empalmar una visita con su agenda personal.
 */
export async function disponibilidadAsesor(
  admin: Admin,
  inmobiliariaId: string,
  asesorId: string,
  ahora = new Date(),
): Promise<Disponibilidad> {
  const config = await configAgenda(admin, inmobiliariaId);
  const hasta = new Date(ahora.getTime() + (DIAS_AGENDA + 1) * 86_400_000);

  const { data: citas } = await admin
    .from("citas")
    .select("inicio, fin")
    .eq("inmobiliaria_id", inmobiliariaId)
    .eq("asesor_id", asesorId)
    .in("estado", ["programada", "confirmada"])
    .lt("inicio", hasta.toISOString())
    .gt("fin", ahora.toISOString());
  const ocupados: Intervalo[] = (citas ?? []).map((c) => ({ inicio: new Date(c.inicio), fin: new Date(c.fin) }));

  let fuente: Disponibilidad["fuente"] = "solo_citas";
  const calendario = await cargarCalendarioAsesor(admin, inmobiliariaId, asesorId);
  if (calendario) {
    try {
      ocupados.push(...(await calendario.proveedor.ocupados(ahora, hasta)));
      fuente = "google";
    } catch (e) {
      if (e instanceof ErrorCalendario && e.requiereReconectar) {
        await marcarCalendarioDesconectado(admin, inmobiliariaId, calendario.integracionId);
      }
      throw e;
    }
  }

  const libres = horariosLibres({ ...config, ocupados, ahora, dias: DIAS_AGENDA });
  return { libres, config, fuente };
}

export type ResultadoAgendar =
  | { ok: true; citaId: string; inicio: Date; fin: Date; texto: string; enGoogle: boolean; direccion: string | null }
  | { ok: false; motivo: "ocupado" | "sin_lead" | "error"; mensaje: string };

export async function agendarCita(
  admin: Admin,
  args: {
    inmobiliariaId: string;
    leadId: string;
    asesorId: string;
    inicio: Date;
    propiedadId: string | null;
    origen: "agente" | "asesor";
    notas?: string | null;
    /** El agente siempre valida contra la disponibilidad; un asesor puede agendar fuera del horario. */
    validarDisponibilidad: boolean;
  },
): Promise<ResultadoAgendar> {
  const config = await configAgenda(admin, args.inmobiliariaId);
  if (args.validarDisponibilidad) {
    const { libres } = await disponibilidadAsesor(admin, args.inmobiliariaId, args.asesorId);
    if (!esHorarioLibre(libres, args.inicio)) {
      return { ok: false, motivo: "ocupado", mensaje: "Ese horario ya no está disponible." };
    }
  }
  const fin = new Date(args.inicio.getTime() + config.duracionMin * 60_000);

  const [{ data: lead }, { data: propiedad }, { data: asesor }] = await Promise.all([
    admin.from("leads").select("id, nombre, telefono, email, score, score_motivo, estado").eq("inmobiliaria_id", args.inmobiliariaId).eq("id", args.leadId).maybeSingle(),
    args.propiedadId
      ? admin.from("propiedades").select("id, titulo, clave, direccion, colonia, municipio").eq("inmobiliaria_id", args.inmobiliariaId).eq("id", args.propiedadId).maybeSingle()
      : Promise.resolve({ data: null }),
    admin.from("usuarios").select("nombre").eq("inmobiliaria_id", args.inmobiliariaId).eq("id", args.asesorId).maybeSingle(),
  ]);
  if (!lead) return { ok: false, motivo: "sin_lead", mensaje: "No se encontró el lead." };

  const { data: cita, error } = await admin
    .from("citas")
    .insert({
      inmobiliaria_id: args.inmobiliariaId,
      lead_id: args.leadId,
      asesor_id: args.asesorId,
      propiedad_id: propiedad?.id ?? null,
      inicio: args.inicio.toISOString(),
      fin: fin.toISOString(),
      origen: args.origen,
      notas: args.notas ?? null,
    })
    .select("id")
    .single();
  // La restricción de la base impide empalmes aunque dos procesos agenden a la vez.
  if (error?.code === "23P01") return { ok: false, motivo: "ocupado", mensaje: "El asesor ya tiene una visita en ese horario." };
  if (error || !cita) return { ok: false, motivo: "error", mensaje: "No se pudo guardar la cita." };

  const direccion = propiedad ? [propiedad.direccion, propiedad.colonia, propiedad.municipio].filter(Boolean).join(", ") || null : null;

  let enGoogle = false;
  const calendario = await cargarCalendarioAsesor(admin, args.inmobiliariaId, args.asesorId);
  if (calendario) {
    try {
      const evento = await calendario.proveedor.crearEvento({
        inicio: args.inicio,
        fin,
        titulo: `Visita: ${lead.nombre ?? "prospecto"}${propiedad ? ` · ${propiedad.titulo}` : ""}`,
        descripcion: [
          `Prospecto: ${lead.nombre ?? "sin nombre"}`,
          lead.telefono ? `WhatsApp: ${formatearTelefono(lead.telefono)}` : null,
          lead.email ? `Correo: ${lead.email}` : null,
          lead.score ? `Score: ${ETIQUETA_SCORE[lead.score]}${lead.score_motivo ? ` — ${lead.score_motivo}` : ""}` : null,
          propiedad ? `Propiedad: ${propiedad.titulo}${propiedad.clave ? ` (${propiedad.clave})` : ""}` : null,
          args.origen === "agente" ? "Agendada por el agente de WhatsApp." : null,
          `Ver en InmoCRM: ${envPublico().NEXT_PUBLIC_APP_URL}/leads/${lead.id}`,
        ]
          .filter(Boolean)
          .join("\n"),
        ubicacion: direccion,
        zonaHoraria: config.zonaHoraria,
        citaId: cita.id,
      });
      await admin.from("citas").update({ google_event_id: evento.id }).eq("inmobiliaria_id", args.inmobiliariaId).eq("id", cita.id);
      enGoogle = true;
    } catch (e) {
      // La cita existe en InmoCRM aunque Google falle; el asesor la ve en el panel.
      console.error("[agenda] no se pudo crear el evento en Google", e);
    }
  }

  const cambios: Database["public"]["Tables"]["leads"]["Update"] = {};
  if (["nuevo", "en_conversacion", "calificado"].includes(lead.estado)) cambios.estado = "cita_agendada";
  if (propiedad) cambios.propiedad_interes_id = propiedad.id;
  if (Object.keys(cambios).length) await admin.from("leads").update(cambios).eq("inmobiliaria_id", args.inmobiliariaId).eq("id", lead.id);
  // La visita pendiente de confirmar quedó resuelta.
  await admin
    .from("conversaciones")
    .update({ requiere_atencion: false })
    .eq("inmobiliaria_id", args.inmobiliariaId)
    .eq("lead_id", lead.id)
    .eq("motivo_escalamiento", "visita");

  return {
    ok: true,
    citaId: cita.id,
    inicio: args.inicio,
    fin,
    texto: `${describirHorarioCita(args.inicio, config.zonaHoraria)} con ${asesor?.nombre ?? "tu asesor"}`,
    enGoogle,
    direccion,
  };
}

export async function cancelarCita(admin: Admin, args: { inmobiliariaId: string; citaId: string; motivo: string | null }) {
  const { data: cita } = await admin
    .from("citas")
    .update({ estado: "cancelada", motivo_cancelacion: args.motivo })
    .eq("inmobiliaria_id", args.inmobiliariaId)
    .eq("id", args.citaId)
    .in("estado", ["programada", "confirmada"])
    .select("id, lead_id, asesor_id, google_event_id")
    .maybeSingle();
  if (!cita) return false;

  if (cita.google_event_id) {
    const calendario = await cargarCalendarioAsesor(admin, args.inmobiliariaId, cita.asesor_id);
    await calendario?.proveedor.cancelarEvento(cita.google_event_id).catch((e) => console.error("[agenda] no se pudo borrar el evento", e));
  }

  // Si ya no le queda ninguna visita, el lead regresa a "calificado".
  const { count } = await admin
    .from("citas")
    .select("id", { count: "exact", head: true })
    .eq("inmobiliaria_id", args.inmobiliariaId)
    .eq("lead_id", cita.lead_id)
    .in("estado", ["programada", "confirmada"]);
  if (!count) {
    await admin
      .from("leads")
      .update({ estado: "calificado" })
      .eq("inmobiliaria_id", args.inmobiliariaId)
      .eq("id", cita.lead_id)
      .eq("estado", "cita_agendada");
  }
  return true;
}

/** Visitas próximas del lead, para el contexto del agente. */
export async function citasProximasDelLead(admin: Admin, inmobiliariaId: string, leadId: string, zonaHoraria: string) {
  const { data } = await admin
    .from("citas")
    .select("id, inicio, asesor:usuarios(nombre), propiedad:propiedades(titulo)")
    .eq("inmobiliaria_id", inmobiliariaId)
    .eq("lead_id", leadId)
    .in("estado", ["programada", "confirmada"])
    .gte("inicio", new Date().toISOString())
    .order("inicio");
  return (data ?? []).map(
    (c) =>
      `${describirHorarioCita(new Date(c.inicio), zonaHoraria)} con ${c.asesor?.nombre ?? "su asesor"}${
        c.propiedad ? ` para ver ${c.propiedad.titulo}` : ""
      } (cita_id ${c.id})`,
  );
}
