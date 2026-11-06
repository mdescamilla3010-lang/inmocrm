import type { ReactNode } from "react";

export function TarjetaCentrada({ children }: { children: ReactNode }) {
  return (
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md">
        <p className="mb-6 text-center text-2xl font-bold tracking-tight text-emerald-800">InmoCRM</p>
        <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm sm:p-8">{children}</div>
      </div>
    </main>
  );
}
