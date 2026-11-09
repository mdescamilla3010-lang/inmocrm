import Link from "next/link";
import type { ComponentProps } from "react";

export function EnlaceBoton({ className = "", ...props }: ComponentProps<typeof Link>) {
  return (
    <Link
      className={`inline-flex items-center justify-center rounded-lg bg-emerald-700 px-4 py-2 text-sm font-semibold text-white shadow-sm hover:bg-emerald-800 ${className}`}
      {...props}
    />
  );
}
