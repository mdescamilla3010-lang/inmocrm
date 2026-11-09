import type { ReactNode } from "react";

const TONOS = {
  gris: "bg-slate-100 text-slate-700 ring-slate-200",
  verde: "bg-emerald-50 text-emerald-800 ring-emerald-200",
  azul: "bg-sky-50 text-sky-800 ring-sky-200",
  ambar: "bg-amber-50 text-amber-800 ring-amber-200",
  rojo: "bg-red-50 text-red-700 ring-red-200",
  violeta: "bg-violet-50 text-violet-800 ring-violet-200",
} as const;

export type Tono = keyof typeof TONOS;

export function Insignia({ tono = "gris", children }: { tono?: Tono; children: ReactNode }) {
  return (
    <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ring-1 ring-inset ${TONOS[tono]}`}>
      {children}
    </span>
  );
}
