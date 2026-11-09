import type { Metadata } from "next";
import Link from "next/link";
import { requerirUsuario } from "@/lib/auth/sesion";
import { crearClienteServidor } from "@/lib/supabase/server";
import { FormularioLeadNuevo } from "./formulario";

export const metadata: Metadata = { title: "Nuevo lead" };

export default async function PaginaLeadNuevo() {
  const usuario = await requerirUsuario();
  let asesores: { id: string; nombre: string }[] | null = null;
  if (usuario.rol === "dueno") {
    const supabase = await crearClienteServidor();
    const { data } = await supabase.from("usuarios").select("id, nombre").eq("activo", true).order("nombre");
    asesores = data ?? [];
  }
  return (
    <section className="max-w-2xl space-y-6">
      <div>
        <Link href="/leads" className="text-sm text-slate-600 hover:underline">
          ← Leads
        </Link>
        <h1 className="mt-2 text-2xl font-semibold tracking-tight">Nuevo lead</h1>
        <p className="mt-1 text-sm text-slate-600">Para prospectos que llegaron por teléfono, en persona o por recomendación.</p>
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <FormularioLeadNuevo asesores={asesores} />
      </div>
    </section>
  );
}
