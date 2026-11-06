"use client";

import { useActionState } from "react";
import { AreaTexto } from "@/components/ui/area-texto";
import { Aviso } from "@/components/ui/aviso";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { estadoInicial, type EstadoFormulario } from "@/lib/formularios";

type Opcion = { valor: string; etiqueta: string };

export function FormAgendar(props: {
  accion: (estado: EstadoFormulario, fd: FormData) => Promise<EstadoFormulario>;
  /** Horarios libres agrupados por día. */
  dias: { dia: string; horarios: Opcion[] }[];
  propiedades: Opcion[];
  propiedadInicial: string | null;
}) {
  const [estado, enviar] = useActionState(props.accion, estadoInicial);
  const e = estado.errores ?? {};
  const campo = "block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 shadow-sm";
  return (
    <form key={estado.ok} action={enviar} className="space-y-3" noValidate>
      {estado.error ? <Aviso tipo="error">{estado.error}</Aviso> : null}
      {estado.ok ? <Aviso tipo="ok">{estado.ok}</Aviso> : null}
      <div>
        <label htmlFor="inicio" className="mb-1 block text-sm font-medium text-slate-700">
          Horario libre del asesor
        </label>
        <select id="inicio" name="inicio" defaultValue={estado.valores?.inicio ?? ""} className={campo}>
          <option value="">{props.dias.length ? "Elige un horario…" : "No hay horarios libres en los próximos días"}</option>
          {props.dias.map((d) => (
            <optgroup key={d.dia} label={d.dia}>
              {d.horarios.map((h) => (
                <option key={h.valor} value={h.valor}>
                  {h.etiqueta}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
        {e.inicio ? <p className="mt-1 text-sm text-red-600">{e.inicio}</p> : null}
      </div>
      <details>
        <summary className="cursor-pointer text-sm text-slate-600">Otro horario (ya lo acordaron fuera del horario de visitas)</summary>
        <input type="datetime-local" name="manual" defaultValue={estado.valores?.manual} aria-label="Fecha y hora" className={`${campo} mt-2`} />
        {e.manual ? <p className="mt-1 text-sm text-red-600">{e.manual}</p> : null}
      </details>
      <div>
        <label htmlFor="propiedadId" className="mb-1 block text-sm font-medium text-slate-700">
          Propiedad a visitar
        </label>
        <select id="propiedadId" name="propiedadId" defaultValue={estado.valores?.propiedadId ?? props.propiedadInicial ?? ""} className={campo}>
          <option value="">Por definir</option>
          {props.propiedades.map((p) => (
            <option key={p.valor} value={p.valor}>
              {p.etiqueta}
            </option>
          ))}
        </select>
      </div>
      <AreaTexto etiqueta="Notas para la visita" name="notas" rows={2} defaultValue={estado.valores?.notas} />
      <BotonEnviar textoEnviando="Agendando…">Agendar visita</BotonEnviar>
    </form>
  );
}
