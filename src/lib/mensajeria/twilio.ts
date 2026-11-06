import { createHmac, timingSafeEqual } from "node:crypto";
import { normalizarTelefono } from "@/lib/telefono";
import { ErrorMensajeria, type EstadoEntrega, type EventoMensajeria, type Plantilla, type ProveedorMensajeria, type ResultadoEnvio } from "./tipos";

/**
 * WhatsApp vía Twilio. Mismo contrato que la Cloud API; las plantillas son
 * Content Templates (`nombre` = ContentSid, parámetros → ContentVariables).
 */
export class ProveedorTwilio implements ProveedorMensajeria {
  readonly nombre = "twilio" as const;

  constructor(
    private readonly cfg: { accountSid: string; authToken: string; numero: string; fetchFn?: typeof fetch },
  ) {}

  enviarTexto(para: string, texto: string) {
    return this.enviar(para, { Body: texto });
  }

  enviarPlantilla(para: string, p: Plantilla) {
    const variables = Object.fromEntries(p.parametros.map((v, i) => [String(i + 1), v]));
    return this.enviar(para, { ContentSid: p.nombre, ContentVariables: JSON.stringify(variables) });
  }

  enviarImagen(para: string, url: string, pie?: string) {
    return this.enviar(para, { MediaUrl: url, ...(pie ? { Body: pie } : {}) });
  }

  private async enviar(para: string, campos: Record<string, string>): Promise<ResultadoEnvio> {
    const f = this.cfg.fetchFn ?? fetch;
    const cuerpo = new URLSearchParams({ From: `whatsapp:${this.cfg.numero}`, To: `whatsapp:${para}`, ...campos });
    const respuesta = await f(`https://api.twilio.com/2010-04-01/Accounts/${encodeURIComponent(this.cfg.accountSid)}/Messages.json`, {
      method: "POST",
      headers: {
        Authorization: `Basic ${Buffer.from(`${this.cfg.accountSid}:${this.cfg.authToken}`).toString("base64")}`,
        "Content-Type": "application/x-www-form-urlencoded",
      },
      body: cuerpo,
      signal: AbortSignal.timeout(15_000),
    });
    const json = (await respuesta.json().catch(() => null)) as { sid?: string; message?: string } | null;
    if (!respuesta.ok || !json?.sid) throw new ErrorMensajeria(`Twilio: ${json?.message ?? `HTTP ${respuesta.status}`}`, json);
    return { idProveedor: json.sid };
  }
}

/** X-Twilio-Signature: HMAC-SHA1 de la URL + parámetros ordenados, en base64. */
export function verificarFirmaTwilio(url: string, parametros: Record<string, string>, firma: string | null, authToken: string): boolean {
  if (!firma) return false;
  const datos = url + Object.keys(parametros).sort().map((k) => k + parametros[k]).join("");
  const esperada = createHmac("sha1", authToken).update(datos, "utf8").digest();
  const recibida = Buffer.from(firma, "base64");
  return recibida.length === esperada.length && timingSafeEqual(recibida, esperada);
}

const ESTADOS_TWILIO: Record<string, EstadoEntrega> = {
  sent: "enviado",
  delivered: "entregado",
  read: "leido",
  failed: "fallido",
  undelivered: "fallido",
};

/** Webhook de Twilio (form-urlencoded) → mismo formato que la Cloud API. */
export function parsearWebhookTwilio(p: Record<string, string>): EventoMensajeria | null {
  const numeroNegocio = normalizarTelefono((p.To ?? "").replace(/^whatsapp:/, ""));
  if (!numeroNegocio || !p.MessageSid) return null;

  if (p.MessageStatus && !p.Body && p.SmsStatus !== "received") {
    const estado = ESTADOS_TWILIO[p.MessageStatus];
    return {
      numeroNegocio,
      mensajes: [],
      estados: estado ? [{ idProveedor: p.MessageSid, estado, error: p.ErrorMessage || p.ErrorCode || null }] : [],
    };
  }

  const telefono = normalizarTelefono((p.From ?? "").replace(/^whatsapp:/, ""));
  if (!telefono) return null;
  const tieneMedia = Number(p.NumMedia ?? 0) > 0;
  return {
    numeroNegocio,
    estados: [],
    mensajes: [
      {
        idProveedor: p.MessageSid,
        telefono,
        nombrePerfil: p.ProfileName || null,
        tipo: tieneMedia ? "imagen" : p.Latitude ? "ubicacion" : "texto",
        texto: p.Body?.trim() || (tieneMedia ? "[Envió un archivo]" : p.Latitude ? "[Compartió una ubicación]" : null),
        recibidoEn: new Date(),
      },
    ],
  };
}
