import type { InputHTMLAttributes } from "react";

type Props = InputHTMLAttributes<HTMLInputElement> & {
  etiqueta: string;
  name: string;
  error?: string;
  ayuda?: string;
};

export function Campo({ etiqueta, name, error, ayuda, className, ...props }: Props) {
  const idAyuda = `${name}-ayuda`;
  return (
    <div className={className}>
      <label htmlFor={name} className="mb-1 block text-sm font-medium text-slate-700">
        {etiqueta}
      </label>
      <input
        id={name}
        name={name}
        aria-invalid={Boolean(error)}
        aria-describedby={error || ayuda ? idAyuda : undefined}
        className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm outline-none placeholder:text-slate-400 focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 aria-[invalid=true]:border-red-500"
        {...props}
      />
      {error ? (
        <p id={idAyuda} className="mt-1 text-sm text-red-600">
          {error}
        </p>
      ) : ayuda ? (
        <p id={idAyuda} className="mt-1 text-sm text-slate-500">
          {ayuda}
        </p>
      ) : null}
    </div>
  );
}
