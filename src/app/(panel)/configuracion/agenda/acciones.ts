"use server";

import { revalidatePath } from "next/cache";
import { objetoDeFormulario } from "@/lib/auth/esquemas";
import { requerirDueno } from "@/lib/auth/sesion";
import { leerConfigAgenda } from "@/lib/calendario/configuracion";
import type { EstadoFormulario } from "@/lib/formularios";
import { crearClienteServidor } from "@/lib/supabase/server";

export async function guardarAgenda(_: EstadoFormulario, fd: FormData): Promise<EstadoFormulario> {
  const dueno = await requerirDueno();
  const valores = objetoDeFormulario(fd);
  const r = leerConfigAgenda(valores);
  if (!r.ok) return { errores: r.errores, valores };

  const supabase = await crearClienteServidor();
  const { error } = await supabase
    .from("inmobiliarias")
    .update({
      horario_visitas: r.datos.horario,
      duracion_cita_min: r.datos.duracionMin,
      margen_traslado_min: r.datos.margenMin,
      anticipacion_min: r.datos.anticipacionMin,
    })
    .eq("id", dueno.inmobiliariaId);
  if (error) return { error: "No se pudo guardar la agenda.", valores };
  revalidatePath("/configuracion/agenda");
  return { ok: "Agenda guardada. El agente ya ofrece horarios con esta configuración." };
}
