import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { EnlaceBoton } from "@/components/ui/enlace-boton";
import { Insignia } from "@/components/ui/insignia";
import { requerirUsuario } from "@/lib/auth/sesion";
import { envPublico } from "@/lib/env";
import { formatearPesos } from "@/lib/formato";
import { ETIQUETA_ESTADO_PROPIEDAD, ETIQUETA_OPERACION, ETIQUETA_TIPO_PROPIEDAD, opciones } from "@/lib/leads/etiquetas";
import { urlPublicaFoto } from "@/lib/propiedades/fotos";
import { Constants } from "@/lib/supabase/database.types";
import { crearClienteServidor } from "@/lib/supabase/server";
import { limpiarBusqueda, primerValor } from "@/lib/busqueda";

export const metadata: Metadata = { title: "Propiedades" };

const E = Constants.public.Enums;
const esquemaFiltros = z.object({
  estado: z.enum(E.estado_propiedad).optional().catch(undefined),
  operacion: z.enum(E.operacion_propiedad).optional().catch(undefined),
  tipo: z.enum(E.tipo_propiedad).optional().catch(undefined),
  q: z.string().trim().max(80).optional().catch(undefined),
});

export default async function PaginaPropiedades({ searchParams }: PageProps<"/propiedades">) {
  await requerirUsuario();
  const sp = await searchParams;
  const f = esquemaFiltros.parse(Object.fromEntries(Object.entries(sp).map(([k, v]) => [k, primerValor(v)])));
  const supabase = await crearClienteServidor();

  let consulta = supabase
    .from("propiedades")
    .select("id, clave, titulo, tipo, operacion, estado, precio, moneda, recamaras, banos, m2_construccion, colonia, zona:zonas(nombre), fotos:propiedad_fotos(ruta_storage, es_portada)")
    .order("actualizado_en", { ascending: false })
    .limit(200);
  if (f.estado) consulta = consulta.eq("estado", f.estado);
  if (f.operacion) consulta = consulta.eq("operacion", f.operacion);
  if (f.tipo) consulta = consulta.eq("tipo", f.tipo);
  const q = f.q ? limpiarBusqueda(f.q) : "";
  if (q) consulta = consulta.or(`titulo.ilike.*${q}*,clave.ilike.*${q}*,colonia.ilike.*${q}*`);

  const { data: propiedades } = await consulta;
  const supabaseUrl = envPublico().NEXT_PUBLIC_SUPABASE_URL;
  const hayFiltros = Boolean(f.estado || f.operacion || f.tipo || q);

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Propiedades</h1>
          <p className="mt-1 text-sm text-slate-600">El catálogo que el agente de IA recomienda a los prospectos.</p>
        </div>
        <EnlaceBoton href="/propiedades/nueva">Nueva propiedad</EnlaceBoton>
      </div>

      <form className="grid gap-3 rounded-xl border border-slate-200 bg-white p-4 sm:grid-cols-2 lg:grid-cols-5" role="search">
        <input name="q" defaultValue={f.q} placeholder="Buscar título, clave o colonia" aria-label="Buscar" className="rounded-lg border border-slate-300 px-3 py-2 text-sm lg:col-span-2" />
        {(
          [
            ["estado", "Estado", opciones(ETIQUETA_ESTADO_PROPIEDAD), f.estado],
            ["operacion", "Operación", opciones(ETIQUETA_OPERACION), f.operacion],
            ["tipo", "Tipo", opciones(ETIQUETA_TIPO_PROPIEDAD), f.tipo],
          ] as const
        ).map(([nombre, etiqueta, ops, valor]) => (
          <select key={nombre} name={nombre} defaultValue={valor ?? ""} aria-label={etiqueta} className="rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm">
            <option value="">{etiqueta}: todos</option>
            {ops.map((o) => (
              <option key={o.valor} value={o.valor}>
                {o.etiqueta}
              </option>
            ))}
          </select>
        ))}
        <div className="flex gap-2 sm:col-span-2 lg:col-span-5">
          <button type="submit" className="rounded-lg bg-slate-800 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-900">
            Filtrar
          </button>
          {hayFiltros ? (
            <Link href="/propiedades" className="rounded-lg px-4 py-2 text-sm text-slate-600 hover:bg-slate-100">
              Limpiar
            </Link>
          ) : null}
        </div>
      </form>

      {propiedades?.length ? (
        <ul className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {propiedades.map((p) => {
            const portada = p.fotos.find((x) => x.es_portada) ?? p.fotos[0];
            const caracteristicas = [
              p.recamaras !== null ? `${p.recamaras} rec.` : null,
              p.banos !== null ? `${p.banos} baños` : null,
              p.m2_construccion !== null ? `${p.m2_construccion} m²` : null,
            ].filter(Boolean);
            return (
              <li key={p.id}>
                <Link href={`/propiedades/${p.id}`} className="block overflow-hidden rounded-xl border border-slate-200 bg-white hover:border-emerald-300 hover:shadow-sm">
                  <div className="aspect-[4/3] bg-slate-100">
                    {portada ? (
                      // eslint-disable-next-line @next/next/no-img-element -- URLs de Storage
                      <img src={urlPublicaFoto(supabaseUrl, portada.ruta_storage)} alt="" className="size-full object-cover" loading="lazy" />
                    ) : (
                      <div className="flex size-full items-center justify-center text-sm text-slate-400">Sin fotos</div>
                    )}
                  </div>
                  <div className="space-y-1 p-4">
                    <div className="flex items-start justify-between gap-2">
                      <p className="font-medium text-slate-900">{p.titulo}</p>
                      <Insignia tono={p.estado === "disponible" ? "verde" : "gris"}>{ETIQUETA_ESTADO_PROPIEDAD[p.estado]}</Insignia>
                    </div>
                    <p className="text-lg font-semibold">
                      {formatearPesos(p.precio, p.moneda)}
                      {p.operacion === "renta" ? <span className="text-sm font-normal text-slate-500"> /mes</span> : null}
                    </p>
                    <p className="text-sm text-slate-600">
                      {ETIQUETA_TIPO_PROPIEDAD[p.tipo]} en {ETIQUETA_OPERACION[p.operacion].toLowerCase()}
                      {p.zona?.nombre || p.colonia ? ` · ${p.zona?.nombre ?? p.colonia}` : ""}
                    </p>
                    {caracteristicas.length ? <p className="text-sm text-slate-500">{caracteristicas.join(" · ")}</p> : null}
                    {p.clave ? <p className="text-xs text-slate-400">Clave {p.clave}</p> : null}
                  </div>
                </Link>
              </li>
            );
          })}
        </ul>
      ) : (
        <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
          <p className="font-medium text-slate-900">{hayFiltros ? "Ninguna propiedad coincide" : "Aún no hay propiedades"}</p>
          <p className="mt-1 text-sm text-slate-600">{hayFiltros ? "Prueba con otros filtros." : "Da de alta tu catálogo para que el agente pueda recomendarlo."}</p>
        </div>
      )}
    </section>
  );
}
