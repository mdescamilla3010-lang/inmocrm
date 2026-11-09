"use server";

import { redirect } from "next/navigation";
import { envPublico } from "@/lib/env";
import { crearClienteServidor } from "@/lib/supabase/server";
import {
  erroresPorCampo,
  esquemaLogin,
  esquemaRecuperar,
  esquemaRegistro,
  objetoDeFormulario,
} from "@/lib/auth/esquemas";
import { rutaSegura } from "@/lib/auth/rutas";
import type { EstadoFormulario } from "@/lib/formularios";

export async function iniciarSesion(_: EstadoFormulario, fd: FormData): Promise<EstadoFormulario> {
  const valores = objetoDeFormulario(fd);
  const r = esquemaLogin.safeParse(valores);
  if (!r.success) return { errores: erroresPorCampo(r.error), valores: { email: valores.email ?? "" } };

  const supabase = await crearClienteServidor();
  const { error } = await supabase.auth.signInWithPassword({ email: r.data.email, password: r.data.password });
  if (error) {
    const mensaje =
      error.code === "email_not_confirmed"
        ? "Confirma tu correo antes de entrar (revisa tu bandeja)."
        : error.code === "invalid_credentials"
          ? "Correo o contraseña incorrectos."
          : "No pudimos iniciar sesión. Intenta de nuevo.";
    return { error: mensaje, valores: { email: r.data.email } };
  }
  redirect(rutaSegura(r.data.next));
}

export async function registrarse(_: EstadoFormulario, fd: FormData): Promise<EstadoFormulario> {
  const valores = objetoDeFormulario(fd);
  delete valores.password;
  const r = esquemaRegistro.safeParse(objetoDeFormulario(fd));
  if (!r.success) return { errores: erroresPorCampo(r.error), valores };

  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.auth.signUp({
    email: r.data.email,
    password: r.data.password,
    options: {
      emailRedirectTo: `${envPublico().NEXT_PUBLIC_APP_URL}/auth/confirmar?next=/bienvenida`,
      // Se usan para precargar el formulario de /bienvenida.
      data: { nombre: r.data.nombre, nombre_inmobiliaria: r.data.nombreInmobiliaria },
    },
  });
  if (error) {
    const mensaje =
      error.code === "user_already_exists"
        ? "Ya existe una cuenta con ese correo. Inicia sesión."
        : error.code === "weak_password"
          ? "Esa contraseña es muy débil; elige otra."
          : "No pudimos crear tu cuenta. Intenta de nuevo.";
    return { error: mensaje, valores };
  }
  // Sin confirmación de correo (local) hay sesión inmediata.
  if (data.session) redirect("/bienvenida");
  return { ok: `Te enviamos un correo a ${r.data.email}. Da clic en el enlace para continuar.` };
}

export async function recuperarContrasena(_: EstadoFormulario, fd: FormData): Promise<EstadoFormulario> {
  const r = esquemaRecuperar.safeParse(objetoDeFormulario(fd));
  if (!r.success) return { errores: erroresPorCampo(r.error) };

  const supabase = await crearClienteServidor();
  await supabase.auth.resetPasswordForEmail(r.data.email, {
    redirectTo: `${envPublico().NEXT_PUBLIC_APP_URL}/auth/confirmar?next=/nueva-contrasena`,
  });
  // Misma respuesta exista o no la cuenta, para no revelar qué correos están registrados.
  return { ok: "Si el correo está registrado, te llegará un enlace para elegir una contraseña nueva." };
}
