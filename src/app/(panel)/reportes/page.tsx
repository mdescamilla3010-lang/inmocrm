import type { Metadata } from "next";
import Link from "next/link";
import { PanelReporte } from "@/components/reportes/panel-reporte";
import { Aviso } from "@/components/ui/aviso";
import { requerirDueno } from "@/lib/auth/sesion";
import { primerValor } from "@/lib/busqueda";
import { esquemaReporte } from "@/lib/reportes/formato";
import { esClavePeriodo, PERIODOS, rangoPeriodo } from "@/lib/reportes/periodos";
import { crearClienteServidor } from "@/lib/supabase/server";

export const metadata: Metadata = { title: "Reportes" };

export default async function PaginaReportes({ searchParams }: PageProps<"/reportes">) {
  const dueno = await requerirDueno();
  const sp = await searchParams;
  const valor = primerValor(sp.periodo);
  const clave = esClavePeriodo(valor) ? valor : "30d";
  const zh = dueno.inmobiliaria.zonaHoraria;
  const rango = rangoPeriodo(clave, new Date(), zh);

  // La función corre con la sesión del dueño (RLS + verificación de rol).
  const supabase = await crearClienteServidor();
  const [actual, anterior] = await Promise.all([
    supabase.rpc("reporte_dueno", { p_desde: rango.desde.toISOString(), p_hasta: rango.hasta.toISOString() }),
    supabase.rpc("reporte_dueno", { p_desde: rango.anteriorDesde.toISOString(), p_hasta: rango.anteriorHasta.toISOString() }),
  ]);
  const r = esquemaReporte.safeParse(actual.data);
  const a = esquemaReporte.safeParse(anterior.data);

  return (
    <section className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Reportes</h1>
          <p className="mt-1 text-sm text-slate-600">
            {rango.etiqueta} · {dueno.inmobiliaria.nombre}
          </p>
        </div>
        <nav aria-label="Periodo" className="flex flex-wrap gap-1 rounded-lg bg-slate-100 p-1 text-sm">
          {PERIODOS.map((p) => (
            <Link
              key={p.clave}
              href={`/reportes?periodo=${p.clave}`}
              aria-current={p.clave === clave ? "page" : undefined}
              className={`rounded-md px-3 py-1.5 ${p.clave === clave ? "bg-white font-medium shadow-sm" : "text-slate-600 hover:text-slate-900"}`}
            >
              {p.etiqueta}
            </Link>
          ))}
        </nav>
      </div>

      {r.success ? (
        <PanelReporte actual={r.data} anterior={a.success ? a.data : null} zonaHoraria={zh} etiquetaPeriodo={rango.etiqueta} />
      ) : (
        <Aviso tipo="error">No pudimos calcular el reporte. Intenta de nuevo en un momento.</Aviso>
      )}
    </section>
  );
}
