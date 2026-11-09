import type { Metadata } from "next";
import Link from "next/link";
import { FormularioPropiedad } from "@/components/propiedades/formulario-propiedad";
import { requerirUsuario } from "@/lib/auth/sesion";
import { crearPropiedad } from "../acciones";
import { opcionesFormulario } from "../datos";

export const metadata: Metadata = { title: "Nueva propiedad" };

export default async function PaginaNuevaPropiedad() {
  await requerirUsuario();
  const { zonas, asesores } = await opcionesFormulario();
  return (
    <section className="max-w-3xl space-y-6">
      <div>
        <Link href="/propiedades" className="text-sm text-slate-600 hover:underline">
          ← Propiedades
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Nueva propiedad</h1>
        <p className="mt-1 text-sm text-slate-600">Después de guardar podrás subir las fotos.</p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <FormularioPropiedad accion={crearPropiedad} zonas={zonas} asesores={asesores} textoBoton="Guardar y subir fotos" />
      </div>
    </section>
  );
}
