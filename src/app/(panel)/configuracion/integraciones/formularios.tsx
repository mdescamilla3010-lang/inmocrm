"use client";

import { useActionState, useState } from "react";
import { Aviso } from "@/components/ui/aviso";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { Campo } from "@/components/ui/campo";
import { estadoInicial, type EstadoFormulario } from "@/lib/formularios";

type Accion = (estado: EstadoFormulario, fd: FormData) => Promise<EstadoFormulario>;

export function FormPaginaMeta({ accion }: { accion: Accion }) {
  const [estado, enviar] = useActionState(accion, estadoInicial);
  const v = estado.valores ?? {};
  const e = estado.errores ?? {};
  return (
    <form key={estado.ok} action={enviar} className="space-y-3" noValidate>
      {estado.error ? <Aviso tipo="error">{estado.error}</Aviso> : null}
      {estado.ok ? <Aviso tipo="ok">{estado.ok}</Aviso> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="ID de la página" name="pageId" inputMode="numeric" defaultValue={v.pageId} error={e.pageId} />
        <Campo etiqueta="Nombre (para identificarla)" name="nombre" defaultValue={v.nombre} error={e.nombre} placeholder="Casas del Bajío" />
      </div>
      <Campo
        etiqueta="Token de acceso de la página"
        name="token"
        type="password"
        autoComplete="off"
        error={e.token}
        ayuda="Token de larga duración con permiso leads_retrieval. Se guarda cifrado y nadie lo puede volver a ver."
      />
      <BotonEnviar textoEnviando="Conectando…">Conectar página</BotonEnviar>
    </form>
  );
}

export function Copiable({ texto, multilinea = false }: { texto: string; multilinea?: boolean }) {
  const [copiado, setCopiado] = useState(false);
  return (
    <div className="relative">
      {multilinea ? (
        <pre className="max-h-72 overflow-auto rounded-lg bg-slate-900 p-3 pr-20 text-xs text-slate-100">{texto}</pre>
      ) : (
        <code className="block overflow-x-auto rounded-lg bg-slate-100 px-3 py-2 pr-20 text-sm text-slate-800">{texto}</code>
      )}
      <button
        type="button"
        onClick={async () => {
          await navigator.clipboard.writeText(texto);
          setCopiado(true);
          setTimeout(() => setCopiado(false), 1500);
        }}
        className="absolute right-2 top-1.5 rounded-md bg-white px-2 py-1 text-xs font-medium text-slate-700 shadow-sm ring-1 ring-slate-200 hover:bg-slate-50"
      >
        {copiado ? "¡Copiado!" : "Copiar"}
      </button>
    </div>
  );
}

export function FormWhatsApp({ accion, iniciales }: { accion: Accion; iniciales?: Record<string, string> }) {
  const [estado, enviar] = useActionState(accion, estadoInicial);
  const v: Record<string, string | undefined> = { idioma: "es_MX", ...iniciales, ...estado.valores };
  const e = estado.errores ?? {};
  return (
    <form action={enviar} className="space-y-4" noValidate>
      {estado.error ? <Aviso tipo="error">{estado.error}</Aviso> : null}
      {estado.ok ? <Aviso tipo="ok">{estado.ok}</Aviso> : null}
      <div className="grid gap-3 sm:grid-cols-2">
        <Campo etiqueta="Phone number ID" name="phoneNumberId" inputMode="numeric" defaultValue={v.phoneNumberId} error={e.phoneNumberId} />
        <Campo etiqueta="Número de WhatsApp" name="numero" type="tel" placeholder="442 123 4567" defaultValue={v.numero} error={e.numero} />
        <Campo etiqueta="WhatsApp Business Account ID (opcional)" name="wabaId" defaultValue={v.wabaId} error={e.wabaId} />
        <Campo
          etiqueta="Token de acceso permanente"
          name="token"
          type="password"
          autoComplete="off"
          error={e.token}
          ayuda="De un usuario del sistema con whatsapp_business_messaging. Se guarda cifrado."
        />
      </div>
      <fieldset className="grid gap-3 sm:grid-cols-2">
        <legend className="mb-1 text-sm font-semibold text-slate-900">Plantillas aprobadas</legend>
        <Campo
          etiqueta="Plantilla de bienvenida"
          name="plantillaBienvenida"
          defaultValue={v.plantillaBienvenida}
          error={e.plantillaBienvenida}
          ayuda="Primer mensaje a leads de anuncios y portales. {{1}} = nombre, {{2}} = inmobiliaria."
        />
        <Campo etiqueta="Idioma" name="idioma" defaultValue={v.idioma} error={e.idioma} />
        <Campo
          etiqueta="Texto de la plantilla de bienvenida"
          name="textoBienvenida"
          defaultValue={v.textoBienvenida}
          error={e.textoBienvenida}
          className="sm:col-span-2"
          ayuda="Cópialo tal cual de Meta; se usa para mostrar el mensaje en la conversación."
          placeholder="Hola {{1}}, gracias por tu interés en {{2}}. ¿Te puedo hacer unas preguntas para recomendarte opciones?"
        />
        <Campo
          etiqueta="Plantilla de aviso al asesor (opcional)"
          name="plantillaAvisoAsesor"
          defaultValue={v.plantillaAvisoAsesor}
          error={e.plantillaAvisoAsesor}
          ayuda="Avisa al asesor cuando un lead requiere atención. {{1}} = prospecto, {{2}} = motivo."
        />
      </fieldset>
      <BotonEnviar textoEnviando="Conectando…">Guardar conexión</BotonEnviar>
    </form>
  );
}
