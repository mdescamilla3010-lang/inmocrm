import { after, NextResponse, type NextRequest } from "next/server";
import { descifrar } from "@/lib/cripto";
import { envServidor, requerirEnv } from "@/lib/env";
import { abrirCaptura, capturarLead, cerrarCaptura } from "@/lib/leads/captura";
import { mapearCamposMeta, parsearWebhookMeta, resumirRespuestas, verificarFirmaMeta, type AvisoLeadMeta } from "@/lib/leads/meta";
import { obtenerLeadMeta } from "@/lib/leads/meta-graph";
import { crearClienteAdmin } from "@/lib/supabase/admin";

/** Verificación de la suscripción del webhook (configuración en Meta for Developers). */
export function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const token = envServidor().META_VERIFY_TOKEN;
  if (token && p.get("hub.mode") === "subscribe" && p.get("hub.verify_token") === token) {
    return new NextResponse(p.get("hub.challenge") ?? "", { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(request: NextRequest) {
  const crudo = await request.text();
  if (!verificarFirmaMeta(crudo, request.headers.get("x-hub-signature-256"), requerirEnv("META_APP_SECRET"))) {
    return new NextResponse("Firma inválida", { status: 401 });
  }

  let cuerpo: unknown;
  try {
    cuerpo = JSON.parse(crudo);
  } catch {
    return new NextResponse("JSON inválido", { status: 400 });
  }

  const avisos = parsearWebhookMeta(cuerpo);
  // Meta exige respuesta rápida; el trabajo se hace después de responder.
  after(async () => {
    for (const aviso of avisos) {
      try {
        await procesarAviso(aviso);
      } catch (e) {
        console.error("[meta-leads] error procesando", aviso.leadgenId, e);
      }
    }
  });
  return NextResponse.json({ ok: true });
}

async function procesarAviso(aviso: AvisoLeadMeta) {
  const admin = crearClienteAdmin();
  const { data: integracion } = await admin
    .from("integraciones")
    .select("inmobiliaria_id, credenciales_cifradas")
    .eq("proveedor", "meta_leads")
    .eq("identificador_externo", aviso.pageId)
    .eq("activa", true)
    .maybeSingle();
  if (!integracion?.credenciales_cifradas) {
    console.warn("[meta-leads] página sin integración activa", aviso.pageId);
    return;
  }
  const inmobiliariaId = integracion.inmobiliaria_id;

  const capturaId = await abrirCaptura(admin, {
    inmobiliariaId,
    canal: "meta",
    fuente: "meta_ads",
    idExterno: aviso.leadgenId,
    payload: { ...aviso },
  });
  if (!capturaId) return; // reintento de Meta: ya se procesó

  try {
    const env = envServidor();
    const lead = await obtenerLeadMeta({
      leadgenId: aviso.leadgenId,
      tokenPagina: descifrar(integracion.credenciales_cifradas, requerirEnv("ENCRYPTION_KEY")),
      version: env.META_GRAPH_VERSION,
    });
    const contacto = mapearCamposMeta(lead.field_data);
    if (!contacto.telefono && !contacto.email) {
      await cerrarCaptura(admin, { inmobiliariaId, capturaId, resultado: "descartado", detalle: "El formulario no trae teléfono ni correo" });
      return;
    }
    const resumen = resumirRespuestas(contacto.respuestas);
    const resultado = await capturarLead(admin, inmobiliariaId, {
      fuente: "meta_ads",
      nombre: contacto.nombre,
      telefono: contacto.telefono,
      email: contacto.email,
      mensajeInicial: resumen,
      textoZona: Object.values(contacto.respuestas).join(" ") || null,
      clavePropiedad: null,
      fuenteDetalle: {
        leadgen_id: aviso.leadgenId,
        page_id: aviso.pageId,
        form_id: lead.form_id ?? aviso.formId,
        ad_id: lead.ad_id ?? aviso.adId,
        campaign_id: lead.campaign_id,
      },
      datosCrudos: lead,
    });
    await cerrarCaptura(admin, { inmobiliariaId, capturaId, resultado: resultado.tipo, leadId: resultado.leadId });
  } catch (e) {
    await cerrarCaptura(admin, { inmobiliariaId, capturaId, resultado: "error", detalle: e instanceof Error ? e.message : String(e) });
    throw e;
  }
}
