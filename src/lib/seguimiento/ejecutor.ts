import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { describirHorarioCita } from "@/lib/calendario/disponibilidad";
import { asegurarConversacion, enviarYGuardar } from "@/lib/conversaciones/servicio";
import { cargarCanal, type Canal } from "@/lib/mensajeria/canal";
import { rellenarPlantilla } from "@/lib/mensajeria/config";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";
import { decidirSeguimiento, ES_RECORDATORIO, parametrosPlantilla, siguienteReintento, textoSeguimiento, type DatosMensaje } from "./reglas";

type Admin = SupabaseClient<Database>;
type Seguimiento = Database["public"]["Tables"]["seguimientos"]["Row"];
type Inmobiliaria = { nombre: string; zona_horaria: string; recordatorios_activos: boolean; reactivacion_activa: boolean };

export type Resumen = { procesados: number; enviados: number; cancelados: number; reintentos: number; fallidos: number };

/**
 * Procesa los seguimientos vencidos en lotes hasta agotar el presupuesto de
 * tiempo (el cron corre cada minuto; lo que no alcance, sale en la siguiente).
 */
export async function procesarSeguimientosPendientes(opciones: { presupuestoMs?: number; lote?: number } = {}): Promise<Resumen> {
  const admin = crearClienteAdmin();
  const inicio = Date.now();
  const presupuesto = opciones.presupuestoMs ?? 40_000;
  const resumen: Resumen = { procesados: 0, enviados: 0, cancelados: 0, reintentos: 0, fallidos: 0 };
  // Caché por corrida: muchas filas son de la misma inmobiliaria.
  const canales = new Map<string, Promise<Canal | null>>();
  const inmobiliarias = new Map<string, Promise<Inmobiliaria | null>>();

  while (Date.now() - inicio < presupuesto) {
    const { data: lote, error } = await admin.rpc("reclamar_seguimientos", { p_limite: opciones.lote ?? 20 });
    if (error) throw new Error(`No se pudieron reclamar seguimientos: ${error.message}`);
    if (!lote?.length) break;

    for (const s of lote) {
      resumen.procesados++;
      try {
        const r = await ejecutarUno(admin, s, canales, inmobiliarias);
        if (r === "enviado") resumen.enviados++;
        else resumen.cancelados++;
      } catch (e) {
        const mensaje = e instanceof Error ? e.message : String(e);
        const reintento = siguienteReintento(s.intentos, new Date());
        await admin
          .from("seguimientos")
          .update(
            reintento
              ? { estado: "pendiente", programado_para: reintento.toISOString(), ultimo_error: mensaje }
              : { estado: "fallido", ultimo_error: mensaje },
          )
          .eq("inmobiliaria_id", s.inmobiliaria_id)
          .eq("id", s.id);
        if (reintento) resumen.reintentos++;
        else resumen.fallidos++;
      }
    }
  }
  return resumen;
}

async function ejecutarUno(
  admin: Admin,
  s: Seguimiento,
  canales: Map<string, Promise<Canal | null>>,
  inmobiliarias: Map<string, Promise<Inmobiliaria | null>>,
): Promise<"enviado" | "cancelado"> {
  const inm = s.inmobiliaria_id;
  if (!canales.has(inm)) canales.set(inm, cargarCanal(admin, { inmobiliariaId: inm }));
  if (!inmobiliarias.has(inm)) {
    inmobiliarias.set(
      inm,
      Promise.resolve(
        admin.from("inmobiliarias").select("nombre, zona_horaria, recordatorios_activos, reactivacion_activa").eq("id", inm).single(),
      ).then((r) => r.data),
    );
  }

  const [canal, inmobiliaria, { data: lead }, { data: conversacion }, { data: cita }, { count: citasActivas }] = await Promise.all([
    canales.get(inm)!,
    inmobiliarias.get(inm)!,
    admin.from("leads").select("id, nombre, telefono, opt_out, score, estado").eq("inmobiliaria_id", inm).eq("id", s.lead_id).single(),
    admin.from("conversaciones").select("id, ia_activa, ultimo_entrante_en").eq("inmobiliaria_id", inm).eq("lead_id", s.lead_id).maybeSingle(),
    s.cita_id
      ? admin
          .from("citas")
          .select("estado, inicio, asesor:usuarios(nombre), propiedad:propiedades(titulo, direccion, colonia)")
          .eq("inmobiliaria_id", inm)
          .eq("id", s.cita_id)
          .maybeSingle()
      : Promise.resolve({ data: null }),
    admin
      .from("citas")
      .select("id", { count: "exact", head: true })
      .eq("inmobiliaria_id", inm)
      .eq("lead_id", s.lead_id)
      .in("estado", ["programada", "confirmada"])
      .gte("inicio", new Date().toISOString()),
  ]);
  if (!lead || !inmobiliaria) throw new Error("No se encontró el lead o la inmobiliaria");

  const recordatorio = ES_RECORDATORIO[s.tipo];
  const plantilla = (recordatorio ? canal?.config.plantilla_recordatorio : canal?.config.plantilla_reactivacion) ?? null;
  const decision = decidirSeguimiento({
    tipo: s.tipo,
    programadoPara: new Date(s.programado_para),
    ahora: new Date(),
    config: { recordatoriosActivos: inmobiliaria.recordatorios_activos, reactivacionActiva: inmobiliaria.reactivacion_activa },
    lead: { optOut: lead.opt_out, telefono: lead.telefono, score: lead.score, estado: lead.estado },
    conversacion: conversacion ? { iaActiva: conversacion.ia_activa, ultimoEntrante: conversacion.ultimo_entrante_en ? new Date(conversacion.ultimo_entrante_en) : null } : null,
    cita: cita ? { estado: cita.estado, inicio: new Date(cita.inicio) } : null,
    citasActivas: citasActivas ?? 0,
    canal: { conectado: Boolean(canal), plantilla },
  });

  if (decision.accion === "cancelar") {
    await admin
      .from("seguimientos")
      .update({ estado: "cancelado", ultimo_error: decision.motivo, ejecutado_en: new Date().toISOString() })
      .eq("inmobiliaria_id", inm)
      .eq("id", s.id);
    return "cancelado";
  }

  const zh = inmobiliaria.zona_horaria;
  const inicioCita = cita ? new Date(cita.inicio) : null;
  const datos: DatosMensaje = {
    nombre: lead.nombre,
    inmobiliaria: inmobiliaria.nombre,
    cuando: inicioCita ? describirHorarioCita(inicioCita, zh) : undefined,
    hora: inicioCita
      ? new Intl.DateTimeFormat("es-MX", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: zh }).format(inicioCita)
      : undefined,
    lugar: cita?.propiedad ? [cita.propiedad.direccion, cita.propiedad.colonia].filter(Boolean).join(", ") || cita.propiedad.titulo : null,
    asesor: cita?.asesor?.nombre ?? null,
  };

  const conv = conversacion ?? (await asegurarConversacion(admin, inm, lead.id));
  const parametros = parametrosPlantilla(s.tipo, datos);
  const textoAprobado = recordatorio ? canal!.config.texto_recordatorio : canal!.config.texto_reactivacion;
  const enviados = await enviarYGuardar(admin, canal!, {
    conversacionId: conv.id,
    leadId: lead.id,
    telefono: lead.telefono!,
    autor: "sistema",
    metadatos: { seguimiento: s.tipo, seguimiento_id: s.id },
    envio:
      decision.via === "texto"
        ? { tipo: "texto", texto: textoSeguimiento(s.tipo, datos) }
        : {
            tipo: "plantilla",
            plantilla: { nombre: plantilla!, idioma: canal!.config.idioma, parametros },
            textoVisible: textoAprobado ? rellenarPlantilla(textoAprobado, parametros) : textoSeguimiento(s.tipo, datos),
          },
  });
  if (!enviados) throw new Error("WhatsApp rechazó el mensaje (ver la conversación)");

  await admin.from("seguimientos").update({ estado: "enviado", ejecutado_en: new Date().toISOString(), ultimo_error: null }).eq("inmobiliaria_id", inm).eq("id", s.id);
  await admin.from("eventos_lead").insert({ inmobiliaria_id: inm, lead_id: lead.id, tipo: "seguimiento_enviado", datos: { tipo: s.tipo, via: decision.via } });
  return "enviado";
}
