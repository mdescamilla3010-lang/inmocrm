import type { ReactNode } from "react";

export function Aviso({ tipo, children }: { tipo: "error" | "ok" | "info"; children: ReactNode }) {
  const estilos = {
    error: "border-red-200 bg-red-50 text-red-800",
    ok: "border-emerald-200 bg-emerald-50 text-emerald-800",
    info: "border-slate-200 bg-slate-50 text-slate-700",
  }[tipo];
  return (
    <div role={tipo === "error" ? "alert" : "status"} className={`rounded-lg border px-3 py-2 text-sm ${estilos}`}>
      {children}
    </div>
  );
}
