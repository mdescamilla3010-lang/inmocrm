import { after, NextResponse, type NextRequest } from "next/server";
import { responderConversacion } from "@/lib/agente/orquestador";
import { actualizarEstados, registrarEntrante } from "@/lib/conversaciones/servicio";
import { envServidor, requerirEnv } from "@/lib/env";
import { verificarFirmaMeta } from "@/lib/leads/meta";
import { cargarCanal } from "@/lib/mensajeria/canal";
import type { EventoMensajeria } from "@/lib/mensajeria/tipos";
import { parsearWebhookWhatsApp } from "@/lib/mensajeria/whatsapp-cloud";
import { crearClienteAdmin } from "@/lib/supabase/admin";

// El agente contesta dentro de after(): necesita más que el límite por defecto.
export const maxDuration = 60;

/** Verificación de la suscripción del webhook en Meta. */
export function GET(request: NextRequest) {
  const p = request.nextUrl.searchParams;
  const token = envServidor().WHATSAPP_VERIFY_TOKEN;
  if (token && p.get("hub.mode") === "subscribe" && p.get("hub.verify_token") === token) {
    return new NextResponse(p.get("hub.challenge") ?? "", { status: 200 });
  }
  return new NextResponse("Forbidden", { status: 403 });
}

export async function POST(request: NextRequest) {
  const crudo = await request.text();
  if (!verificarFirmaMeta(crudo, request.headers.get("x-hub-signature-256"), requerirEnv("WHATSAPP_APP_SECRET"))) {
    return new NextResponse("Firma inválida", { status: 401 });
  }
  let cuerpo: unknown;
  try {
    cuerpo = JSON.parse(crudo);
  } catch {
    return new NextResponse("JSON inválido", { status: 400 });
  }

  const eventos = parsearWebhookWhatsApp(cuerpo);
  // Meta reintenta si no respondemos rápido: todo el trabajo va después.
  after(async () => {
    for (const evento of eventos) {
      try {
        await procesarEvento(evento);
      } catch (e) {
        console.error("[whatsapp] error procesando evento", evento.numeroNegocio, e);
      }
    }
  });
  return NextResponse.json({ ok: true });
}

async function procesarEvento(evento: EventoMensajeria) {
  const admin = crearClienteAdmin();
  const canal = await cargarCanal(admin, { numeroNegocio: evento.numeroNegocio });
  if (!canal) {
    console.warn("[whatsapp] número sin integración activa", evento.numeroNegocio);
    return;
  }

  if (evento.estados.length) await actualizarEstados(admin, canal.inmobiliariaId, evento.estados);

  const porResponder = new Set<string>();
  for (const mensaje of evento.mensajes) {
    const r = await registrarEntrante(admin, canal, mensaje);
    if (r?.responder) porResponder.add(r.conversacionId);
  }
  if (!porResponder.size) return;

  // Pequeña espera: la gente manda varios mensajes seguidos ("Hola" / "¿sigue
  // disponible?"). Así se contesta todo junto en lugar de mensaje por mensaje.
  const espera = envServidor().AGENTE_ESPERA_MS;
  if (espera) await new Promise((r) => setTimeout(r, espera));

  await Promise.all([...porResponder].map((id) => responderConversacion(canal.inmobiliariaId, id)));
}
