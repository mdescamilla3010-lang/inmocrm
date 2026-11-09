import type { Metadata } from "next";
import { requerirDueno } from "@/lib/auth/sesion";
import { crearClienteServidor } from "@/lib/supabase/server";
import { actualizarZona, borrarZona, crearZona, guardarEstrategia } from "./acciones";
import { FormEstrategia, FormZona } from "./formularios";

export const metadata: Metadata = { title: "Asignación de leads" };

export default async function PaginaAsignacion() {
  const dueno = await requerirDueno();
  const supabase = await crearClienteServidor();
  const [{ data: inmo }, { data: zonas }, { data: asesores }, { data: coberturas }] = await Promise.all([
    supabase.from("inmobiliarias").select("estrategia_asignacion").eq("id", dueno.inmobiliariaId).single(),
    supabase.from("zonas").select("id, nombre, alias").order("nombre"),
    supabase.from("usuarios").select("id, nombre, recibe_leads").eq("activo", true).order("nombre"),
    supabase.from("asesor_zonas").select("asesor_id, zona_id"),
  ]);
  const listaAsesores = (asesores ?? []).map((a) => ({ id: a.id, nombre: a.nombre, recibeLeads: a.recibe_leads }));
  const sinZona = listaAsesores.filter((a) => a.recibeLeads && !(coberturas ?? []).some((c) => c.asesor_id === a.id));

  return (
    <section className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-base font-semibold">¿Cómo se reparten los leads nuevos?</h2>
        <p className="mb-4 mt-1 text-sm text-slate-600">Sólo participan los miembros activos con “Recibe leads” marcado en Equipo.</p>
        <FormEstrategia accion={guardarEstrategia} actual={inmo?.estrategia_asignacion ?? "round_robin"} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-base font-semibold">Zonas</h2>
        <p className="mt-1 text-sm text-slate-600">
          El agente y los formularios reconocen la zona por su nombre o sus sinónimos (sin importar acentos). También se usan
          para clasificar tus propiedades.
        </p>
        {inmo?.estrategia_asignacion === "zona" && sinZona.length ? (
          <p className="mt-3 rounded-lg bg-amber-50 p-3 text-sm text-amber-800">
            Sin zona asignada: {sinZona.map((a) => a.nombre).join(", ")}. Sólo recibirán leads cuando no se sepa la zona o nadie la cubra.
          </p>
        ) : null}

        <ul className="mt-5 divide-y divide-slate-100">
          {(zonas ?? []).map((z) => (
            <li key={z.id} className="py-5 first:pt-0">
              <FormZona
                accion={actualizarZona.bind(null, z.id)}
                borrar={borrarZona.bind(null, z.id)}
                asesores={listaAsesores}
                inicial={{
                  nombre: z.nombre,
                  alias: z.alias.join(", "),
                  asesores: (coberturas ?? []).filter((c) => c.zona_id === z.id).map((c) => c.asesor_id),
                }}
              />
            </li>
          ))}
        </ul>

        <div className="mt-5 rounded-lg bg-slate-50 p-4">
          <h3 className="mb-3 text-sm font-semibold">Nueva zona</h3>
          <FormZona accion={crearZona} asesores={listaAsesores} nueva />
        </div>
      </div>
    </section>
  );
}
