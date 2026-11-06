import type { Metadata } from "next";
import Link from "next/link";
import { FormularioRegistro } from "./formulario";

export const metadata: Metadata = { title: "Registrar inmobiliaria" };

export default function PaginaRegistro() {
  return (
    <>
      <h1 className="text-xl font-semibold">Registra tu inmobiliaria</h1>
      <p className="mt-1 text-sm text-slate-600">Crea tu cuenta de dueño o director. Después invitas a tus asesores.</p>
      <div className="mt-6">
        <FormularioRegistro />
      </div>
      <p className="mt-6 text-center text-sm text-slate-600">
        ¿Ya tienes cuenta?{" "}
        <Link href="/login" className="font-medium text-emerald-700 hover:underline">
          Inicia sesión
        </Link>
      </p>
    </>
  );
}
