"use client";

import { useActionState } from "react";
import { AreaTexto } from "@/components/ui/area-texto";
import { Aviso } from "@/components/ui/aviso";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { Campo } from "@/components/ui/campo";
import { Selector } from "@/components/ui/selector";
import { estadoInicial, type EstadoFormulario } from "@/lib/formularios";
import {
  ETIQUETA_ESTADO,
  ETIQUETA_FORMA_PAGO,
  ETIQUETA_OPERACION,
  ETIQUETA_TIPO_PROPIEDAD,
  ETIQUETA_URGENCIA,
  opciones,
} from "@/lib/leads/etiquetas";

type Accion = (estado: EstadoFormulario, fd: FormData) => Promise<EstadoFormulario>;
type Opcion = { valor: string; etiqueta: string };

function Resultado({ estado }: { estado: EstadoFormulario }) {
  if (estado.error) return <Aviso tipo="error">{estado.error}</Aviso>;
  if (estado.ok) return <Aviso tipo="ok">{estado.ok}</Aviso>;
  return null;
}

export function FormEstado({ accion, estadoActual }: { accion: Accion; estadoActual: string }) {
  const [estado, enviar] = useActionState(accion, estadoInicial);
  return (
    <form action={enviar} className="space-y-3">
      <Selector etiqueta="Estado" name="estado" opciones={opciones(ETIQUETA_ESTADO)} defaultValue={estadoActual} />
      <BotonEnviar variante="secundario" textoEnviando="Guardando…" className="w-full">
        Cambiar estado
      </BotonEnviar>
      <Resultado estado={estado} />
    </form>
  );
}

export function FormReasignar({ accion, asesorActual, asesores }: { accion: Accion; asesorActual: string | null; asesores: Opcion[] }) {
  const [estado, enviar] = useActionState(accion, estadoInicial);
  return (
    <form action={enviar} className="space-y-3">
      <Selector etiqueta="Asesor" name="asesorId" opciones={asesores} vacio="Elige un asesor" defaultValue={asesorActual ?? ""} />
      <BotonEnviar variante="secundario" textoEnviando="Reasignando…" className="w-full">
        Reasignar
      </BotonEnviar>
      <Resultado estado={estado} />
    </form>
  );
}

export type ValoresCalificacion = Record<
  | "operacion_interes"
  | "tipo_propiedad_interes"
  | "zona_interes"
  | "zona_id"
  | "presupuesto_min"
  | "presupuesto_max"
  | "forma_pago"
  | "credito_preaprobado"
  | "urgencia"
  | "recamaras_min"
  | "notas_calificacion",
  string
>;

export function FormCalificacion({ accion, iniciales, zonas }: { accion: Accion; iniciales: ValoresCalificacion; zonas: Opcion[] }) {
  const [estado, enviar] = useActionState(accion, estadoInicial);
  const v = { ...iniciales, ...estado.valores };
  const e = estado.errores ?? {};
  return (
    <form action={enviar} className="space-y-4" noValidate>
      <div className="grid gap-4 sm:grid-cols-2">
        <Selector etiqueta="Operación" name="operacion_interes" vacio="—" opciones={opciones(ETIQUETA_OPERACION)} defaultValue={v.operacion_interes} />
        <Selector etiqueta="Tipo de propiedad" name="tipo_propiedad_interes" vacio="—" opciones={opciones(ETIQUETA_TIPO_PROPIEDAD)} defaultValue={v.tipo_propiedad_interes} />
        <Campo etiqueta="Zona (como la dijo)" name="zona_interes" defaultValue={v.zona_interes} error={e.zona_interes} />
        <Selector etiqueta="Zona del catálogo" name="zona_id" vacio="Sin zona" opciones={zonas} defaultValue={v.zona_id} />
        <Campo etiqueta="Presupuesto mínimo" name="presupuesto_min" inputMode="decimal" placeholder="2,000,000" defaultValue={v.presupuesto_min} error={e.presupuesto_min} />
        <Campo etiqueta="Presupuesto máximo" name="presupuesto_max" inputMode="decimal" placeholder="3.5M" defaultValue={v.presupuesto_max} error={e.presupuesto_max} />
        <Selector etiqueta="Forma de pago" name="forma_pago" vacio="—" opciones={opciones(ETIQUETA_FORMA_PAGO)} defaultValue={v.forma_pago} />
        <Selector
          etiqueta="Crédito preaprobado"
          name="credito_preaprobado"
          vacio="No sabemos"
          opciones={[
            { valor: "si", etiqueta: "Sí" },
            { valor: "no", etiqueta: "No" },
          ]}
          defaultValue={v.credito_preaprobado}
        />
        <Selector etiqueta="¿Para cuándo?" name="urgencia" vacio="—" opciones={opciones(ETIQUETA_URGENCIA)} defaultValue={v.urgencia} />
        <Campo etiqueta="Recámaras mínimas" name="recamaras_min" type="number" min={0} max={20} defaultValue={v.recamaras_min} error={e.recamaras_min} />
      </div>
      <AreaTexto etiqueta="Notas de calificación" name="notas_calificacion" defaultValue={v.notas_calificacion} error={e.notas_calificacion} />
      <div className="flex flex-wrap items-center gap-3">
        <BotonEnviar textoEnviando="Guardando…">Guardar calificación</BotonEnviar>
        <Resultado estado={estado} />
      </div>
    </form>
  );
}

export function FormContacto({ accion, iniciales }: { accion: Accion; iniciales: Record<"nombre" | "telefono" | "email", string> }) {
  const [estado, enviar] = useActionState(accion, estadoInicial);
  const v = { ...iniciales, ...estado.valores };
  const e = estado.errores ?? {};
  return (
    <form action={enviar} className="space-y-3" noValidate>
      <Campo etiqueta="Nombre" name="nombre" defaultValue={v.nombre} error={e.nombre} />
      <Campo etiqueta="Teléfono" name="telefono" type="tel" defaultValue={v.telefono} error={e.telefono} />
      <Campo etiqueta="Correo" name="email" type="email" defaultValue={v.email} error={e.email} />
      <BotonEnviar variante="secundario" textoEnviando="Guardando…" className="w-full">
        Guardar contacto
      </BotonEnviar>
      <Resultado estado={estado} />
    </form>
  );
}

export function FormNota({ accion }: { accion: Accion }) {
  const [estado, enviar] = useActionState(accion, estadoInicial);
  return (
    <form key={estado.ok} action={enviar} className="space-y-2">
      <AreaTexto etiqueta="Agregar nota" name="texto" rows={2} placeholder="Llamó, quiere ver la casa el sábado…" defaultValue={estado.valores?.texto} error={estado.errores?.texto} />
      <div className="flex items-center gap-3">
        <BotonEnviar variante="secundario" textoEnviando="Guardando…">
          Guardar nota
        </BotonEnviar>
        {estado.error ? <span className="text-sm text-red-600">{estado.error}</span> : null}
      </div>
    </form>
  );
}
