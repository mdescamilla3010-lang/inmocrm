import type { Metadata } from "next";
import Link from "next/link";
import { Insignia, type Tono } from "@/components/ui/insignia";
import { BotonEnviar } from "@/components/ui/boton-enviar";
import { requerirDueno } from "@/lib/auth/sesion";
import { envPublico, envServidor } from "@/lib/env";
import { formatearFechaHora } from "@/lib/formato";
import { ETIQUETA_FUENTE } from "@/lib/leads/etiquetas";
import { codigoFormularioLanding } from "@/lib/leads/integraciones";
import type { Database } from "@/lib/supabase/database.types";
import { crearClienteServidor } from "@/lib/supabase/server";
import { conectarPaginaMeta, conectarWhatsApp, desconectarIntegracion, regenerarClaveLanding } from "./acciones";
import { Copiable, FormPaginaMeta, FormWhatsApp } from "./formularios";

export const metadata: Metadata = { title: "Integraciones" };

const RESULTADO: Record<Database["public"]["Enums"]["resultado_captura"], { texto: string; tono: Tono }> = {
  procesando: { texto: "Procesando", tono: "gris" },
  creado: { texto: "Lead nuevo", tono: "verde" },
  recapturado: { texto: "Ya existía", tono: "azul" },
  descartado: { texto: "Descartado", tono: "ambar" },
  error: { texto: "Error", tono: "rojo" },
};
const CANAL: Record<string, string> = { meta: "Meta", landing: "Landing", correo: "Correo" };

export default async function PaginaIntegraciones() {
  const dueno = await requerirDueno();
  const supabase = await crearClienteServidor();
  const [{ data: inmo }, { data: paginas }, { data: capturas }, { data: whatsapp }] = await Promise.all([
    supabase.from("inmobiliarias").select("clave_landing, slug").eq("id", dueno.inmobiliariaId).single(),
    supabase.from("integraciones").select("id, identificador_externo, config, activa, creado_en").eq("proveedor", "meta_leads").order("creado_en"),
    supabase.from("capturas_lead").select("id, canal, fuente, resultado, detalle, lead_id, payload, creado_en").order("creado_en", { ascending: false }).limit(30),
    supabase.from("integraciones").select("id, identificador_externo, config").eq("proveedor", "whatsapp_cloud").maybeSingle(),
  ]);
  const cfgWa = (whatsapp?.config ?? {}) as Record<string, string | null>;

  const appUrl = envPublico().NEXT_PUBLIC_APP_URL;
  const dominioCorreo = envServidor().CORREO_ENTRANTE_DOMINIO;
  const endpointLanding = `${appUrl}/api/leads/landing`;
  const zh = dueno.inmobiliaria.zonaHoraria;

  return (
    <section className="space-y-6">
      <Tarjeta titulo="WhatsApp Business" descripcion="El número con el que el agente de IA atiende a tus prospectos.">
        {whatsapp ? (
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm">
            <span>
              Conectado: <span className="font-medium">{cfgWa.numero ?? whatsapp.identificador_externo}</span>
              {cfgWa.plantilla_bienvenida ? ` · bienvenida "${cfgWa.plantilla_bienvenida}"` : " · sin plantilla de bienvenida"}
            </span>
            <form action={desconectarIntegracion.bind(null, whatsapp.id)}>
              <BotonEnviar variante="secundario" textoEnviando="…">Desconectar</BotonEnviar>
            </form>
          </div>
        ) : null}
        <FormWhatsApp
          accion={conectarWhatsApp}
          iniciales={
            whatsapp
              ? {
                  phoneNumberId: whatsapp.identificador_externo,
                  numero: cfgWa.numero ?? "",
                  wabaId: cfgWa.waba_id ?? "",
                  plantillaBienvenida: cfgWa.plantilla_bienvenida ?? "",
                  idioma: cfgWa.idioma ?? "es_MX",
                  textoBienvenida: cfgWa.texto_bienvenida ?? "",
                  plantillaAvisoAsesor: cfgWa.plantilla_aviso_asesor ?? "",
                  plantillaRecordatorio: cfgWa.plantilla_recordatorio ?? "",
                  textoRecordatorio: cfgWa.texto_recordatorio ?? "",
                  plantillaReactivacion: cfgWa.plantilla_reactivacion ?? "",
                  textoReactivacion: cfgWa.texto_reactivacion ?? "",
                }
              : undefined
          }
        />
        <p className="mt-4 text-xs text-slate-500">
          En tu app de Meta suscribe el webhook <code>{appUrl}/api/webhooks/whatsapp</code> al campo <code>messages</code>. Sin plantilla de
          bienvenida, el agente sólo contesta a quien escriba primero.
        </p>
      </Tarjeta>

      <Tarjeta titulo="Formularios de tu landing" descripcion="Cualquier formulario web (o Zapier/Make) puede mandar leads con esta clave.">
        <dl className="space-y-3 text-sm">
          <div>
            <dt className="mb-1 text-slate-500">Endpoint (POST, JSON o formulario)</dt>
            <dd><Copiable texto={endpointLanding} /></dd>
          </div>
          <div>
            <dt className="mb-1 text-slate-500">Clave de tu inmobiliaria</dt>
            <dd><Copiable texto={inmo?.clave_landing ?? ""} /></dd>
          </div>
        </dl>
        <details className="mt-4">
          <summary className="cursor-pointer text-sm font-medium text-emerald-700">Ver código HTML de ejemplo</summary>
          <div className="mt-2">
            <Copiable texto={codigoFormularioLanding(endpointLanding, inmo?.clave_landing ?? "")} multilinea />
          </div>
        </details>
        <form action={regenerarClaveLanding} className="mt-4">
          <BotonEnviar variante="secundario" textoEnviando="Generando…">Generar clave nueva</BotonEnviar>
          <p className="mt-1 text-xs text-slate-500">Úsalo si la clave se filtró: los formularios con la clave anterior dejarán de funcionar.</p>
        </form>
      </Tarjeta>

      <Tarjeta titulo="Inmuebles24, Lamudi y Vivanuncios" descripcion="Reenvía a esta dirección los correos de contacto que te mandan los portales.">
        {dominioCorreo ? (
          <>
            <Copiable texto={`${inmo?.slug}@${dominioCorreo}`} />
            <ol className="mt-4 list-inside list-decimal space-y-1 text-sm text-slate-700">
              <li>En Gmail: Configuración → Reenvío → “Agregar una dirección de reenvío” y pega la dirección de arriba.</li>
              <li>Gmail manda un código de confirmación: aparecerá abajo, en la bitácora (ábrelo para verlo).</li>
              <li>Crea un filtro con remitente <code>inmuebles24.com OR lamudi.com.mx OR vivanuncios.com.mx</code> → “Reenviar a” esa dirección.</li>
              <li>Pon la clave de cada propiedad en el portal igual que en tu catálogo para que el lead se ligue a ella.</li>
            </ol>
          </>
        ) : (
          <p className="text-sm text-amber-800">El correo entrante aún no está configurado en el servidor (CORREO_ENTRANTE_DOMINIO).</p>
        )}
      </Tarjeta>

      <Tarjeta titulo="Meta Lead Ads (Facebook e Instagram)" descripcion="Los formularios de tus anuncios entran como leads en segundos.">
        {paginas?.length ? (
          <ul className="mb-5 divide-y divide-slate-100 rounded-lg border border-slate-200">
            {paginas.map((p) => {
              const nombre = (p.config as { nombre?: string } | null)?.nombre;
              return (
                <li key={p.id} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                  <span>
                    <span className="font-medium">{nombre ?? "Página"}</span> <span className="text-slate-500">· ID {p.identificador_externo}</span>
                  </span>
                  <form action={desconectarIntegracion.bind(null, p.id)}>
                    <BotonEnviar variante="secundario" textoEnviando="…">Desconectar</BotonEnviar>
                  </form>
                </li>
              );
            })}
          </ul>
        ) : null}
        <FormPaginaMeta accion={conectarPaginaMeta} />
        <p className="mt-4 text-xs text-slate-500">
          En tu app de Meta suscribe el webhook <code>{appUrl}/api/webhooks/meta-leads</code> al campo <code>leadgen</code> de la página.
        </p>
      </Tarjeta>

      <Tarjeta titulo="Bitácora de captura" descripcion="Últimos 30 intentos de captura por cualquier canal.">
        {capturas?.length ? (
          <ul className="divide-y divide-slate-100 text-sm">
            {capturas.map((c) => {
              const r = RESULTADO[c.resultado];
              const payload = c.payload as { asunto?: string; texto?: string } | null;
              return (
                <li key={c.id} className="py-3">
                  <div className="flex flex-wrap items-center gap-2">
                    <Insignia tono={r.tono}>{r.texto}</Insignia>
                    <span className="font-medium">{CANAL[c.canal] ?? c.canal}</span>
                    {c.fuente ? <span className="text-slate-500">· {ETIQUETA_FUENTE[c.fuente]}</span> : null}
                    <span className="ml-auto text-xs text-slate-500">{formatearFechaHora(c.creado_en, zh)}</span>
                  </div>
                  {payload?.asunto ? <p className="mt-1 text-slate-700">{payload.asunto}</p> : null}
                  {c.detalle ? <p className="mt-1 text-slate-600">{c.detalle}</p> : null}
                  {c.lead_id ? <Link href={`/leads/${c.lead_id}`} className="mt-1 inline-block text-emerald-700 hover:underline">Ver lead</Link> : null}
                  {c.canal === "correo" && payload?.texto ? (
                    <details className="mt-1">
                      <summary className="cursor-pointer text-xs text-slate-500">Ver correo</summary>
                      <pre className="mt-1 max-h-60 overflow-auto whitespace-pre-wrap rounded bg-slate-50 p-2 text-xs text-slate-700">{payload.texto}</pre>
                    </details>
                  ) : null}
                </li>
              );
            })}
          </ul>
        ) : (
          <p className="text-sm text-slate-600">Todavía no llega ningún lead por estas integraciones.</p>
        )}
      </Tarjeta>
    </section>
  );
}

function Tarjeta({ titulo, descripcion, children }: { titulo: string; descripcion: string; children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-base font-semibold">{titulo}</h2>
      <p className="mb-4 mt-1 text-sm text-slate-600">{descripcion}</p>
      {children}
    </div>
  );
}
