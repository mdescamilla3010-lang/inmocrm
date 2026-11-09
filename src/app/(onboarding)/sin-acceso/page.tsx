import type { Metadata } from "next";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { cerrarSesion } from "@/app/acciones-sesion";

export const metadata: Metadata = { title: "Acceso desactivado" };

export default function PaginaSinAcceso() {
  return (
    <>
      <h1 className="text-xl font-semibold">Tu acceso está desactivado</h1>
      <p className="mt-2 text-sm text-slate-600">
        El dueño de tu inmobiliaria desactivó tu cuenta. Si crees que es un error, pídele que la vuelva a activar desde
        Equipo.
      </p>
      <form action={cerrarSesion} className="mt-6">
        <BotonEnviar variante="secundario" textoEnviando="Saliendo…" className="w-full">
          Cerrar sesión
        </BotonEnviar>
      </form>
    </>
  );
}
