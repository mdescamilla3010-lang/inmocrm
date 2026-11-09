import type { ReactNode } from "react";
import { topeEje, type Variacion } from "@/lib/reportes/formato";

/*
 * Gráficas en HTML/CSS (sin librería). Reglas de la guía de visualización:
 * una serie → un color, barras ≤ 24 px con punta redondeada y base recta,
 * valor en la punta, rejilla recesiva, tooltip al pasar el mouse o con el
 * teclado (cada barra es enfocable) y los mismos datos en tabla.
 */

export function Variacion({ v, contra }: { v: Variacion | null; contra: string }) {
  if (!v) return <p className="text-xs text-slate-500">Sin comparación</p>;
  const color =
    v.calificacion === "buena" ? "text-[var(--viz-bueno-texto)]" : v.calificacion === "mala" ? "text-[var(--viz-malo-texto)]" : "text-slate-500";
  const icono = v.sentido === "sube" ? "▲" : v.sentido === "baja" ? "▼" : "＝";
  return (
    <p className="text-xs text-slate-500">
      <span className={`font-medium ${color}`}>
        <span aria-hidden="true">{icono}</span> {v.texto}
        <span className="sr-only">{v.calificacion === "buena" ? " (mejor)" : v.calificacion === "mala" ? " (peor)" : ""}</span>
      </span>{" "}
      {v.sentido === "igual" ? "" : contra}
    </p>
  );
}

export function TarjetaIndicador(props: { etiqueta: string; valor: string; detalle?: ReactNode; variacion: Variacion | null; contra: string; destacado?: boolean }) {
  return (
    <div className={`rounded-xl border border-slate-200 bg-white p-5 ${props.destacado ? "col-span-2" : ""}`}>
      <p className="text-sm text-slate-600">{props.etiqueta}</p>
      <p className={`mt-1 font-semibold tracking-tight text-slate-900 ${props.destacado ? "text-5xl" : "text-3xl"}`}>{props.valor}</p>
      {props.detalle ? <p className="mt-1 text-sm text-slate-600">{props.detalle}</p> : null}
      <div className="mt-2">
        <Variacion v={props.variacion} contra={props.contra} />
      </div>
    </div>
  );
}

function Tooltip({ children, lado = "arriba" }: { children: ReactNode; lado?: "arriba" | "inicio" }) {
  return (
    <span
      role="tooltip"
      className={`pointer-events-none absolute z-10 hidden whitespace-nowrap rounded-md bg-slate-900 px-2 py-1 text-xs text-white shadow-lg group-hover:block group-focus:block ${
        lado === "arriba" ? "bottom-full left-1/2 mb-1 -translate-x-1/2" : "bottom-full left-0 mb-1"
      }`}
    >
      {children}
    </span>
  );
}

export type FilaBarra = { clave: string; etiqueta: string; valor: number; textoValor: string; tooltip: string };

/** Barras horizontales de una sola serie, valor en la punta. Sin eje: la más larga ocupa todo el ancho. */
export function BarrasHorizontales({ filas, titulo }: { filas: FilaBarra[]; titulo: string }) {
  const tope = Math.max(1, ...filas.map((f) => f.valor));
  return (
    <ul className="space-y-2" aria-label={titulo}>
      {filas.map((f) => (
        <li key={f.clave} className="grid grid-cols-[minmax(7rem,10rem)_1fr] items-center gap-3 text-sm">
          <span className="truncate text-slate-700" title={f.etiqueta}>
            {f.etiqueta}
          </span>
          <span className="flex items-center gap-2">
            <span
              tabIndex={0}
              aria-label={f.tooltip}
              className="group relative block h-5 min-w-[2px] rounded-r bg-[var(--viz-serie)] outline-none hover:bg-[var(--viz-serie-hover)] focus-visible:ring-2 focus-visible:ring-slate-900"
              style={{ width: `${(f.valor / tope) * 100}%` }}
            >
              <Tooltip lado="inicio">{f.tooltip}</Tooltip>
            </span>
            <span className="shrink-0 tabular-nums text-slate-700">{f.textoValor}</span>
          </span>
        </li>
      ))}
    </ul>
  );
}

export type ColumnaDia = { clave: string; etiquetaCorta: string; valor: number; tooltip: string };

/** Columnas por día: eje con 0 y tope redondo; sólo se rotula el máximo y el último día. */
export function ColumnasPorDia({ columnas, titulo }: { columnas: ColumnaDia[]; titulo: string }) {
  if (!columnas.length) return null;
  const maximo = Math.max(0, ...columnas.map((c) => c.valor));
  const tope = topeEje(maximo);
  const iMax = columnas.findIndex((c) => c.valor === maximo);
  const ultima = columnas.length - 1;
  const rotular = new Set([iMax, ultima]);
  const marcasX = new Set([0, Math.floor(ultima / 2), ultima]);

  return (
    <div role="img" aria-label={titulo} className="text-xs text-slate-500">
      <div className="flex">
        <div className="flex h-44 w-8 shrink-0 flex-col justify-between pr-1 text-right tabular-nums">
          <span>{tope}</span>
          <span>0</span>
        </div>
        <div className="relative flex h-44 flex-1 items-end gap-[2px] border-b border-[var(--viz-grid)]">
          <div className="pointer-events-none absolute inset-x-0 top-0 border-t border-[var(--viz-grid)]" />
          {columnas.map((c, i) => (
            <div key={c.clave} className="flex h-full min-w-0 flex-1 flex-col items-center justify-end">
              {rotular.has(i) && c.valor > 0 ? <span className="mb-0.5 tabular-nums text-slate-700">{c.valor}</span> : null}
              <span
                tabIndex={0}
                aria-label={c.tooltip}
                className="group relative block w-full max-w-6 rounded-t bg-[var(--viz-serie)] outline-none hover:bg-[var(--viz-serie-hover)] focus-visible:ring-2 focus-visible:ring-slate-900"
                style={{ height: c.valor ? `${(c.valor / tope) * 100}%` : "0px" }}
              >
                <Tooltip>{c.tooltip}</Tooltip>
              </span>
            </div>
          ))}
        </div>
      </div>
      <div className="ml-8 mt-1 flex">
        {columnas.map((c, i) => (
          <span key={c.clave} className="min-w-0 flex-1 text-center">
            {marcasX.has(i) ? c.etiquetaCorta : ""}
          </span>
        ))}
      </div>
    </div>
  );
}
