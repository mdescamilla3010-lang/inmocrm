import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { AccionesCita } from "@/components/citas/acciones-cita";
import { FormAgendar } from "@/components/citas/form-agendar";
import { Conversacion } from "@/components/leads/conversacion";
import { InsigniaEstado, InsigniaScore } from "@/components/leads/insignias";
import { cambiarEstadoCita, cancelarCitaPanel } from "@/app/(panel)/citas/acciones";
import { requerirUsuario } from "@/lib/auth/sesion";
import { disponibilidadAsesor } from "@/lib/calendario/agenda";
import { describirHorarioCita } from "@/lib/calendario/disponibilidad";
import { ETIQUETA_SEGUIMIENTO } from "@/lib/seguimiento/reglas";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { fechaIso, partesLocales } from "@/lib/calendario/zona-horaria";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { formatearFechaHora, formatearPesos, haceCuanto } from "@/lib/formato";
import { ETIQUETA_FUENTE } from "@/lib/leads/etiquetas";
import { describirEvento } from "@/lib/leads/eventos";
import { crearClienteServidor } from "@/lib/supabase/server";
import type { Database } from "@/lib/supabase/database.types";
import { formatearTelefono } from "@/lib/telefono";
import {
  agendarDesdePanel,
  agregarNota,
  cancelarSeguimiento,
  cambiarControlIA,
  cambiarEstado,
  enviarMensajeAsesor,
  guardarCalificacion,
  guardarContacto,
  marcarAtendido,
  reasignarLead,
} from "./acciones";
import { FormCalificacion, FormContacto, FormEstado, FormNota, FormReasignar } from "./formularios";

export const metadata: Metadata = { title: "Lead" };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PaginaLead({ params }: PageProps<"/leads/[id]">) {
  const { id } = await params;
  if (!UUID.test(id)) notFound();
  const usuario = await requerirUsuario();
  const esDueno = usuario.rol === "dueno";
  const supabase = await crearClienteServidor();

  // RLS: si el asesor no tiene este lead, simplemente no lo encuentra.
  const { data: lead } = await supabase
    .from("leads")
    .select("*, propiedad:propiedades(id, titulo, clave, precio, moneda), zona:zonas(nombre)")
    .eq("id", id)
    .maybeSingle();
  if (!lead) notFound();

  const [{ data: equipo }, { data: zonas }, { data: eventos }, { data: conversacion }, { data: inmo }] = await Promise.all([
    supabase.from("usuarios").select("id, nombre, activo").order("nombre"),
    supabase.from("zonas").select("id, nombre").order("nombre"),
    supabase.from("eventos_lead").select("id, tipo, datos, usuario_id, creado_en").eq("lead_id", id).order("creado_en", { ascending: false }).order("id", { ascending: false }).limit(100),
    supabase.from("conversaciones").select("id, ia_activa, requiere_atencion, motivo_escalamiento, resumen, ultimo_entrante_en").eq("lead_id", id).maybeSingle(),
    supabase.from("inmobiliarias").select("agente_nombre").eq("id", usuario.inmobiliariaId).single(),
  ]);
  const { data: mensajes } = conversacion
    ? await supabase
        .from("mensajes")
        .select("id, direccion, autor, asesor_id, tipo, contenido, estado, error, creado_en, metadatos")
        .eq("conversacion_id", conversacion.id)
        .order("creado_en")
        .limit(300)
    : { data: [] };
  const nombres = Object.fromEntries((equipo ?? []).map((u) => [u.id, u.nombre]));
  const zh = usuario.inmobiliaria.zonaHoraria;
  const visitas = await datosVisitas(lead.id, lead.asesor_id, usuario.inmobiliariaId, zh);
  const detalle = (lead.fuente_detalle ?? {}) as Record<string, unknown>;
  const urlAnuncio = typeof detalle.url_anuncio === "string" ? detalle.url_anuncio : null;
  const telefonoWa = lead.telefono?.replace("+", "");

  return (
    <section className="space-y-6">
      <div>
        <Link href="/leads" className="text-sm text-slate-600 hover:underline">
          ← Leads
        </Link>
        <div className="mt-2 flex flex-wrap items-center gap-3">
          <h1 className="text-2xl font-semibold tracking-tight">{lead.nombre ?? "Sin nombre"}</h1>
          <InsigniaEstado estado={lead.estado} />
          <InsigniaScore score={lead.score} />
          {lead.opt_out ? <span className="text-sm font-medium text-red-700">No quiere ser contactado</span> : null}
        </div>
        <p className="mt-1 text-sm text-slate-600">
          {ETIQUETA_FUENTE[lead.fuente]} · llegó {haceCuanto(lead.creado_en)} ({formatearFechaHora(lead.creado_en, zh)})
          {lead.asesor_id ? ` · ${nombres[lead.asesor_id] ?? "Asesor"}` : " · sin asignar"}
        </p>
      </div>

      <div className="grid gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <Tarjeta titulo="Lo que nos dijo">
            <dl className="grid gap-x-6 gap-y-3 text-sm sm:grid-cols-2">
              <Dato etiqueta="Teléfono">
                {lead.telefono ? (
                  <a href={`https://wa.me/${telefonoWa}`} target="_blank" rel="noreferrer" className="text-emerald-700 hover:underline">
                    {formatearTelefono(lead.telefono)} (WhatsApp)
                  </a>
                ) : (
                  "—"
                )}
              </Dato>
              <Dato etiqueta="Correo">{lead.email ? <a href={`mailto:${lead.email}`} className="text-emerald-700 hover:underline">{lead.email}</a> : "—"}</Dato>
              <Dato etiqueta="Propiedad de interés">
                {lead.propiedad ? (
                  <Link href={`/propiedades/${lead.propiedad.id}`} className="text-emerald-700 hover:underline">
                    {lead.propiedad.titulo} · {formatearPesos(lead.propiedad.precio, lead.propiedad.moneda)}
                  </Link>
                ) : urlAnuncio ? (
                  <a href={urlAnuncio} target="_blank" rel="noreferrer" className="text-emerald-700 hover:underline">
                    Ver anuncio en el portal
                  </a>
                ) : (
                  "—"
                )}
              </Dato>
              <Dato etiqueta="Zona">{lead.zona?.nombre ?? lead.zona_interes ?? "—"}</Dato>
              <Dato etiqueta="Presupuesto">
                {lead.presupuesto_min || lead.presupuesto_max
                  ? `${formatearPesos(lead.presupuesto_min)} – ${formatearPesos(lead.presupuesto_max)}`
                  : "—"}
              </Dato>
              {lead.score_motivo ? <Dato etiqueta="Motivo del score">{lead.score_motivo}</Dato> : null}
              {lead.interes_visita ? <Dato etiqueta="Quiere visitar">{lead.interes_visita}</Dato> : null}
            </dl>
            {lead.mensaje_inicial ? (
              <blockquote className="mt-4 whitespace-pre-line rounded-lg bg-slate-50 p-3 text-sm text-slate-700">{lead.mensaje_inicial}</blockquote>
            ) : null}
          </Tarjeta>

          <Tarjeta titulo="Calificación">
            <FormCalificacion
              accion={guardarCalificacion.bind(null, lead.id)}
              zonas={(zonas ?? []).map((z) => ({ valor: z.id, etiqueta: z.nombre }))}
              iniciales={{
                operacion_interes: lead.operacion_interes ?? "",
                tipo_propiedad_interes: lead.tipo_propiedad_interes ?? "",
                zona_interes: lead.zona_interes ?? "",
                zona_id: lead.zona_id ?? "",
                presupuesto_min: lead.presupuesto_min?.toString() ?? "",
                presupuesto_max: lead.presupuesto_max?.toString() ?? "",
                forma_pago: lead.forma_pago ?? "",
                credito_preaprobado: lead.credito_preaprobado === null ? "" : lead.credito_preaprobado ? "si" : "no",
                urgencia: lead.urgencia ?? "",
                recamaras_min: lead.recamaras_min?.toString() ?? "",
                notas_calificacion: lead.notas_calificacion ?? "",
              }}
            />
          </Tarjeta>

          <Tarjeta titulo="Visitas">
            {visitas.citas.length ? (
              <ul className="mb-5 divide-y divide-slate-100 rounded-lg border border-slate-200">
                {visitas.citas.map((c) => (
                  <li key={c.id} className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 text-sm">
                    <span>
                      <span className="font-medium capitalize">{describirHorarioCita(new Date(c.inicio), zh)}</span>
                      <span className="text-slate-600">
                        {" "}
                        · {ESTADO_CITA[c.estado]}
                        {c.propiedad ? ` · ${c.propiedad.titulo}` : ""}
                        {c.origen === "agente" ? " · agendó el agente" : ""}
                      </span>
                    </span>
                    <AccionesCita
                      estado={c.estado}
                      yaPaso={new Date(c.inicio) < new Date()}
                      confirmar={cambiarEstadoCita.bind(null, c.id, "confirmada")}
                      realizada={cambiarEstadoCita.bind(null, c.id, "realizada")}
                      noAsistio={cambiarEstadoCita.bind(null, c.id, "no_asistio")}
                      cancelar={cancelarCitaPanel.bind(null, c.id)}
                    />
                  </li>
                ))}
              </ul>
            ) : null}
            {!lead.asesor_id ? (
              <p className="text-sm text-amber-800">Asigna un asesor para poder agendar.</p>
            ) : (
              <>
                {visitas.aviso ? <p className="mb-3 text-sm text-amber-800">{visitas.aviso}</p> : null}
                <FormAgendar
                  accion={agendarDesdePanel.bind(null, lead.id)}
                  dias={visitas.dias}
                  propiedades={visitas.propiedades}
                  propiedadInicial={lead.propiedad_interes_id}
                />
              </>
            )}
          </Tarjeta>

          <Tarjeta titulo="Conversación de WhatsApp">
            <Conversacion
              conversacion={conversacion}
              mensajes={mensajes ?? []}
              nombres={nombres}
              zonaHoraria={zh}
              nombreAgente={inmo?.agente_nombre ?? "Agente"}
              acciones={{
                tomar: cambiarControlIA.bind(null, lead.id, false),
                devolver: cambiarControlIA.bind(null, lead.id, true),
                atendido: marcarAtendido.bind(null, lead.id),
                enviar: enviarMensajeAsesor.bind(null, lead.id),
              }}
            />
          </Tarjeta>
        </div>

        <aside className="space-y-6">
          <Tarjeta titulo="Seguimiento">
            <div className="space-y-5">
              <FormEstado accion={cambiarEstado.bind(null, lead.id)} estadoActual={lead.estado} />
              {esDueno ? (
                <FormReasignar
                  accion={reasignarLead.bind(null, lead.id)}
                  asesorActual={lead.asesor_id}
                  asesores={(equipo ?? []).filter((u) => u.activo).map((u) => ({ valor: u.id, etiqueta: u.nombre }))}
                />
              ) : null}
            </div>
          </Tarjeta>

          {visitas.seguimientos.length ? (
            <Tarjeta titulo="Seguimientos automáticos">
              <ul className="space-y-3 text-sm">
                {visitas.seguimientos.map((sg) => (
                  <li key={sg.id} className="flex items-start justify-between gap-2">
                    <span>
                      <span className="block font-medium">{ETIQUETA_SEGUIMIENTO[sg.tipo]}</span>
                      <span className="block text-slate-500">
                        {ESTADO_SEGUIMIENTO[sg.estado]} · {formatearFechaHora(sg.ejecutado_en ?? sg.programado_para, zh)}
                      </span>
                      {sg.ultimo_error && sg.estado !== "enviado" ? <span className="block text-xs text-slate-500">{sg.ultimo_error}</span> : null}
                    </span>
                    {sg.estado === "pendiente" ? (
                      <form action={cancelarSeguimiento.bind(null, lead.id, sg.id)}>
                        <BotonEnviar variante="secundario" textoEnviando="…" className="!px-2 !py-1 text-xs">
                          Cancelar
                        </BotonEnviar>
                      </form>
                    ) : null}
                  </li>
                ))}
              </ul>
            </Tarjeta>
          ) : null}

          <Tarjeta titulo="Contacto">
            <FormContacto
              accion={guardarContacto.bind(null, lead.id)}
              iniciales={{ nombre: lead.nombre ?? "", telefono: lead.telefono ?? "", email: lead.email ?? "" }}
            />
          </Tarjeta>

          <Tarjeta titulo="Historial">
            <FormNota accion={agregarNota.bind(null, lead.id)} />
            <ol className="mt-5 space-y-4 border-l border-slate-200 pl-4">
              {(eventos ?? []).map((e) => (
                <li key={e.id} className="relative">
                  <span className="absolute -left-[21px] top-1.5 size-2.5 rounded-full bg-slate-300 ring-4 ring-white" />
                  <p className={`text-sm ${e.tipo === "nota" ? "whitespace-pre-line rounded-lg bg-amber-50 p-2 text-slate-800" : "text-slate-700"}`}>
                    {e.tipo === "nota" ? <span className="block text-xs font-medium text-amber-800">{e.usuario_id ? nombres[e.usuario_id] : "Nota"}</span> : null}
                    {describirEvento(e, nombres)}
                  </p>
                  <p className="text-xs text-slate-500" title={formatearFechaHora(e.creado_en, zh)}>
                    {haceCuanto(e.creado_en)}
                  </p>
                </li>
              ))}
            </ol>
          </Tarjeta>
        </aside>
      </div>
    </section>
  );
}

function Tarjeta({ titulo, children }: { titulo: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="mb-4 text-base font-semibold">{titulo}</h2>
      {children}
    </div>
  );
}

function Dato({ etiqueta, children }: { etiqueta: string; children: React.ReactNode }) {
  return (
    <div>
      <dt className="text-slate-500">{etiqueta}</dt>
      <dd className="mt-0.5 text-slate-900">{children}</dd>
    </div>
  );
}

const ESTADO_SEGUIMIENTO: Record<Database["public"]["Enums"]["estado_seguimiento"], string> = {
  pendiente: "Programado",
  procesando: "Enviándose",
  enviado: "Enviado",
  cancelado: "No se envió",
  fallido: "Falló",
};

const ESTADO_CITA: Record<Database["public"]["Enums"]["estado_cita"], string> = {
  programada: "programada",
  confirmada: "confirmada",
  realizada: "realizada",
  no_asistio: "no asistió",
  cancelada: "cancelada",
};

/** Citas del lead (RLS) y horarios libres de su asesor para agendar desde aquí. */
async function datosVisitas(leadId: string, asesorId: string | null, inmobiliariaId: string, zh: string) {
  const supabase = await crearClienteServidor();
  const [{ data: citas }, { data: propiedades }, { data: seguimientos }] = await Promise.all([
    supabase
      .from("citas")
      .select("id, inicio, estado, origen, propiedad:propiedades(titulo)")
      .eq("lead_id", leadId)
      .order("inicio", { ascending: false })
      .limit(20),
    supabase.from("propiedades").select("id, titulo").eq("estado", "disponible").order("titulo").limit(300),
    supabase
      .from("seguimientos")
      .select("id, tipo, estado, programado_para, ejecutado_en, ultimo_error")
      .eq("lead_id", leadId)
      .order("programado_para", { ascending: false })
      .limit(12),
  ]);

  const dias: { dia: string; horarios: { valor: string; etiqueta: string }[] }[] = [];
  let aviso: string | null = null;
  if (asesorId) {
    try {
      // La disponibilidad del asesor incluye su Google Calendar (sólo con credenciales de servidor).
      const disp = await disponibilidadAsesor(crearClienteAdmin(), inmobiliariaId, asesorId);
      if (disp.fuente === "solo_citas") aviso = "El asesor no ha conectado su Google Calendar: sólo se evitan choques con visitas de InmoCRM.";
      const porDia = new Map<string, { valor: string; etiqueta: string }[]>();
      const fmtDia = new Intl.DateTimeFormat("es-MX", { weekday: "long", day: "numeric", month: "long", timeZone: zh });
      const fmtHora = new Intl.DateTimeFormat("es-MX", { hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: zh });
      for (const l of disp.libres) {
        const clave = fechaIso(partesLocales(zh, l.inicio));
        const lista = porDia.get(clave) ?? [];
        lista.push({ valor: l.inicio.toISOString(), etiqueta: fmtHora.format(l.inicio) });
        if (!porDia.has(clave)) {
          porDia.set(clave, lista);
          dias.push({ dia: fmtDia.format(l.inicio), horarios: lista });
        }
      }
    } catch {
      aviso = "No se pudo leer el calendario del asesor (puede que deba reconectarlo en Mi perfil).";
    }
  }
  return {
    citas: citas ?? [],
    seguimientos: seguimientos ?? [],
    dias,
    aviso,
    propiedades: (propiedades ?? []).map((p) => ({ valor: p.id, etiqueta: p.titulo })),
  };
}
