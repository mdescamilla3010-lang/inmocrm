"use server";

import { revalidatePath } from "next/cache";
import { erroresPorCampo, esquemaPerfil, objetoDeFormulario } from "@/lib/auth/esquemas";
import { requerirUsuario } from "@/lib/auth/sesion";
import type { EstadoFormulario } from "@/lib/formularios";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { crearClienteServidor } from "@/lib/supabase/server";

export async function guardarPerfil(_: EstadoFormulario, fd: FormData): Promise<EstadoFormulario> {
  const usuario = await requerirUsuario();
  const valores = objetoDeFormulario(fd);
  const r = esquemaPerfil.safeParse(valores);
  if (!r.success) return { errores: erroresPorCampo(r.error), valores };

  // Cliente con sesión: RLS y el trigger sólo le permiten editar su propio perfil.
  const supabase = await crearClienteServidor();
  const { error } = await supabase
    .from("usuarios")
    .update({ nombre: r.data.nombre, telefono: r.data.telefono, google_calendar_id: r.data.googleCalendarId })
    .eq("id", usuario.id);
  if (error) return { error: "No se pudo guardar.", valores };
  revalidatePath("/perfil");
  return { ok: "Perfil guardado." };
}

export async function desconectarGoogle() {
  const usuario = await requerirUsuario();
  // Los usuarios no pueden escribir integraciones; se borra con la llave de
  // servidor, filtrando por el usuario y la inmobiliaria de la sesión.
  const admin = crearClienteAdmin();
  await admin
    .from("integraciones")
    .delete()
    .eq("inmobiliaria_id", usuario.inmobiliariaId)
    .eq("usuario_id", usuario.id)
    .eq("proveedor", "google_calendar");
  revalidatePath("/perfil");
}
