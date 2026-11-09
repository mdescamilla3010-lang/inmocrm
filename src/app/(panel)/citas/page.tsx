import type { Metadata } from "next";
import Link from "next/link";
import { AccionesCita } from "@/components/citas/acciones-cita";
import { InsigniaScore } from "@/components/leads/insignias";
import { Insignia, type Tono } from "@/components/ui/insignia";
import { requerirUsuario } from "@/lib/auth/sesion";
import { primerValor } from "@/lib/busqueda";
import { describirHorarioCita } from "@/lib/calendario/disponibilidad";
import type { Database } from "@/lib/supabase/database.types";
import { crearClienteServidor } from "@/lib/supabase/server";
import { cambiarEstadoCita, cancelarCitaPanel } from "./acciones";

export const metadata: Metadata = { title: "Citas" };

const ESTADO: Record<Database["public"]["Enums"]["estado_cita"], { texto: string; tono: Tono }> = {
  programada: { texto: "Programada", tono: "azul" },
  confirmada: { texto: "Confirmada", tono: "verde" },
  realizada: { texto: "Realizada", tono: "verde" },
  no_asistio: { texto: "No asistió", tono: "ambar" },
  cancelada: { texto: "Cancelada", tono: "gris" },
};

const UUID = /^[0-9a-f-]{36}$/i;

export default async function PaginaCitas({ searchParams }: PageProps<"/citas">) {
  const usuario = await requerirUsuario();
  const sp = await searchParams;
  const vista = primerValor(sp.vista) === "pasadas" ? "pasadas" : "proximas";
  const asesorFiltro = primerValor(sp.asesor);
  const esDueno = usuario.rol === "dueno";
  const zh = usuario.inmobiliaria.zonaHoraria;
  const ahora = new Date();

  const supabase = await crearClienteServidor();
  // RLS: el asesor sólo ve sus citas.
  let consulta = supabase
    .from("citas")
    .select("id, inicio, fin, estado, origen, google_event_id, notas, lead:leads(id, nombre, telefono, score), asesor:usuarios(nombre), propiedad:propiedades(id, titulo)")
    .limit(200);
  consulta =
    vista === "proximas"
      ? consulta.gte("fin", ahora.toISOString()).in("estado", ["programada", "confirmada"]).order("inicio")
      : consulta.lt("fin", ahora.toISOString()).gte("inicio", new Date(ahora.getTime() - 60 * 86_400_000).toISOString()).order("inicio", { ascending: false });
  if (esDueno && asesorFiltro && UUID.test(asesorFiltro)) consulta = consulta.eq("asesor_id", asesorFiltro);

  const [{ data: citas }, { data: equipo }] = await Promise.all([
    consulta,
    esDueno ? supabase.from("usuarios").select("id, nombre").eq("activo", true).order("nombre") : Promise.resolve({ data: [] }),
  ]);
  const pendientesDeCerrar = vista === "pasadas" ? (citas ?? []).filter((c) => c.estado === "programada" || c.estado === "confirmada").length : 0;

  return (
    <section className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Citas</h1>
        <p className="mt-1 text-sm text-slate-600">
          {esDueno ? "Las visitas de todo el equipo." : "Tus visitas."} Las que agenda el agente aparecen aquí y en el Google Calendar del asesor.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <nav className="flex gap-1 rounded-lg bg-slate-100 p-1 text-sm">
          {(["proximas", "pasadas"] as const).map((v) => (
            <Link
              key={v}
              href={`/citas?vista=${v}${asesorFiltro ? `&asesor=${asesorFiltro}` : ""}`}
              aria-current={vista === v ? "page" : undefined}
              className={`rounded-md px-3 py-1.5 ${vista === v ? "bg-white font-medium shadow-sm" : "text-slate-600"}`}
            >
              {v === "proximas" ? "Próximas" : "Últimos 60 días"}
            </Link>
          ))}
        </nav>
        {esDueno ? (
          <form className="flex items-center gap-2">
            <input type="hidden" name="vista" value={vista} />
            <select name="asesor" defaultValue={asesorFiltro ?? ""} aria-label="Asesor" className="rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm">
              <option value="">Todo el equipo</option>
              {(equipo ?? []).map((u) => (
                <option key={u.id} value={u.id}>
                  {u.nombre}
                </option>
              ))}
            </select>
            <button type="submit" className="rounded-lg bg-slate-800 px-3 py-1.5 text-sm font-semibold text-white">
              Ver
            </button>
          </form>
        ) : null}
      </div>

      {pendientesDeCerrar ? (
        <p className="rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
          {pendientesDeCerrar} {pendientesDeCerrar === 1 ? "visita pasada sigue" : "visitas pasadas siguen"} sin marcar como realizada o no asistió. Marcarlas mantiene
          correctos los reportes.
        </p>
      ) : null}

      {citas?.length ? (
        <ul className="divide-y divide-slate-100 rounded-xl border border-slate-200 bg-white">
          {citas.map((c) => {
            const e = ESTADO[c.estado];
            return (
              <li key={c.id} className="flex flex-wrap items-start gap-4 px-4 py-3">
                <div className="w-48 shrink-0">
                  <p className="font-medium capitalize">{describirHorarioCita(new Date(c.inicio), zh)}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    <Insignia tono={e.tono}>{e.texto}</Insignia>
                    {c.origen === "agente" ? <Insignia tono="violeta">Agente IA</Insignia> : null}
                  </div>
                </div>
                <div className="min-w-0 flex-1 text-sm">
                  {c.lead ? (
                    <p className="flex flex-wrap items-center gap-2">
                      <Link href={`/leads/${c.lead.id}`} className="font-medium text-slate-900 hover:text-emerald-800 hover:underline">
                        {c.lead.nombre ?? "Sin nombre"}
                      </Link>
                      <InsigniaScore score={c.lead.score} />
                    </p>
                  ) : null}
                  <p className="text-slate-600">
                    {c.propiedad ? (
                      <Link href={`/propiedades/${c.propiedad.id}`} className="hover:underline">
                        {c.propiedad.titulo}
                      </Link>
                    ) : (
                      "Propiedad por definir"
                    )}
                    {esDueno ? ` · ${c.asesor?.nombre ?? ""}` : ""}
                    {c.google_event_id ? " · en Google Calendar" : ""}
                  </p>
                  {c.notas ? <p className="mt-1 text-slate-500">{c.notas}</p> : null}
                </div>
                <AccionesCita
                  estado={c.estado}
                  yaPaso={new Date(c.inicio) < ahora}
                  confirmar={cambiarEstadoCita.bind(null, c.id, "confirmada")}
                  realizada={cambiarEstadoCita.bind(null, c.id, "realizada")}
                  noAsistio={cambiarEstadoCita.bind(null, c.id, "no_asistio")}
                  cancelar={cancelarCitaPanel.bind(null, c.id)}
                />
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="font-medium text-slate-900">{vista === "proximas" ? "No hay visitas próximas" : "No hubo visitas en los últimos 60 días"}</p>
          <p className="mt-1 text-sm text-slate-600">El agente agenda visitas cuando un prospecto calificado quiere conocer una propiedad.</p>
        </div>
      )}
    </section>
  );
}
