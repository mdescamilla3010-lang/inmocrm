import type { Metadata } from "next";
import { Insignia } from "@/components/ui/insignia";
import { requerirDueno } from "@/lib/auth/sesion";
import { DIAS } from "@/lib/calendario/configuracion";
import { envServidor } from "@/lib/env";
import { crearClienteServidor } from "@/lib/supabase/server";
import { FormularioAgenda } from "./formulario";

export const metadata: Metadata = { title: "Agenda" };

export default async function PaginaAgenda() {
  const dueno = await requerirDueno();
  const supabase = await crearClienteServidor();
  const [{ data: inmo }, { data: equipo }, { data: calendarios }] = await Promise.all([
    supabase
      .from("inmobiliarias")
      .select("horario_visitas, duracion_cita_min, margen_traslado_min, anticipacion_min")
      .eq("id", dueno.inmobiliariaId)
      .single(),
    supabase.from("usuarios").select("id, nombre, recibe_leads").eq("activo", true).order("nombre"),
    supabase.from("integraciones").select("usuario_id, identificador_externo, activa").eq("proveedor", "google_calendar"),
  ]);

  const horario = (inmo?.horario_visitas ?? {}) as Record<string, [string, string] | null>;
  const inicial: Record<string, string> = {
    duracionMin: String(inmo?.duracion_cita_min ?? 60),
    margenMin: String(inmo?.margen_traslado_min ?? 30),
    anticipacionHoras: String((inmo?.anticipacion_min ?? 120) / 60),
  };
  for (const { clave } of DIAS) {
    const rango = horario[clave];
    if (rango) {
      inicial[`abierto_${clave}`] = "on";
      inicial[`desde_${clave}`] = rango[0];
      inicial[`hasta_${clave}`] = rango[1];
    }
  }
  const googleConfigurado = Boolean(envServidor().GOOGLE_CLIENT_ID);

  return (
    <section className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-base font-semibold">Horario y reglas de las visitas</h2>
        <p className="mb-4 mt-1 text-sm text-slate-600">
          El agente sólo ofrece horarios dentro de este horario, en los que el asesor asignado no tenga otra visita ni nada
          en su Google Calendar.
        </p>
        <FormularioAgenda inicial={inicial} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-base font-semibold">Calendarios del equipo</h2>
        <p className="mb-4 mt-1 text-sm text-slate-600">
          Cada asesor conecta su Google Calendar desde “Mi perfil”. Sin calendario conectado, el agente sólo evita choques con
          las visitas registradas en InmoCRM.
        </p>
        {!googleConfigurado ? (
          <p className="mb-3 text-sm text-amber-800">Google Calendar aún no está configurado en el servidor (GOOGLE_CLIENT_ID).</p>
        ) : null}
        <ul className="divide-y divide-slate-100 text-sm">
          {(equipo ?? []).map((u) => {
            const cal = (calendarios ?? []).find((c) => c.usuario_id === u.id);
            return (
              <li key={u.id} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  {u.nombre}
                  {!u.recibe_leads ? <span className="text-xs text-slate-400"> (no recibe leads)</span> : null}
                </span>
                {cal?.activa ? (
                  <Insignia tono="verde">{cal.identificador_externo}</Insignia>
                ) : cal ? (
                  <Insignia tono="rojo">Debe reconectar</Insignia>
                ) : (
                  <Insignia>Sin conectar</Insignia>
                )}
              </li>
            );
          })}
        </ul>
      </div>
    </section>
  );
}
