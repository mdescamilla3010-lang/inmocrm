import type { Metadata } from "next";
import { requerirDueno } from "@/lib/auth/sesion";
import { crearClienteServidor } from "@/lib/supabase/server";
import { formatearTelefono } from "@/lib/telefono";
import { FilaMiembro } from "./fila-miembro";
import { FormularioInvitacion } from "./formulario-invitacion";

export const metadata: Metadata = { title: "Equipo" };

export default async function PaginaEquipo() {
  const yo = await requerirDueno();
  const supabase = await crearClienteServidor();
  const { data: equipo } = await supabase
    .from("usuarios")
    .select("id, nombre, email, telefono, rol, activo, recibe_leads")
    .order("rol")
    .order("nombre");

  return (
    <section className="space-y-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Equipo</h1>
        <p className="mt-1 text-sm text-slate-600">
          Invita asesores y decide quién recibe leads. Los asesores sólo ven los leads y citas que tienen asignados.
        </p>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-base font-semibold">Invitar a alguien</h2>
        <FormularioInvitacion />
      </div>

      <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
        <table className="min-w-full divide-y divide-slate-200 text-sm">
          <thead className="bg-slate-50 text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-4 py-3">Nombre</th>
              <th className="px-4 py-3">Rol</th>
              <th className="px-4 py-3">Activo</th>
              <th className="px-4 py-3">Recibe leads</th>
              <th className="px-4 py-3">
                <span className="sr-only">Acciones</span>
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {(equipo ?? []).map((m) => (
              <FilaMiembro
                key={m.id}
                miembro={{
                  id: m.id,
                  nombre: m.nombre,
                  email: m.email,
                  telefono: m.telefono ? formatearTelefono(m.telefono) : null,
                  rol: m.rol,
                  activo: m.activo,
                  recibeLeads: m.recibe_leads,
                }}
                esYo={m.id === yo.id}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}
