"use client";

import { useActionState } from "react";
import { Aviso } from "@/components/ui/aviso";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { Campo } from "@/components/ui/campo";
import { DIAS } from "@/lib/calendario/configuracion";
import { estadoInicial } from "@/lib/formularios";
import { guardarAgenda } from "./acciones";

export function FormularioAgenda({ inicial }: { inicial: Record<string, string> }) {
  const [estado, enviar] = useActionState(guardarAgenda, estadoInicial);
  // Tras un error, las casillas sin marcar no vienen en los valores enviados.
  const v = estado.valores ?? inicial;
  const e = estado.errores ?? {};
  const entrada = "rounded-lg border border-slate-300 bg-white px-2 py-1.5 text-sm disabled:bg-slate-100";

  return (
    <form action={enviar} className="space-y-6" noValidate>
      {estado.error ? <Aviso tipo="error">{estado.error}</Aviso> : null}
      {estado.ok ? <Aviso tipo="ok">{estado.ok}</Aviso> : null}
      {e._ ? <Aviso tipo="error">{e._}</Aviso> : null}

      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-slate-900">Horario de visitas (hora local)</legend>
        <div className="divide-y divide-slate-100 rounded-lg border border-slate-200">
          {DIAS.map(({ clave, nombre }) => (
            <div key={clave} className="flex flex-wrap items-center gap-3 px-3 py-2">
              <label className="inline-flex w-32 items-center gap-2 text-sm font-medium">
                <input type="checkbox" name={`abierto_${clave}`} defaultChecked={v[`abierto_${clave}`] === "on"} className="size-4 accent-emerald-700" />
                {nombre}
              </label>
              <input type="time" name={`desde_${clave}`} defaultValue={v[`desde_${clave}`] ?? "09:00"} aria-label={`${nombre} desde`} className={entrada} />
              <span className="text-sm text-slate-500">a</span>
              <input type="time" name={`hasta_${clave}`} defaultValue={v[`hasta_${clave}`] ?? "19:00"} aria-label={`${nombre} hasta`} className={entrada} />
              {e[clave] ? <span className="text-sm text-red-600">{e[clave]}</span> : null}
            </div>
          ))}
        </div>
      </fieldset>

      <div className="grid gap-4 sm:grid-cols-3">
        <Campo etiqueta="Duración de cada visita (min)" name="duracionMin" type="number" min={15} max={240} step={15} defaultValue={v.duracionMin} error={e.duracionMin} />
        <Campo
          etiqueta="Margen entre visitas (min)"
          name="margenMin"
          type="number"
          min={0}
          max={180}
          step={5}
          defaultValue={v.margenMin}
          error={e.margenMin}
          ayuda="Tiempo de traslado antes y después de cada compromiso."
        />
        <Campo
          etiqueta="Anticipación mínima (horas)"
          name="anticipacionHoras"
          type="number"
          min={0}
          max={48}
          step={0.5}
          defaultValue={v.anticipacionHoras}
          error={e.anticipacionHoras}
          ayuda="No se ofrecen visitas que empiecen antes."
        />
      </div>
      <BotonEnviar textoEnviando="Guardando…">Guardar agenda</BotonEnviar>
    </form>
  );
}
