"use client";

import { useActionState } from "react";
import { Aviso } from "@/components/ui/aviso";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { Campo } from "@/components/ui/campo";
import { estadoInicial } from "@/lib/formularios";
import { guardarNuevaContrasena } from "../acciones";

export function FormularioNuevaContrasena() {
  const [estado, accion] = useActionState(guardarNuevaContrasena, estadoInicial);
  return (
    <form action={accion} className="space-y-4" noValidate>
      {estado.error ? <Aviso tipo="error">{estado.error}</Aviso> : null}
      <Campo etiqueta="Contraseña nueva" name="password" type="password" autoComplete="new-password" required minLength={8} ayuda="Mínimo 8 caracteres." error={estado.errores?.password} />
      <Campo etiqueta="Repite la contraseña" name="confirmacion" type="password" autoComplete="new-password" required error={estado.errores?.confirmacion} />
      <BotonEnviar textoEnviando="Guardando…" className="w-full">
        Guardar y entrar
      </BotonEnviar>
    </form>
  );
}
