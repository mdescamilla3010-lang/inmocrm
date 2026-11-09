import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { obtenerSesion } from "@/lib/auth/sesion";
import { FormularioNuevaContrasena } from "./formulario";

export const metadata: Metadata = { title: "Elige tu contraseña" };

/** Llegan aquí los asesores invitados y quien pidió recuperar su contraseña. */
export default async function PaginaNuevaContrasena() {
  const sesion = await obtenerSesion();
  if (!sesion) redirect("/login?error=enlace");
  const saludo = sesion.usuario ? `Hola, ${sesion.usuario.nombre.split(" ")[0]}.` : "Hola.";
  return (
    <>
      <h1 className="text-xl font-semibold">Elige tu contraseña</h1>
      <p className="mt-1 text-sm text-slate-600">
        {saludo} {sesion.usuario ? `Vas a entrar a ${sesion.usuario.inmobiliaria.nombre}.` : null}
      </p>
      <div className="mt-6">
        <FormularioNuevaContrasena />
      </div>
    </>
  );
}
