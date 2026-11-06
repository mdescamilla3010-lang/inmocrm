"use client";

import { useActionState, useTransition } from "react";
import { AreaTexto } from "@/components/ui/area-texto";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { estadoInicial, type EstadoFormulario } from "@/lib/formularios";

type Accion = () => Promise<void>;

export function BotonesControlIA(props: { iaActiva: boolean; requiereAtencion: boolean; tomar: Accion; devolver: Accion; atendido: Accion }) {
  const [pendiente, iniciar] = useTransition();
  const boton = "rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60";
  return (
    <div className="flex flex-wrap gap-2">
      {props.requiereAtencion && props.iaActiva ? (
        <button type="button" disabled={pendiente} onClick={() => iniciar(props.atendido)} className={boton}>
          Marcar como atendido
        </button>
      ) : null}
      {props.iaActiva ? (
        <button type="button" disabled={pendiente} onClick={() => iniciar(props.tomar)} className={boton}>
          Tomar la conversación
        </button>
      ) : (
        <button type="button" disabled={pendiente} onClick={() => iniciar(props.devolver)} className={boton}>
          Devolver a la IA
        </button>
      )}
    </div>
  );
}

export function FormMensajeAsesor({
  accion,
  iaActiva,
}: {
  accion: (estado: EstadoFormulario, fd: FormData) => Promise<EstadoFormulario>;
  iaActiva: boolean;
}) {
  const [estado, enviar] = useActionState(accion, estadoInicial);
  return (
    <form key={estado.ok} action={enviar} className="space-y-2">
      <AreaTexto
        etiqueta="Escribir por WhatsApp"
        name="texto"
        rows={2}
        defaultValue={estado.valores?.texto}
        error={estado.errores?.texto}
        placeholder="Hola, soy tu asesor…"
      />
      <div className="flex flex-wrap items-center gap-3">
        <BotonEnviar textoEnviando="Enviando…">Enviar</BotonEnviar>
        {iaActiva ? <span className="text-xs text-slate-500">Al enviar, tomas la conversación y la IA deja de contestar.</span> : null}
        {estado.error ? <span className="text-sm text-red-600">{estado.error}</span> : null}
      </div>
    </form>
  );
}
