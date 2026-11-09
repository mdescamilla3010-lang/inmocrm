"use server";

import { revalidatePath } from "next/cache";
import { esquemaConfigAgente } from "@/lib/agente/configuracion";
import { erroresPorCampo, objetoDeFormulario } from "@/lib/auth/esquemas";
import { requerirDueno } from "@/lib/auth/sesion";
import type { EstadoFormulario } from "@/lib/formularios";
import { crearClienteServidor } from "@/lib/supabase/server";

export async function guardarAgente(_: EstadoFormulario, fd: FormData): Promise<EstadoFormulario> {
  const dueno = await requerirDueno();
  const valores = objetoDeFormulario(fd);
  const r = esquemaConfigAgente.safeParse(valores);
  if (!r.success) return { errores: erroresPorCampo(r.error), valores };

  const supabase = await crearClienteServidor();
  const { error } = await supabase
    .from("inmobiliarias")
    .update({
      agente_nombre: r.data.agenteNombre,
      agente_instrucciones: r.data.agenteInstrucciones,
      recordatorios_activos: r.data.recordatoriosActivos,
      reactivacion_activa: r.data.reactivacionActiva,
    })
    .eq("id", dueno.inmobiliariaId);
  if (error) return { error: "No se pudo guardar.", valores };
  revalidatePath("/configuracion/agente");
  return { ok: "Guardado. Aplica desde el siguiente mensaje que conteste el agente." };
}
