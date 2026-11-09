import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { obtenerSesion } from "@/lib/auth/sesion";
import { crearClienteServidor } from "@/lib/supabase/server";
import { generarSlug } from "@/lib/slug";
import { FormularioBienvenida } from "./formulario";

export const metadata: Metadata = { title: "Bienvenida" };

export default async function PaginaBienvenida() {
  const sesion = await obtenerSesion();
  if (!sesion) redirect("/login");
  if (sesion.desactivado) redirect("/sin-acceso");
  if (sesion.usuario) redirect("/leads");

  // Datos que el dueño capturó al registrarse (user_metadata).
  const supabase = await crearClienteServidor();
  const { data } = await supabase.auth.getUser();
  const meta = data.user?.user_metadata ?? {};
  const nombreInmobiliaria = typeof meta.nombre_inmobiliaria === "string" ? meta.nombre_inmobiliaria : "";

  return (
    <>
      <h1 className="text-xl font-semibold">Da de alta tu inmobiliaria</h1>
      <p className="mt-1 text-sm text-slate-600">Un último paso. Quedarás como dueño y podrás invitar a tu equipo.</p>
      <div className="mt-6">
        <FormularioBienvenida
          inicial={{
            nombreDueno: typeof meta.nombre === "string" ? meta.nombre : "",
            nombreInmobiliaria,
            slug: generarSlug(nombreInmobiliaria),
          }}
        />
      </div>
    </>
  );
}
