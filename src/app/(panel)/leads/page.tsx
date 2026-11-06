import type { Metadata } from "next";
import Link from "next/link";
import { InsigniaEstado, InsigniaScore } from "@/components/leads/insignias";
import { EnlaceBoton } from "@/components/ui/enlace-boton";
import { requerirUsuario } from "@/lib/auth/sesion";
import { haceCuanto } from "@/lib/formato";
import { ETIQUETA_ESTADO, ETIQUETA_FUENTE, ETIQUETA_SCORE, opciones } from "@/lib/leads/etiquetas";
import { crearClienteServidor } from "@/lib/supabase/server";
import { formatearTelefono } from "@/lib/telefono";
import { esquemaFiltros, limpiarBusqueda, primerValor, type Filtros } from "./filtros";

export const metadata: Metadata = { title: "Leads" };

const POR_PAGINA = 25;

export default async function PaginaLeads({ searchParams }: PageProps<"/leads">) {
  const usuario = await requerirUsuario();
  const sp = await searchParams;
  const filtros = esquemaFiltros.parse(Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, primerValor(v)])));
  const esDueno = usuario.rol === "dueno";

  const supabase = await crearClienteServidor();
  const desde = (filtros.pagina - 1) * POR_PAGINA;

  // RLS ya limita al asesor a sus leads; aquí sólo se aplican filtros.
  let consulta = supabase
    .from("leads")
    .select("id, nombre, telefono, email, fuente, estado, score, creado_en, asesor:usuarios(nombre)", { count: "exact" })
    .order("creado_en", { ascending: false })
    .range(desde, desde + POR_PAGINA - 1);

  if (filtros.estado) consulta = consulta.eq("estado", filtros.estado);
  if (filtros.fuente) consulta = consulta.eq("fuente", filtros.fuente);
  if (filtros.score === "sin_score") consulta = consulta.is("score", null);
  else if (filtros.score) consulta = consulta.eq("score", filtros.score);
  if (esDueno && filtros.asesor === "sin_asignar") consulta = consulta.is("asesor_id", null);
  else if (esDueno && filtros.asesor) consulta = consulta.eq("asesor_id", filtros.asesor);
  const q = filtros.q ? limpiarBusqueda(filtros.q) : "";
  if (q) consulta = consulta.or(`nombre.ilike.*${q}*,telefono.ilike.*${q.replace(/\D/g, "") || q}*,email.ilike.*${q}*`);

  const [{ data: leads, count }, { data: equipo }] = await Promise.all([
    consulta,
    esDueno
      ? supabase.from("usuarios").select("id, nombre").eq("activo", true).order("nombre")
      : Promise.resolve({ data: [] as { id: string; nombre: string }[] }),
  ]);

  const total = count ?? 0;
  const paginas = Math.max(1, Math.ceil(total / POR_PAGINA));
  const hayFiltros = Boolean(filtros.estado || filtros.fuente || filtros.score || filtros.asesor || q);

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Leads</h1>
          <p className="mt-1 text-sm text-slate-600">
            {esDueno ? "Todos los leads de tu inmobiliaria." : "Los leads que tienes asignados."} {total}{" "}
            {total === 1 ? "lead" : "leads"}
            {hayFiltros ? " con estos filtros" : ""}.
          </p>
        </div>
        <EnlaceBoton href="/leads/nuevo">Nuevo lead</EnlaceBoton>
      </div>

      <form className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-6" role="search">
        <input
          name="q"
          defaultValue={filtros.q}
          placeholder="Buscar nombre, teléfono o correo"
          aria-label="Buscar"
          className="rounded-lg border border-slate-300 px-3 py-2 text-sm lg:col-span-2"
        />
        <Filtro nombre="estado" etiqueta="Estado" valor={filtros.estado} opciones={opciones(ETIQUETA_ESTADO)} />
        <Filtro nombre="fuente" etiqueta="Fuente" valor={filtros.fuente} opciones={opciones(ETIQUETA_FUENTE)} />
        <Filtro
          nombre="score"
          etiqueta="Score"
          valor={filtros.score}
          opciones={[...opciones(ETIQUETA_SCORE), { valor: "sin_score", etiqueta: "Sin score" }]}
        />
        {esDueno ? (
          <Filtro
            nombre="asesor"
            etiqueta="Asesor"
            valor={filtros.asesor}
            opciones={[{ valor: "sin_asignar", etiqueta: "Sin asignar" }, ...(equipo ?? []).map((u) => ({ valor: u.id, etiqueta: u.nombre }))]}
          />
        ) : null}
        <div className="flex gap-2 sm:col-span-2 lg:col-span-6">
          <button type="submit" className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900">
            Filtrar
          </button>
          {hayFiltros ? (
            <Link href="/leads" className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">
              Limpiar
            </Link>
          ) : null}
        </div>
      </form>

      {leads && leads.length > 0 ? (
        <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
          <table className="min-w-full divide-y divide-slate-200 text-sm">
            <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3">Prospecto</th>
                <th className="px-4 py-3">Fuente</th>
                <th className="px-4 py-3">Score</th>
                <th className="px-4 py-3">Estado</th>
                {esDueno ? <th className="px-4 py-3">Asesor</th> : null}
                <th className="px-4 py-3">Llegó</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {leads.map((l) => (
                <tr key={l.id} className="hover:bg-slate-50">
                  <td className="px-4 py-3">
                    <Link href={`/leads/${l.id}`} className="font-medium text-slate-900 hover:text-emerald-800 hover:underline">
                      {l.nombre ?? "Sin nombre"}
                    </Link>
                    <p className="text-slate-500">{l.telefono ? formatearTelefono(l.telefono) : l.email}</p>
                  </td>
                  <td className="px-4 py-3 text-slate-700">{ETIQUETA_FUENTE[l.fuente]}</td>
                  <td className="px-4 py-3">
                    <InsigniaScore score={l.score} />
                  </td>
                  <td className="px-4 py-3">
                    <InsigniaEstado estado={l.estado} />
                  </td>
                  {esDueno ? <td className="px-4 py-3 text-slate-700">{l.asesor?.nombre ?? <span className="text-amber-700">Sin asignar</span>}</td> : null}
                  <td className="px-4 py-3 whitespace-nowrap text-slate-500" title={new Date(l.creado_en).toISOString()}>
                    {haceCuanto(l.creado_en)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="font-medium text-slate-900">{hayFiltros ? "Ningún lead coincide con los filtros" : "Aún no hay leads"}</p>
          <p className="mt-1 text-sm text-slate-600">
            {hayFiltros
              ? "Prueba con otros filtros."
              : esDueno
                ? "Conecta tus fuentes en Integraciones o captura uno a mano."
                : "Cuando te asignen un lead aparecerá aquí."}
          </p>
        </div>
      )}

      {paginas > 1 ? <Paginacion filtros={filtros} paginas={paginas} /> : null}
    </section>
  );
}

function Filtro(props: { nombre: string; etiqueta: string; valor?: string; opciones: { valor: string; etiqueta: string }[] }) {
  return (
    <select
      name={props.nombre}
      defaultValue={props.valor ?? ""}
      aria-label={props.etiqueta}
      className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm"
    >
      <option value="">{props.etiqueta}: todos</option>
      {props.opciones.map((o) => (
        <option key={o.valor} value={o.valor}>
          {o.etiqueta}
        </option>
      ))}
    </select>
  );
}

function Paginacion({ filtros, paginas }: { filtros: Filtros; paginas: number }) {
  const href = (pagina: number) => {
    const p = new URLSearchParams();
    for (const [k, v] of Object.entries(filtros)) if (v !== undefined && k !== "pagina") p.set(k, String(v));
    p.set("pagina", String(pagina));
    return `/leads?${p.toString()}`;
  };
  return (
    <nav className="flex items-center justify-between text-sm" aria-label="Paginación">
      {filtros.pagina > 1 ? <Link href={href(filtros.pagina - 1)} className="text-emerald-700 hover:underline">← Anteriores</Link> : <span />}
      <span className="text-slate-500">
        Página {filtros.pagina} de {paginas}
      </span>
      {filtros.pagina < paginas ? <Link href={href(filtros.pagina + 1)} className="text-emerald-700 hover:underline">Siguientes →</Link> : <span />}
    </nav>
  );
}
