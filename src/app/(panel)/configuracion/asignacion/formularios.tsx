"use client";

import { useActionState } from "react";
import { AreaTexto } from "@/components/ui/area-texto";
import { Aviso } from "@/components/ui/aviso";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { Campo } from "@/components/ui/campo";
import { estadoInicial, type EstadoFormulario } from "@/lib/formularios";

type Accion = (estado: EstadoFormulario, fd: FormData) => Promise<EstadoFormulario>;
type Asesor = { id: string; nombre: string; recibeLeads: boolean };

export function FormEstrategia({ accion, actual }: { accion: Accion; actual: "round_robin" | "zona" }) {
  const [estado, enviar] = useActionState(accion, estadoInicial);
  const opciones = [
    {
      valor: "round_robin",
      titulo: "Por turno (round robin)",
      detalle: "Cada lead nuevo va al asesor que lleva más tiempo sin recibir uno.",
    },
    {
      valor: "zona",
      titulo: "Por zona",
      detalle: "El lead va a un asesor que cubre la zona que busca. Si no se sabe la zona o nadie la cubre, se reparte por turno.",
    },
  ] as const;
  return (
    <form action={enviar} className="space-y-4">
      <div className="grid gap-3 sm:grid-cols-2">
        {opciones.map((o) => (
          <label key={o.valor} className="flex cursor-pointer gap-3 rounded-lg border border-slate-200 p-4 has-[:checked]:border-emerald-600 has-[:checked]:bg-emerald-50">
            <input type="radio" name="estrategia" value={o.valor} defaultChecked={actual === o.valor} className="mt-1 accent-emerald-700" />
            <span>
              <span className="block text-sm font-semibold">{o.titulo}</span>
              <span className="block text-sm text-slate-600">{o.detalle}</span>
            </span>
          </label>
        ))}
      </div>
      <div className="flex items-center gap-3">
        <BotonEnviar textoEnviando="Guardando…">Guardar estrategia</BotonEnviar>
        {estado.ok ? <span className="text-sm text-emerald-700">{estado.ok}</span> : null}
        {estado.error ? <span className="text-sm text-red-600">{estado.error}</span> : null}
      </div>
    </form>
  );
}

function CasillasAsesores({ asesores, marcados }: { asesores: Asesor[]; marcados: string[] }) {
  if (!asesores.length) return <p className="text-sm text-slate-500">Aún no hay asesores activos.</p>;
  return (
    <fieldset>
      <legend className="mb-1 text-sm font-medium text-slate-700">Asesores que la cubren</legend>
      <div className="flex flex-wrap gap-x-5 gap-y-2">
        {asesores.map((a) => (
          <label key={a.id} className="inline-flex items-center gap-2 text-sm">
            <input type="checkbox" name="asesores" value={a.id} defaultChecked={marcados.includes(a.id)} className="size-4 accent-emerald-700" />
            {a.nombre}
            {!a.recibeLeads ? <span className="text-xs text-slate-400">(no recibe leads)</span> : null}
          </label>
        ))}
      </div>
    </fieldset>
  );
}

export function FormZona(props: {
  accion: Accion;
  asesores: Asesor[];
  inicial?: { nombre: string; alias: string; asesores: string[] };
  nueva?: boolean;
  borrar?: () => Promise<void>;
}) {
  const [estado, enviar] = useActionState(props.accion, estadoInicial);
  const v = { nombre: "", alias: "", ...props.inicial, ...estado.valores };
  const e = estado.errores ?? {};
  return (
    <form key={props.nueva ? estado.ok : undefined} action={enviar} className="space-y-3">
      {estado.error ? <Aviso tipo="error">{estado.error}</Aviso> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Nombre de la zona" name="nombre" defaultValue={v.nombre} error={e.nombre} placeholder="Juriquilla" />
        <AreaTexto etiqueta="Sinónimos (separados por coma)" name="alias" rows={1} defaultValue={v.alias} placeholder="Jurica, Real de Juriquilla" />
      </div>
      <CasillasAsesores asesores={props.asesores} marcados={props.inicial?.asesores ?? []} />
      <div className="flex flex-wrap items-center gap-3">
        <BotonEnviar variante={props.nueva ? "primario" : "secundario"} textoEnviando="Guardando…">
          {props.nueva ? "Agregar zona" : "Guardar"}
        </BotonEnviar>
        {props.borrar ? (
          <button
            type="button"
            onClick={() => {
              if (confirm(`¿Borrar la zona "${v.nombre}"? Los leads y propiedades conservan la zona escrita.`)) props.borrar?.();
            }}
            className="rounded-lg px-3 py-2 text-sm text-red-700 hover:bg-red-50"
          >
            Borrar
          </button>
        ) : null}
        {estado.ok ? <span className="text-sm text-emerald-700">{estado.ok}</span> : null}
      </div>
    </form>
  );
}
