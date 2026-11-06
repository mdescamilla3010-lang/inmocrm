import type { SelectHTMLAttributes } from "react";

type Opcion = { valor: string; etiqueta: string };

type Props = SelectHTMLAttributes<HTMLSelectElement> & {
  etiqueta: string;
  name: string;
  opciones: readonly Opcion[];
  /** Texto de la opción vacía; si se omite no hay opción vacía. */
  vacio?: string;
  error?: string;
};

export function Selector({ etiqueta, name, opciones, vacio, error, className, ...props }: Props) {
  return (
    <div className={className}>
      <label htmlFor={name} className="mb-1 block text-sm font-medium text-slate-700">
        {etiqueta}
      </label>
      <select
        id={name}
        name={name}
        aria-invalid={Boolean(error)}
        className="block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 shadow-sm focus:border-emerald-600 focus:ring-2 focus:ring-emerald-600/20 aria-[invalid=true]:border-red-500"
        {...props}
      >
        {vacio !== undefined ? <option value="">{vacio}</option> : null}
        {opciones.map((o) => (
          <option key={o.valor} value={o.valor}>
            {o.etiqueta}
          </option>
        ))}
      </select>
      {error ? <p className="mt-1 text-sm text-red-600">{error}</p> : null}
    </div>
  );
}
