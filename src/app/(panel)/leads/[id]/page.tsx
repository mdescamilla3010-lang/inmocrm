import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { InsigniaEstado, InsigniaScore } from "@/components/leads/insignias";
import { requerirUsuario } from "@/lib/auth/sesion";
import { formatearFechaHora, formatearPesos, haceCuanto } from "@/lib/formato";
import { ETIQUETA_FUENTE } from "@/lib/leads/etiquetas";
import { describirEvento } from "@/lib/leads/eventos";
import { crearClienteServidor } from "@/lib/supabase/server";
import { formatearTelefono } from "@/lib/telefono";
import { agregarNota, cambiarEstado, guardarCalificacion, guardarContacto, reasignarLead } from "./acciones";
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

  const [{ data: equipo }, { data: zonas }, { data: eventos }] = await Promise.all([
    supabase.from("usuarios").select("id, nombre, activo").order("nombre"),
    supabase.from("zonas").select("id, nombre").order("nombre"),
    supabase.from("eventos_lead").select("id, tipo, datos, usuario_id, creado_en").eq("lead_id", id).order("creado_en", { ascending: false }).order("id", { ascending: false }).limit(100),
  ]);
  const nombres = Object.fromEntries((equipo ?? []).map((u) => [u.id, u.nombre]));
  const zh = usuario.inmobiliaria.zonaHoraria;
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

          <Tarjeta titulo="Conversación de WhatsApp">
            <p className="text-sm text-slate-600">La conversación con el agente de IA aparecerá aquí en la fase 3.</p>
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
