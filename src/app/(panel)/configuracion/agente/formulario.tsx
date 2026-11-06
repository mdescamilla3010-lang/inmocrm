"use client";

import { useActionState } from "react";
import { AreaTexto } from "@/components/ui/area-texto";
import { Aviso } from "@/components/ui/aviso";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { Campo } from "@/components/ui/campo";
import { estadoInicial } from "@/lib/formularios";
import { guardarAgente } from "./acciones";

export function FormularioAgente({ inicial }: { inicial: { agenteNombre: string; agenteInstrucciones: string } }) {
  const [estado, enviar] = useActionState(guardarAgente, estadoInicial);
  const v = { ...inicial, ...estado.valores };
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
      <BotonEnviar textoEnviando="Guardando…">Guardar</BotonEnviar>
    </form>
  );
}
