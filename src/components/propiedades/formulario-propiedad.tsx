"use client";

import { useActionState } from "react";
import { AreaTexto } from "@/components/ui/area-texto";
import { Aviso } from "@/components/ui/aviso";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { Campo } from "@/components/ui/campo";
import { Selector } from "@/components/ui/selector";
import { estadoInicial, type EstadoFormulario } from "@/lib/formularios";
import { ETIQUETA_ESTADO_PROPIEDAD, ETIQUETA_OPERACION, ETIQUETA_TIPO_PROPIEDAD, opciones } from "@/lib/leads/etiquetas";

type Accion = (estado: EstadoFormulario, fd: FormData) => Promise<EstadoFormulario>;
type Opcion = { valor: string; etiqueta: string };

export type ValoresPropiedad = Record<string, string>;

export function FormularioPropiedad(props: {
  accion: Accion;
  iniciales?: ValoresPropiedad;
  zonas: Opcion[];
  asesores: Opcion[];
  textoBoton: string;
}) {
  const [estado, enviar] = useActionState(props.accion, estadoInicial);
  const v: ValoresPropiedad = { estado: "disponible", operacion: "venta", moneda: "MXN", acepta_credito_bancario: "on", ...props.iniciales, ...estado.valores };
  const e = estado.errores ?? {};
  // Con valores devueltos por un error, las casillas sin marcar no vienen en el FormData.
  const marcada = (campo: string) => (estado.valores ? estado.valores[campo] === "on" : v[campo] === "on");

  return (
    <form action={enviar} className="space-y-6" noValidate>
      {estado.error ? <Aviso tipo="error">{estado.error}</Aviso> : null}
      {estado.ok ? <Aviso tipo="ok">{estado.ok}</Aviso> : null}

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-semibold text-slate-900">Datos principales</legend>
        <Campo etiqueta="Título" name="titulo" required defaultValue={v.titulo} error={e.titulo} className="sm:col-span-2" placeholder="Casa en Juriquilla con jardín" />
        <Selector etiqueta="Tipo" name="tipo" vacio="Elige…" opciones={opciones(ETIQUETA_TIPO_PROPIEDAD)} defaultValue={v.tipo} error={e.tipo} />
        <Selector etiqueta="Operación" name="operacion" opciones={opciones(ETIQUETA_OPERACION)} defaultValue={v.operacion} error={e.operacion} />
        <Campo etiqueta="Precio" name="precio" inputMode="decimal" required defaultValue={v.precio} error={e.precio} placeholder="4,850,000" ayuda="Para renta, el precio mensual." />
        <Selector etiqueta="Moneda" name="moneda" opciones={[{ valor: "MXN", etiqueta: "MXN" }, { valor: "USD", etiqueta: "USD" }]} defaultValue={v.moneda} />
        <Selector etiqueta="Estado" name="estado" opciones={opciones(ETIQUETA_ESTADO_PROPIEDAD)} defaultValue={v.estado} error={e.estado} />
        <Campo etiqueta="Clave interna" name="clave" defaultValue={v.clave} error={e.clave} ayuda="La que usas en los portales; liga los leads de correo con esta propiedad." />
        <AreaTexto etiqueta="Descripción" name="descripcion" rows={5} defaultValue={v.descripcion} error={e.descripcion} className="sm:col-span-2" />
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-2">
        <legend className="mb-2 text-sm font-semibold text-slate-900">Ubicación</legend>
        <Selector etiqueta="Zona" name="zona_id" vacio="Sin zona" opciones={props.zonas} defaultValue={v.zona_id} />
        <Campo etiqueta="Colonia" name="colonia" defaultValue={v.colonia} error={e.colonia} />
        <Campo etiqueta="Municipio / alcaldía" name="municipio" defaultValue={v.municipio} error={e.municipio} />
        <Campo etiqueta="Estado" name="entidad_federativa" defaultValue={v.entidad_federativa} error={e.entidad_federativa} />
        <Campo etiqueta="Código postal" name="codigo_postal" inputMode="numeric" maxLength={5} defaultValue={v.codigo_postal} error={e.codigo_postal} />
        <Campo etiqueta="Dirección" name="direccion" defaultValue={v.direccion} error={e.direccion} ayuda="Sólo se comparte al confirmar una cita." />
      </fieldset>

      <fieldset className="grid gap-4 sm:grid-cols-3">
        <legend className="mb-2 text-sm font-semibold text-slate-900">Características</legend>
        <Campo etiqueta="Recámaras" name="recamaras" type="number" min={0} defaultValue={v.recamaras} error={e.recamaras} />
        <Campo etiqueta="Baños" name="banos" type="number" min={0} step={0.5} defaultValue={v.banos} error={e.banos} />
        <Campo etiqueta="Estacionamientos" name="estacionamientos" type="number" min={0} defaultValue={v.estacionamientos} error={e.estacionamientos} />
        <Campo etiqueta="m² de construcción" name="m2_construccion" inputMode="decimal" defaultValue={v.m2_construccion} error={e.m2_construccion} />
        <Campo etiqueta="m² de terreno" name="m2_terreno" inputMode="decimal" defaultValue={v.m2_terreno} error={e.m2_terreno} />
        <Selector etiqueta="Asesor responsable" name="asesor_responsable_id" vacio="Ninguno" opciones={props.asesores} defaultValue={v.asesor_responsable_id} />
        <AreaTexto etiqueta="Amenidades" name="amenidades" rows={2} defaultValue={v.amenidades} className="sm:col-span-3" placeholder="jardín, alberca, seguridad 24/7" />
      </fieldset>

      <fieldset>
        <legend className="mb-2 text-sm font-semibold text-slate-900">Formas de pago que acepta</legend>
        <div className="flex flex-wrap gap-6 text-sm">
          {(
            [
              ["acepta_credito_bancario", "Crédito bancario"],
              ["acepta_infonavit", "Infonavit"],
              ["acepta_fovissste", "Fovissste"],
            ] as const
          ).map(([campo, etiqueta]) => (
            <label key={campo} className="inline-flex items-center gap-2">
              <input type="checkbox" name={campo} defaultChecked={marcada(campo)} className="size-4 accent-emerald-700" />
              {etiqueta}
            </label>
          ))}
          <span className="text-slate-500">(contado siempre)</span>
        </div>
      </fieldset>

      <BotonEnviar textoEnviando="Guardando…">{props.textoBoton}</BotonEnviar>
    </form>
  );
}
