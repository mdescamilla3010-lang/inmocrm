"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

export function PestanasConfiguracion({ pestanas }: { pestanas: { href: string; etiqueta: string }[] }) {
  const pathname = usePathname();
  return (
    <nav className="flex gap-1 overflow-x-auto border-b border-slate-200" aria-label="Configuración">
      {pestanas.map((p) => {
        const activa = pathname.startsWith(p.href);
        return (
          <Link
            key={p.href}
            href={p.href}
            aria-current={activa ? "page" : undefined}
            className={`-mb-px whitespace-nowrap border-b-2 px-4 py-2 text-sm font-medium ${
              activa ? "border-emerald-700 text-emerald-800" : "border-transparent text-slate-600 hover:text-slate-900"
            }`}
          >
            {p.etiqueta}
          </Link>
        );
      })}
    </nav>
  );
}
