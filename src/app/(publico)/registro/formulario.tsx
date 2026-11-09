"use client";

import { useActionState } from "react";
import { Aviso } from "@/components/ui/aviso";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { Campo } from "@/components/ui/campo";
import { estadoInicial } from "@/lib/formularios";
import { registrarse } from "../acciones";

export function FormularioRegistro() {
  const [estado, accion] = useActionState(registrarse, estadoInicial);
  if (estado.ok) return <Aviso tipo="ok">{estado.ok}</Aviso>;
  const v = estado.valores ?? {};
  const e = estado.errores ?? {};
  return (
    <form action={accion} className="space-y-4" noValidate>
      {estado.error ? <Aviso tipo="error">{estado.error}</Aviso> : null}
      <Campo etiqueta="Tu nombre" name="nombre" autoComplete="name" required defaultValue={v.nombre} error={e.nombre} />
      <Campo etiqueta="Nombre de la inmobiliaria" name="nombreInmobiliaria" autoComplete="organization" required defaultValue={v.nombreInmobiliaria} error={e.nombreInmobiliaria} />
      <Campo etiqueta="Correo" name="email" type="email" autoComplete="email" required defaultValue={v.email} error={e.email} />
      <Campo etiqueta="Contraseña" name="password" type="password" autoComplete="new-password" required minLength={8} ayuda="Mínimo 8 caracteres." error={e.password} />
      <BotonEnviar textoEnviando="Creando cuenta…" className="w-full">
        Crear cuenta
      </BotonEnviar>
    </form>
  );
}
