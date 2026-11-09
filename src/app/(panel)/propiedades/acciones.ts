"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { erroresPorCampo, objetoDeFormulario } from "@/lib/auth/esquemas";
import { requerirDueno, requerirUsuario } from "@/lib/auth/sesion";
import type { EstadoFormulario } from "@/lib/formularios";
import { esquemaPropiedad } from "@/lib/propiedades/esquemas";
import { BUCKET_FOTOS, esRutaDeLaPropiedad, MAX_FOTOS_POR_PROPIEDAD } from "@/lib/propiedades/fotos";
import { crearClienteServidor } from "@/lib/supabase/server";

// Cliente con sesión en todo: RLS y la política de Storage limitan a la
// inmobiliaria del usuario.

function leerFormulario(fd: FormData) {
  const valores = objetoDeFormulario(fd);
  return { valores, r: esquemaPropiedad.safeParse(valores) };
}

const ERROR_CLAVE = { clave: "Ya hay otra propiedad con esa clave." };

export async function crearPropiedad(_: EstadoFormulario, fd: FormData): Promise<EstadoFormulario> {
  const usuario = await requerirUsuario();
  const { valores, r } = leerFormulario(fd);
  if (!r.success) return { errores: erroresPorCampo(r.error), valores };

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase
    .from("propiedades")
    .insert({ ...r.data, inmobiliaria_id: usuario.inmobiliariaId, creado_por: usuario.id })
    .select("id")
    .single();
  if (error?.code === "23505") return { errores: ERROR_CLAVE, valores };
  if (error || !data) return { error: "No se pudo guardar la propiedad.", valores };
  redirect(`/propiedades/${data.id}?nueva=1`);
}

export async function actualizarPropiedad(id: string, _: EstadoFormulario, fd: FormData): Promise<EstadoFormulario> {
  await requerirUsuario();
  const { valores, r } = leerFormulario(fd);
  if (!r.success) return { errores: erroresPorCampo(r.error), valores };

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.from("propiedades").update(r.data).eq("id", id).select("id");
  if (error?.code === "23505") return { errores: ERROR_CLAVE, valores };
  if (error || !data?.length) return { error: "No se pudo guardar la propiedad.", valores };
  revalidatePath(`/propiedades/${id}`);
  revalidatePath("/propiedades");
  return { ok: "Cambios guardados." };
}

export async function borrarPropiedad(id: string) {
  await requerirDueno();
  const supabase = await crearClienteServidor();
  const { data: fotos } = await supabase.from("propiedad_fotos").select("ruta_storage").eq("propiedad_id", id);
  const { data, error } = await supabase.from("propiedades").delete().eq("id", id).select("id");
  if (error || !data?.length) throw new Error("No se pudo borrar la propiedad");
  if (fotos?.length) await supabase.storage.from(BUCKET_FOTOS).remove(fotos.map((f) => f.ruta_storage));
  revalidatePath("/propiedades");
  redirect("/propiedades");
}

/** Registra fotos que el navegador ya subió a Storage. */
export async function registrarFotos(propiedadId: string, rutas: string[]): Promise<{ error?: string }> {
  const usuario = await requerirUsuario();
  if (!Array.isArray(rutas) || rutas.some((r) => typeof r !== "string")) return { error: "Datos no válidos." };
  const supabase = await crearClienteServidor();

  const { data: propiedad } = await supabase.from("propiedades").select("id").eq("id", propiedadId).maybeSingle();
  if (!propiedad) return { error: "Propiedad no encontrada." };

  const validas = [...new Set(rutas)].filter((r) => esRutaDeLaPropiedad(r, usuario.inmobiliariaId, propiedadId));
  if (!validas.length) return { error: "No hay fotos válidas para registrar." };

  const { data: actuales } = await supabase
    .from("propiedad_fotos")
    .select("orden, es_portada")
    .eq("propiedad_id", propiedadId);
  if ((actuales?.length ?? 0) + validas.length > MAX_FOTOS_POR_PROPIEDAD) {
    return { error: `Máximo ${MAX_FOTOS_POR_PROPIEDAD} fotos por propiedad.` };
  }
  const siguienteOrden = Math.max(-1, ...(actuales ?? []).map((f) => f.orden)) + 1;
  const tienePortada = (actuales ?? []).some((f) => f.es_portada);

  const { error } = await supabase.from("propiedad_fotos").insert(
    validas.map((ruta, i) => ({
      inmobiliaria_id: usuario.inmobiliariaId,
      propiedad_id: propiedadId,
      ruta_storage: ruta,
      orden: siguienteOrden + i,
      es_portada: !tienePortada && i === 0,
    })),
  );
  if (error) return { error: "No se pudieron registrar las fotos." };
  revalidatePath(`/propiedades/${propiedadId}`);
  revalidatePath("/propiedades");
  return {};
}

export async function borrarFoto(propiedadId: string, fotoId: string) {
  await requerirUsuario();
  const supabase = await crearClienteServidor();
  const { data: foto } = await supabase
    .from("propiedad_fotos")
    .delete()
    .eq("id", fotoId)
    .eq("propiedad_id", propiedadId)
    .select("ruta_storage, es_portada")
    .maybeSingle();
  if (!foto) return;
  await supabase.storage.from(BUCKET_FOTOS).remove([foto.ruta_storage]);

  if (foto.es_portada) {
    const { data: siguiente } = await supabase
      .from("propiedad_fotos")
      .select("id")
      .eq("propiedad_id", propiedadId)
      .order("orden")
      .limit(1);
    if (siguiente?.[0]) await supabase.from("propiedad_fotos").update({ es_portada: true }).eq("id", siguiente[0].id);
  }
  revalidatePath(`/propiedades/${propiedadId}`);
  revalidatePath("/propiedades");
}

export async function marcarPortada(propiedadId: string, fotoId: string) {
  await requerirUsuario();
  const supabase = await crearClienteServidor();
  // Primero se quita la portada actual: el índice único permite sólo una.
  await supabase.from("propiedad_fotos").update({ es_portada: false }).eq("propiedad_id", propiedadId).eq("es_portada", true);
  await supabase.from("propiedad_fotos").update({ es_portada: true }).eq("id", fotoId).eq("propiedad_id", propiedadId);
  revalidatePath(`/propiedades/${propiedadId}`);
  revalidatePath("/propiedades");
}
