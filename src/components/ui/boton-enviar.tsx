"use client";

import { useFormStatus } from "react-dom";
import type { ReactNode } from "react";

type Props = {
  children: ReactNode;
  textoEnviando?: string;
  variante?: "primario" | "secundario";
  className?: string;
};

const VARIANTES = {
  primario: "bg-emerald-700 text-white hover:bg-emerald-800",
  secundario: "border border-slate-300 bg-white text-slate-700 hover:bg-slate-50",
};

export function BotonEnviar({ children, textoEnviando = "Enviando…", variante = "primario", className = "" }: Props) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={`inline-flex items-center justify-center rounded-lg px-4 py-2 text-sm font-semibold shadow-sm transition disabled:cursor-not-allowed disabled:opacity-60 ${VARIANTES[variante]} ${className}`}
    >
      {pending ? textoEnviando : children}
    </button>
  );
}
