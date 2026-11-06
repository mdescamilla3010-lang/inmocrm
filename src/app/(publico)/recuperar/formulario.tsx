"use client";

import { useActionState } from "react";
import { Aviso } from "@/components/ui/aviso";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { Campo } from "@/components/ui/campo";
import { estadoInicial } from "@/lib/formularios";
import { recuperarContrasena } from "../acciones";

export function FormularioRecuperar() {
  const [estado, accion] = useActionState(recuperarContrasena, estadoInicial);
  if (estado.ok) return <Aviso tipo="ok">{estado.ok}</Aviso>;
  return (
    <form action={accion} className="space-y-4" noValidate>
      <Campo etiqueta="Correo" name="email" type="email" autoComplete="email" required error={estado.errores?.email} />
      <BotonEnviar className="w-full">Enviar enlace</BotonEnviar>
    </form>
  );
}
