"use client";

import { useTransition } from "react";

type Accion = () => Promise<void>;

export function AccionesCita(props: { estado: string; confirmar: Accion; realizada: Accion; noAsistio: Accion; cancelar: Accion; yaPaso: boolean }) {
  const [pendiente, iniciar] = useTransition();
  if (props.estado !== "programada" && props.estado !== "confirmada") return null;
  const boton = "rounded-md border border-slate-300 bg-white px-2 py-1 text-xs font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60";
  return (
    <div className="flex flex-wrap gap-1">
      {props.estado === "programada" && !props.yaPaso ? (
        <button type="button" disabled={pendiente} className={boton} onClick={() => iniciar(props.confirmar)}>
          Confirmada
        </button>
      ) : null}
      <button type="button" disabled={pendiente} className={boton} onClick={() => iniciar(props.realizada)}>
        Realizada
      </button>
      <button type="button" disabled={pendiente} className={boton} onClick={() => iniciar(props.noAsistio)}>
        No asistió
      </button>
      <button
        type="button"
        disabled={pendiente}
        className={`${boton} text-red-700`}
        onClick={() => {
          if (confirm("¿Cancelar esta visita? Se borra también del Google Calendar del asesor.")) iniciar(props.cancelar);
        }}
      >
        Cancelar
      </button>
    </div>
  );
}
