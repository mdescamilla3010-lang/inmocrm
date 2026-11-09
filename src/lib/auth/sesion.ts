import "server-only";
import { cache } from "react";
import { redirect } from "next/navigation";
import { crearClienteServidor } from "@/lib/supabase/server";
import type { Rol } from "./permisos";

export type UsuarioActual = {
  id: string;
  inmobiliariaId: string;
  rol: Rol;
  nombre: string;
  email: string;
  inmobiliaria: { nombre: string; slug: string; zonaHoraria: string };
};

type Sesion = {
  authId: string;
  email: string | null;
  /** null = autenticado pero aún sin inmobiliaria (debe pasar por /bienvenida). */
  usuario: UsuarioActual | null;
  desactivado: boolean;
};

/** Lee la sesión una sola vez por petición (React cache). */
export const obtenerSesion = cache(async (): Promise<Sesion | null> => {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims) return null;

  const authId = data.claims.sub;
  const email = typeof data.claims.email === "string" ? data.claims.email : null;

  const { data: fila } = await supabase
    .from("usuarios")
    .select("id, inmobiliaria_id, rol, nombre, email, activo, inmobiliarias(nombre, slug, zona_horaria)")
    .eq("id", authId)
    .maybeSingle();

  if (!fila) return { authId, email, usuario: null, desactivado: false };
  // Un usuario desactivado ve su fila pero no su inmobiliaria (RLS).
  if (!fila.activo || !fila.inmobiliarias) return { authId, email, usuario: null, desactivado: true };

  return {
    authId,
    email,
    desactivado: false,
    usuario: {
      id: fila.id,
      inmobiliariaId: fila.inmobiliaria_id,
      rol: fila.rol,
      nombre: fila.nombre,
      email: fila.email,
      inmobiliaria: {
        nombre: fila.inmobiliarias.nombre,
        slug: fila.inmobiliarias.slug,
        zonaHoraria: fila.inmobiliarias.zona_horaria,
      },
    },
  };
});

/** Para páginas del panel: exige sesión, inmobiliaria y usuario activo. */
export async function requerirUsuario(): Promise<UsuarioActual> {
  const sesion = await obtenerSesion();
  if (!sesion) redirect("/login");
  if (sesion.desactivado) redirect("/sin-acceso");
  if (!sesion.usuario) redirect("/bienvenida");
  return sesion.usuario;
}

/** Para páginas y acciones exclusivas del dueño. */
export async function requerirDueno(): Promise<UsuarioActual> {
  const usuario = await requerirUsuario();
  if (usuario.rol !== "dueno") redirect("/leads");
  return usuario;
}
