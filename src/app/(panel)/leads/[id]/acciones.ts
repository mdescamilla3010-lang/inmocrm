"use server";

import { revalidatePath } from "next/cache";
import { erroresPorCampo, objetoDeFormulario } from "@/lib/auth/esquemas";
import { requerirDueno, requerirUsuario } from "@/lib/auth/sesion";
import type { EstadoFormulario } from "@/lib/formularios";
import { esquemaCalificacion, esquemaContacto, esquemaEstado, esquemaNota, esquemaReasignar } from "@/lib/leads/esquemas";
import type { Database } from "@/lib/supabase/database.types";
import { crearClienteServidor } from "@/lib/supabase/server";

// Todas usan el cliente con sesión: RLS decide si el usuario puede tocar el
// lead (dueño: cualquiera de su inmobiliaria; asesor: sólo los suyos).

type CambiosLead = Database["public"]["Tables"]["leads"]["Update"];

async function actualizarLead(leadId: string, cambios: CambiosLead, ok: string): Promise<EstadoFormulario> {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.from("leads").update(cambios).eq("id", leadId).select("id");
  if (error?.code === "23505") return { error: "Ya existe otro lead con ese teléfono." };
  if (error || !data?.length) return { error: "No se pudo guardar. Puede que ya no tengas acceso a este lead." };
  revalidatePath(`/leads/${leadId}`);
  return { ok };
}

export async function cambiarEstado(leadId: string, _: EstadoFormulario, fd: FormData): Promise<EstadoFormulario> {
  await requerirUsuario();
  const r = esquemaEstado.safeParse(objetoDeFormulario(fd));
  if (!r.success) return { error: "Estado no válido." };
  return actualizarLead(leadId, { estado: r.data.estado }, "Estado actualizado.");
}

export async function reasignarLead(leadId: string, _: EstadoFormulario, fd: FormData): Promise<EstadoFormulario> {
  await requerirDueno();
  const r = esquemaReasignar.safeParse(objetoDeFormulario(fd));
  if (!r.success) return { error: "Elige un asesor." };

  const supabase = await crearClienteServidor();
  const { data: asesor } = await supabase.from("usuarios").select("id, activo").eq("id", r.data.asesorId).maybeSingle();
  if (!asesor?.activo) return { error: "Ese asesor no está activo." };

  return actualizarLead(leadId, { asesor_id: asesor.id, asignado_en: new Date().toISOString() }, "Lead reasignado.");
}

export async function guardarCalificacion(leadId: string, _: EstadoFormulario, fd: FormData): Promise<EstadoFormulario> {
  await requerirUsuario();
  const valores = objetoDeFormulario(fd);
  const r = esquemaCalificacion.safeParse(valores);
  if (!r.success) return { errores: erroresPorCampo(r.error), valores };
  const resultado = await actualizarLead(leadId, r.data, "Calificación guardada.");
  return resultado.error ? { ...resultado, valores } : resultado;
}

export async function guardarContacto(leadId: string, _: EstadoFormulario, fd: FormData): Promise<EstadoFormulario> {
  await requerirUsuario();
  const valores = objetoDeFormulario(fd);
  const r = esquemaContacto.safeParse(valores);
  if (!r.success) return { errores: erroresPorCampo(r.error), valores };
  const resultado = await actualizarLead(leadId, r.data, "Contacto guardado.");
  return resultado.error ? { ...resultado, valores } : resultado;
}

export async function agregarNota(leadId: string, _: EstadoFormulario, fd: FormData): Promise<EstadoFormulario> {
  const usuario = await requerirUsuario();
  const valores = objetoDeFormulario(fd);
  const r = esquemaNota.safeParse(valores);
  if (!r.success) return { errores: erroresPorCampo(r.error), valores };

  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("eventos_lead").insert({
    inmobiliaria_id: usuario.inmobiliariaId,
    lead_id: leadId,
    tipo: "nota",
    usuario_id: usuario.id,
    datos: { texto: r.data.texto },
  });
  if (error) return { error: "No se pudo guardar la nota.", valores };
  revalidatePath(`/leads/${leadId}`);
  return { ok: "Nota agregada." };
}
