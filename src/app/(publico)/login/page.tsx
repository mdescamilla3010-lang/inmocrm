import type { Metadata } from "next";
import Link from "next/link";
import { Aviso } from "@/components/ui/aviso";
import { FormularioLogin } from "./formulario";

export const metadata: Metadata = { title: "Iniciar sesión" };

const ERRORES: Record<string, string> = {
  enlace: "El enlace no es válido o ya expiró. Pide uno nuevo.",
};

export default async function PaginaLogin({ searchParams }: PageProps<"/login">) {
  const { next, error } = await searchParams;
  const mensajeError = typeof error === "string" ? ERRORES[error] : undefined;
  return (
    <>
      <h1 className="text-xl font-semibold">Inicia sesión</h1>
      <p className="mt-1 text-sm text-slate-600">Entra al panel de tu inmobiliaria.</p>
      <div className="mt-6 space-y-4">
        {mensajeError ? <Aviso tipo="error">{mensajeError}</Aviso> : null}
        <FormularioLogin next={typeof next === "string" ? next : undefined} />
      </div>
      <div className="mt-6 flex justify-between text-sm">
        <Link href="/recuperar" className="text-slate-600 hover:underline">
          Olvidé mi contraseña
        </Link>
        <Link href="/registro" className="font-medium text-emerald-700 hover:underline">
          Registrar mi inmobiliaria
        </Link>
      </div>
    </>
  );
}
