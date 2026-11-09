"use client";

import { useActionState } from "react";
import { Aviso } from "@/components/ui/aviso";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { Campo } from "@/components/ui/campo";
import { estadoInicial } from "@/lib/formularios";
import { iniciarSesion } from "../acciones";

export function FormularioLogin({ next }: { next?: string }) {
  const [estado, accion] = useActionState(iniciarSesion, estadoInicial);
  return (
    <form action={accion} className="space-y-4" noValidate>
      {estado.error ? <Aviso tipo="error">{estado.error}</Aviso> : null}
      {next ? <input type="hidden" name="next" value={next} /> : null}
      <Campo etiqueta="Correo" name="email" type="email" autoComplete="email" required defaultValue={estado.valores?.email} error={estado.errores?.email} />
      <Campo etiqueta="Contraseña" name="password" type="password" autoComplete="current-password" required error={estado.errores?.password} />
      <BotonEnviar textoEnviando="Entrando…" className="w-full">
        Entrar
      </BotonEnviar>
    </form>
  );
}
