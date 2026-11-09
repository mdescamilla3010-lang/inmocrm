import "server-only";
import { crearClienteServidor } from "@/lib/supabase/server";

/** Opciones de zonas y asesores para el formulario de propiedad. */
export async function opcionesFormulario() {
  const supabase = await crearClienteServidor();
  const [{ data: zonas }, { data: asesores }] = await Promise.all([
    supabase.from("zonas").select("id, nombre").order("nombre"),
    supabase.from("usuarios").select("id, nombre").eq("activo", true).order("nombre"),
  ]);
  return {
    zonas: (zonas ?? []).map((z) => ({ valor: z.id, etiqueta: z.nombre })),
    asesores: (asesores ?? []).map((a) => ({ valor: a.id, etiqueta: a.nombre })),
  };
}
