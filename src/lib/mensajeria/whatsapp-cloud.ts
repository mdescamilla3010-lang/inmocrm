import { z } from "zod";
import { normalizarTelefono } from "@/lib/telefono";
import {
  ErrorMensajeria,
  type ActualizacionEstado,
  type EstadoEntrega,
  type EventoMensajeria,
  type MensajeEntrante,
  type Plantilla,
  type ProveedorMensajeria,
  type ResultadoEnvio,
  type TipoMensaje,
} from "./tipos";

/** WhatsApp Business Cloud API (Graph API de Meta). */
export class ProveedorWhatsAppCloud implements ProveedorMensajeria {
  readonly nombre = "whatsapp_cloud" as const;

  constructor(
    private readonly cfg: { phoneNumberId: string; token: string; version: string; fetchFn?: typeof fetch },
  ) {}

  enviarTexto(para: string, texto: string) {
    return this.enviar(para, { type: "text", text: { body: texto, preview_url: false } });
  }

  enviarPlantilla(para: string, p: Plantilla) {
    return this.enviar(para, {
      type: "template",
      template: {
        name: p.nombre,
        language: { code: p.idioma },
        components: p.parametros.length
          ? [{ type: "body", parameters: p.parametros.map((text) => ({ type: "text", text })) }]
          : [],
      },
    });
  }

  enviarImagen(para: string, url: string, pie?: string) {
    return this.enviar(para, { type: "image", image: { link: url, ...(pie ? { caption: pie } : {}) } });
  }

  private async enviar(para: string, contenido: Record<string, unknown>): Promise<ResultadoEnvio> {
    const f = this.cfg.fetchFn ?? fetch;
    const url = `https://graph.facebook.com/${this.cfg.version}/${encodeURIComponent(this.cfg.phoneNumberId)}/messages`;
    const respuesta = await f(url, {
      method: "POST",
      headers: { Authorization: `Bearer ${this.cfg.token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ messaging_product: "whatsapp", recipient_type: "individual", to: para.replace(/^\+/, ""), ...contenido }),
      signal: AbortSignal.timeout(15_000),
    });
    const cuerpo = (await respuesta.json().catch(() => null)) as
      | { messages?: { id: string }[]; error?: { message?: string; code?: number } }
      | null;
    const id = cuerpo?.messages?.[0]?.id;
    if (!respuesta.ok || !id) {
      throw new ErrorMensajeria(`WhatsApp: ${cuerpo?.error?.message ?? `HTTP ${respuesta.status}`}`, cuerpo?.error);
    }
    return { idProveedor: id };
  }
}

const esquemaWebhook = z.object({
  object: z.literal("whatsapp_business_account"),
  entry: z.array(
    z.object({
      changes: z.array(
        z.object({
          field: z.string(),
          value: z
            .object({
              metadata: z.object({ phone_number_id: z.string() }),
              contacts: z.array(z.object({ wa_id: z.string(), profile: z.object({ name: z.string() }).partial().optional() })).optional(),
              messages: z.array(z.record(z.string(), z.unknown())).optional(),
              statuses: z
                .array(
                  z.object({
                    id: z.string(),
                    status: z.string(),
                    errors: z.array(z.object({ title: z.string().optional(), message: z.string().optional() })).optional(),
                  }),
                )
                .optional(),
            })
            .passthrough(),
        }),
      ),
    }),
  ),
});

const ESTADOS: Record<string, EstadoEntrega> = { sent: "enviado", delivered: "entregado", read: "leido", failed: "fallido" };

function textoDe(m: Record<string, unknown>): { tipo: TipoMensaje; texto: string | null } {
  const obj = (k: string) => (m[k] && typeof m[k] === "object" ? (m[k] as Record<string, unknown>) : {});
  const str = (v: unknown) => (typeof v === "string" && v.trim() ? v : null);
  switch (m.type) {
    case "text":
      return { tipo: "texto", texto: str(obj("text").body) };
    case "button":
      return { tipo: "interactivo", texto: str(obj("button").text) };
    case "interactive": {
      const i = obj("interactive");
      const r = (i.button_reply ?? i.list_reply ?? {}) as Record<string, unknown>;
      return { tipo: "interactivo", texto: str(r.title) };
    }
    case "image":
      return { tipo: "imagen", texto: str(obj("image").caption) ?? "[Envió una imagen]" };
    case "document":
      return { tipo: "documento", texto: str(obj("document").caption) ?? "[Envió un documento]" };
    case "audio":
      return { tipo: "audio", texto: "[Envió una nota de voz]" };
    case "location": {
      const l = obj("location");
      return { tipo: "ubicacion", texto: `[Compartió una ubicación${l.name ? `: ${l.name}` : ""}${l.address ? `, ${l.address}` : ""}]` };
    }
    default:
      return { tipo: "otro", texto: `[Mensaje de tipo ${String(m.type)}]` };
  }
}

/** Convierte el webhook de la Cloud API en eventos agrupados por número del negocio. */
export function parsearWebhookWhatsApp(cuerpo: unknown): EventoMensajeria[] {
  const r = esquemaWebhook.safeParse(cuerpo);
  if (!r.success) return [];
  const eventos = new Map<string, EventoMensajeria>();

  for (const entry of r.data.entry) {
    for (const change of entry.changes) {
      if (change.field !== "messages") continue;
      const v = change.value;
      const numero = v.metadata.phone_number_id;
      const evento = eventos.get(numero) ?? { numeroNegocio: numero, mensajes: [], estados: [] };
      eventos.set(numero, evento);
      const nombres = new Map((v.contacts ?? []).map((c) => [c.wa_id, c.profile?.name ?? null]));

      for (const m of v.messages ?? []) {
        const telefono = normalizarTelefono(`+${String(m.from ?? "")}`);
        if (!telefono || typeof m.id !== "string") continue;
        const { tipo, texto } = textoDe(m);
        const segundos = Number(m.timestamp);
        evento.mensajes.push({
          idProveedor: m.id,
          telefono,
          nombrePerfil: nombres.get(String(m.from)) ?? null,
          tipo,
          texto,
          recibidoEn: Number.isFinite(segundos) ? new Date(segundos * 1000) : new Date(),
        } satisfies MensajeEntrante);
      }
      for (const s of v.statuses ?? []) {
        const estado = ESTADOS[s.status];
        if (!estado) continue;
        const e = s.errors?.[0];
        evento.estados.push({ idProveedor: s.id, estado, error: e ? (e.message ?? e.title ?? "Error") : null } satisfies ActualizacionEstado);
      }
    }
  }
  return [...eventos.values()];
}
