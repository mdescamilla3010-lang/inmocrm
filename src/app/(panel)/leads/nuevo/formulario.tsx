"use client";

import Link from "next/link";
import { useActionState } from "react";
import { AreaTexto } from "@/components/ui/area-texto";
import { Aviso } from "@/components/ui/aviso";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { Campo } from "@/components/ui/campo";
import { Selector } from "@/components/ui/selector";
import { estadoInicial } from "@/lib/formularios";
import { crearLeadManual } from "./acciones";

export function FormularioLeadNuevo({ asesores }: { asesores: { id: string; nombre: string }[] | null }) {
  const [estado, accion] = useActionState(crearLeadManual, estadoInicial);
  const v = estado.valores ?? {};
  const e = estado.errores ?? {};
  return (
    <form action={accion} className="space-y-4" noValidate>
      {estado.error ? (
        <Aviso tipo="error">
          {estado.error}{" "}
          {e._duplicado ? (
            <Link href={`/leads/${e._duplicado}`} className="font-medium underline">
              Ver lead
            </Link>
          ) : null}
        </Aviso>
      ) : null}
      <Campo etiqueta="Nombre" name="nombre" defaultValue={v.nombre} error={e.nombre} />
      <div className="grid gap-4 sm:grid-cols-2">
        <Campo etiqueta="WhatsApp / teléfono" name="telefono" type="tel" placeholder="442 123 4567" defaultValue={v.telefono} error={e.telefono} />
        <Campo etiqueta="Correo" name="email" type="email" defaultValue={v.email} error={e.email} />
      </div>
      <AreaTexto etiqueta="¿Qué busca? (opcional)" name="mensaje" defaultValue={v.mensaje} placeholder="Casa de 3 recámaras en Juriquilla, crédito Infonavit…" />
      {asesores ? (
        <Selector
          etiqueta="Asesor"
          name="asesorId"
          vacio="Asignar automáticamente (zona / turno)"
          opciones={asesores.map((a) => ({ valor: a.id, etiqueta: a.nombre }))}
          defaultValue={v.asesorId ?? ""}
        />
      ) : (
        <p className="text-sm text-slate-600">El lead quedará asignado a ti.</p>
      )}
      <BotonEnviar textoEnviando="Guardando…">Guardar lead</BotonEnviar>
    </form>
  );
}
