import { after, NextResponse, type NextRequest } from "next/server";
import { requerirEnv } from "@/lib/env";
import { abrirCaptura, capturarLead, cerrarCaptura } from "@/lib/leads/captura";
import { slugDeDestinatarios } from "@/lib/leads/correo/destinatario";
import { correoDesdePostmark, type CorreoEntrante } from "@/lib/leads/correo/entrante";
import { parsearCorreoPortal } from "@/lib/leads/correo/portales";
import { contrasenaBasic, secretosIguales } from "@/lib/seguridad";
import { crearClienteAdmin } from "@/lib/supabase/admin";

/**
 * Webhook de correo entrante (Postmark Inbound). La URL se configura con
 * Basic auth: https://postmark:<CORREO_ENTRANTE_SECRETO>@app/api/webhooks/correo-entrante
 */
export async function POST(request: NextRequest) {
  const contrasena = contrasenaBasic(request.headers.get("authorization"));
  if (!contrasena || !secretosIguales(contrasena, requerirEnv("CORREO_ENTRANTE_SECRETO"))) {
    return new NextResponse("No autorizado", { status: 401, headers: { "WWW-Authenticate": "Basic" } });
  }

  const correo = correoDesdePostmark(await request.json().catch(() => null));
  if (!correo) return new NextResponse("Formato no reconocido", { status: 400 });

  after(async () => {
    try {
      await procesarCorreo(correo);
    } catch (e) {
      console.error("[correo-entrante] error procesando", correo.messageId, e);
    }
  });
  // 200 aunque no sea un correo útil: si respondemos error, el proveedor reintenta.
  return NextResponse.json({ ok: true });
}

async function procesarCorreo(correo: CorreoEntrante) {
  const slug = slugDeDestinatarios(correo.destinatarios, requerirEnv("CORREO_ENTRANTE_DOMINIO"));
  if (!slug) {
    console.warn("[correo-entrante] destinatario desconocido", correo.destinatarios);
    return;
  }
  const admin = crearClienteAdmin();
  const { data: inmo } = await admin.from("inmobiliarias").select("id").eq("slug", slug).maybeSingle();
  if (!inmo) {
    console.warn("[correo-entrante] no existe la inmobiliaria", slug);
    return;
  }

  const parseo = parsearCorreoPortal(correo);
  const capturaId = await abrirCaptura(admin, {
    inmobiliariaId: inmo.id,
    canal: "correo",
    fuente: parseo.ok ? parseo.datos.fuente : null,
    idExterno: correo.messageId,
    // Se guarda el texto para que el dueño pueda revisar correos no reconocidos
    // (p. ej. el código de verificación de reenvío de Gmail).
    payload: { de: correo.de, asunto: correo.asunto, texto: correo.texto.slice(0, 20_000) },
  });
  if (!capturaId) return; // reintento del proveedor

  if (!parseo.ok) {
    await cerrarCaptura(admin, { inmobiliariaId: inmo.id, capturaId, resultado: "descartado", detalle: parseo.motivo });
    return;
  }

  const d = parseo.datos;
  try {
    const resultado = await capturarLead(admin, inmo.id, {
      fuente: d.fuente,
      nombre: d.nombre,
      telefono: d.telefono,
      email: d.email,
      mensajeInicial: d.mensaje,
      textoZona: null,
      clavePropiedad: d.referencia,
      fuenteDetalle: { url_anuncio: d.urlAnuncio ?? undefined, referencia: d.referencia ?? undefined, asunto: correo.asunto },
      datosCrudos: { de: correo.de, asunto: correo.asunto, message_id: correo.messageId },
    });
    await cerrarCaptura(admin, { inmobiliariaId: inmo.id, capturaId, resultado: resultado.tipo, leadId: resultado.leadId });
  } catch (e) {
    await cerrarCaptura(admin, {
      inmobiliariaId: inmo.id,
      capturaId,
      resultado: "error",
      detalle: e instanceof Error ? e.message : String(e),
    });
    throw e;
  }
}
