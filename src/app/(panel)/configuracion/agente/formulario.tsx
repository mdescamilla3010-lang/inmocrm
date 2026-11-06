"use client";

import { useActionState } from "react";
import { AreaTexto } from "@/components/ui/area-texto";
import { Aviso } from "@/components/ui/aviso";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { Campo } from "@/components/ui/campo";
import { estadoInicial } from "@/lib/formularios";
import { guardarAgente } from "./acciones";

type Inicial = { agenteNombre: string; agenteInstrucciones: string; recordatoriosActivos: boolean; reactivacionActiva: boolean };

export function FormularioAgente({ inicial }: { inicial: Inicial }) {
  const [estado, enviar] = useActionState(guardarAgente, estadoInicial);
  const v: Record<string, string> = {
    agenteNombre: inicial.agenteNombre,
    agenteInstrucciones: inicial.agenteInstrucciones,
    recordatoriosActivos: inicial.recordatoriosActivos ? "on" : "",
    reactivacionActiva: inicial.reactivacionActiva ? "on" : "",
    // Tras un error, las casillas sin marcar no vienen en los valores enviados.
    ...(estado.valores ? { recordatoriosActivos: "", reactivacionActiva: "" } : {}),
    ...estado.valores,
  };
  const e = estado.errores ?? {};
  return (
    <form action={enviar} className="space-y-4" noValidate>
      {estado.error ? <Aviso tipo="error">{estado.error}</Aviso> : null}
      {estado.ok ? <Aviso tipo="ok">{estado.ok}</Aviso> : null}
      <Campo etiqueta="Nombre del agente" name="agenteNombre" defaultValue={v.agenteNombre} error={e.agenteNombre} className="max-w-xs" />
      <AreaTexto
        etiqueta="Indicaciones para el agente"
        name="agenteInstrucciones"
        rows={8}
        defaultValue={v.agenteInstrucciones}
        error={e.agenteInstrucciones}
        placeholder={
          "Ejemplos:\n- Háblales de usted.\n- Somos especialistas en vivienda nueva en Querétaro desde 2010.\n- Apartado con $20,000; escrituración con notarías aliadas.\n- No ofrecemos propiedades fuera de la zona metropolitana."
        }
      />
      <fieldset className="space-y-2">
        <legend className="mb-1 text-sm font-semibold text-slate-900">Seguimiento automático por WhatsApp</legend>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="recordatoriosActivos" defaultChecked={v.recordatoriosActivos === "on"} className="mt-0.5 size-4 accent-emerald-700" />
          <span>
            <span className="font-medium">Recordatorios de visita</span> 24 h y 2 h antes.
          </span>
        </label>
        <label className="flex items-start gap-2 text-sm">
          <input type="checkbox" name="reactivacionActiva" defaultChecked={v.reactivacionActiva === "on"} className="mt-0.5 size-4 accent-emerald-700" />
          <span>
            <span className="font-medium">Reactivar leads fríos</span> a los 3, 7 y 15 días sin respuesta (sólo fríos o que nunca contestaron, sin visita
            agendada y que no atienda un asesor).
          </span>
        </label>
        <p className="text-xs text-slate-500">Fuera de la ventana de 24 h se usan las plantillas configuradas en Integraciones.</p>
      </fieldset>
      <BotonEnviar textoEnviando="Guardando…">Guardar</BotonEnviar>
    </form>
  );
}
