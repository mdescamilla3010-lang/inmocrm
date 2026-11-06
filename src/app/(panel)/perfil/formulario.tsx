"use client";

import { useActionState } from "react";
import { Aviso } from "@/components/ui/aviso";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { Campo } from "@/components/ui/campo";
import { estadoInicial } from "@/lib/formularios";
import { guardarPerfil } from "./acciones";

export function FormularioPerfil({ inicial }: { inicial: Record<"nombre" | "telefono" | "googleCalendarId", string> }) {
  const [estado, enviar] = useActionState(guardarPerfil, estadoInicial);
  const v = { ...inicial, ...estado.valores };
  const e = estado.errores ?? {};
  return (
    <form action={enviar} className="space-y-4" noValidate>
      {estado.error ? <Aviso tipo="error">{estado.error}</Aviso> : null}
      {estado.ok ? <Aviso tipo="ok">{estado.ok}</Aviso> : null}
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="Nombre" name="nombre" defaultValue={v.nombre} error={e.nombre} />
        <Campo
          etiqueta="Tu WhatsApp"
          name="telefono"
          type="tel"
          defaultValue={v.telefono}
          error={e.telefono}
          ayuda="Para avisarte cuando un lead requiere atención."
        />
      </div>
      <details>
        <summary className="cursor-pointer text-sm text-slate-600">Opciones avanzadas</summary>
        <Campo
          etiqueta="Calendario de Google a usar"
          name="googleCalendarId"
          defaultValue={v.googleCalendarId}
          error={e.googleCalendarId}
          className="mt-3 max-w-md"
          ayuda="“primary” es tu calendario principal. Para otro, pega su ID (Configuración del calendario en Google)."
        />
      </details>
      <BotonEnviar textoEnviando="Guardando…">Guardar</BotonEnviar>
    </form>
  );
}
