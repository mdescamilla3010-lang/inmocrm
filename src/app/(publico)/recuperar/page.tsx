import type { Metadata } from "next";
import Link from "next/link";
import { FormularioRecuperar } from "./formulario";

export const metadata: Metadata = { title: "Recuperar contraseña" };

export default function PaginaRecuperar() {
  return (
    <>
      <h1 className="text-xl font-semibold">¿Olvidaste tu contraseña?</h1>
      <p className="mt-1 text-sm text-slate-600">Te mandamos un enlace para elegir una nueva.</p>
      <div className="mt-6">
        <FormularioRecuperar />
      </div>
      <p className="mt-6 text-center text-sm">
        <Link href="/login" className="text-slate-600 hover:underline">
          Volver a iniciar sesión
        </Link>
      </p>
    </>
  );
}
