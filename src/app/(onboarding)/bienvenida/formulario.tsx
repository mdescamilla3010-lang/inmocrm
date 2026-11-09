"use client";

import { useActionState } from "react";
import { Aviso } from "@/components/ui/aviso";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { Campo } from "@/components/ui/campo";
import { estadoInicial } from "@/lib/formularios";
import { crearInmobiliaria } from "../acciones";

type Inicial = { nombreDueno: string; nombreInmobiliaria: string; slug: string };

export function FormularioBienvenida({ inicial }: { inicial: Inicial }) {
  const [estado, accion] = useActionState(crearInmobiliaria, estadoInicial);
  const v = { ...inicial, ...estado.valores };
  const e = estado.errores ?? {};
  return (
    <form action={accion} className="space-y-4" noValidate>
      {estado.error ? <Aviso tipo="error">{estado.error}</Aviso> : null}
      <Campo etiqueta="Tu nombre" name="nombreDueno" required defaultValue={v.nombreDueno} error={e.nombreDueno} />
      <Campo etiqueta="Nombre de la inmobiliaria" name="nombreInmobiliaria" required defaultValue={v.nombreInmobiliaria} error={e.nombreInmobiliaria} />
      <Campo
        etiqueta="Identificador"
        name="slug"
        defaultValue={v.slug}
        error={e.slug}
        ayuda="Se usa en tu correo para recibir leads de portales (identificador@leads…). Minúsculas, números y guiones."
      />
      <BotonEnviar textoEnviando="Creando…" className="w-full">
        Crear inmobiliaria
      </BotonEnviar>
    </form>
  );
}
