"use server";

import { revalidatePath } from "next/cache";
import { erroresPorCampo } from "@/lib/auth/esquemas";
import { requerirDueno } from "@/lib/auth/sesion";
import { esquemaEstrategia, esquemaZona } from "@/lib/asignacion/esquemas";
import type { EstadoFormulario } from "@/lib/formularios";
import { crearClienteServidor } from "@/lib/supabase/server";

const RUTA = "/configuracion/asignacion";

function leerZona(fd: FormData) {
  return esquemaZona.safeParse({
    nombre: fd.get("nombre"),
    alias: fd.get("alias") ?? "",
    asesores: fd.getAll("asesores").filter((v) => typeof v === "string"),
  });
}

export async function guardarEstrategia(_: EstadoFormulario, fd: FormData): Promise<EstadoFormulario> {
  const dueno = await requerirDueno();
  const r = esquemaEstrategia.safeParse({ estrategia: fd.get("estrategia") });
  if (!r.success) return { error: "Elige una estrategia." };
  const supabase = await crearClienteServidor();
  const { error } = await supabase
    .from("inmobiliarias")
    .update({ estrategia_asignacion: r.data.estrategia })
    .eq("id", dueno.inmobiliariaId);
  if (error) return { error: "No se pudo guardar." };
  revalidatePath(RUTA);
  return { ok: "Estrategia guardada." };
}

async function reemplazarAsesores(inmobiliariaId: string, zonaId: string, asesores: string[]) {
  const supabase = await crearClienteServidor();
  await supabase.from("asesor_zonas").delete().eq("zona_id", zonaId);
  if (asesores.length) {
    // FK compuesta: un asesor de otra inmobiliaria haría fallar el insert.
    await supabase.from("asesor_zonas").insert(asesores.map((asesor_id) => ({ inmobiliaria_id: inmobiliariaId, asesor_id, zona_id: zonaId })));
  }
}

export async function crearZona(_: EstadoFormulario, fd: FormData): Promise<EstadoFormulario> {
  const dueno = await requerirDueno();
  const r = leerZona(fd);
  if (!r.success) return { errores: erroresPorCampo(r.error), valores: { nombre: String(fd.get("nombre") ?? ""), alias: String(fd.get("alias") ?? "") } };

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("zonas")
    .insert({ inmobiliaria_id: dueno.inmobiliariaId, nombre: r.data.nombre, alias: r.data.alias })
    .select("id")
    .single();
  if (error?.code === "23505") return { errores: { nombre: "Ya existe una zona con ese nombre." } };
  if (error || !data) return { error: "No se pudo crear la zona." };
  await reemplazarAsesores(dueno.inmobiliariaId, data.id, r.data.asesores);
  revalidatePath(RUTA);
  return { ok: `Zona "${r.data.nombre}" creada.` };
}

export async function actualizarZona(zonaId: string, _: EstadoFormulario, fd: FormData): Promise<EstadoFormulario> {
  const dueno = await requerirDueno();
  const r = leerZona(fd);
  if (!r.success) return { errores: erroresPorCampo(r.error) };

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.from("zonas").update({ nombre: r.data.nombre, alias: r.data.alias }).eq("id", zonaId).select("id");
  if (error?.code === "23505") return { errores: { nombre: "Ya existe una zona con ese nombre." } };
  if (error || !data?.length) return { error: "No se pudo guardar la zona." };
  await reemplazarAsesores(dueno.inmobiliariaId, zonaId, r.data.asesores);
  revalidatePath(RUTA);
  return { ok: "Guardado." };
}

export async function borrarZona(zonaId: string) {
  await requerirDueno();
  const supabase = await crearClienteServidor();
  // Leads y propiedades conservan su zona en texto; la FK pone zona_id en null.
  await supabase.from("zonas").delete().eq("id", zonaId);
  revalidatePath(RUTA);
}
