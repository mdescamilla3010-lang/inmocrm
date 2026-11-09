"use server";

import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import {
  erroresPorCampo,
  esquemaCrearInmobiliaria,
  esquemaNuevaContrasena,
  objetoDeFormulario,
} from "@/lib/auth/esquemas";
import { obtenerSesion } from "@/lib/auth/sesion";
import type { EstadoFormulario } from "@/lib/formularios";

export async function crearInmobiliaria(_: EstadoFormulario, fd: FormData): Promise<EstadoFormulario> {
  const valores = objetoDeFormulario(fd);
  const sesion = await obtenerSesion();
  if (!sesion) redirect("/login");
  if (sesion.usuario) redirect("/leads");

  const r = esquemaCrearInmobiliaria.safeParse(valores);
  if (!r.success) return { errores: erroresPorCampo(r.error), valores };

  const supabase = await crearClienteServidor();
  const { error } = await supabase.rpc("crear_inmobiliaria", {
    p_nombre: r.data.nombreInmobiliaria,
    p_slug: r.data.slug,
    p_nombre_dueno: r.data.nombreDueno,
  });
  if (error) {
    if (error.code === "23505") {
      return { errores: { slug: "Ese identificador ya está en uso; elige otro." }, valores: { ...valores, slug: r.data.slug } };
    }
    return { error: "No pudimos crear la inmobiliaria. Intenta de nuevo.", valores };
  }
  redirect("/leads");
}

export async function guardarNuevaContrasena(_: EstadoFormulario, fd: FormData): Promise<EstadoFormulario> {
  const r = esquemaNuevaContrasena.safeParse(objetoDeFormulario(fd));
  if (!r.success) return { errores: erroresPorCampo(r.error) };

  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.updateUser({ password: r.data.password });
  if (error) {
    return {
      error:
        error.code === "same_password"
          ? "La contraseña nueva debe ser distinta a la anterior."
          : "No pudimos guardar la contraseña. Pide un enlace nuevo.",
    };
  }
  redirect("/leads");
}
