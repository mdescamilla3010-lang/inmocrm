import { z } from "zod";
import { htmlATexto } from "./html";

/**
 * Formato del webhook de correo entrante de Postmark (Inbound). Si se cambia
 * de proveedor, sólo hay que escribir otro adaptador a `CorreoEntrante`.
 */
const esquemaPostmark = z.object({
  MessageID: z.string().min(1),
  From: z.string().default(""),
  ReplyTo: z.string().optional().nullable(),
  To: z.string().default(""),
  Cc: z.string().optional().nullable(),
  OriginalRecipient: z.string().optional().nullable(),
  ToFull: z.array(z.object({ Email: z.string() })).optional().default([]),
  CcFull: z.array(z.object({ Email: z.string() })).optional().default([]),
  Subject: z.string().default(""),
  TextBody: z.string().optional().nullable(),
  HtmlBody: z.string().optional().nullable(),
});

export type CorreoEntrante = {
  messageId: string;
  de: string;
  responderA: string | null;
  destinatarios: string[];
  asunto: string;
  texto: string;
};

export function correoDesdePostmark(cuerpo: unknown): CorreoEntrante | null {
  const r = esquemaPostmark.safeParse(cuerpo);
  if (!r.success) return null;
  const c = r.data;
  const destinatarios = [
    c.OriginalRecipient ?? "",
    ...c.ToFull.map((t) => t.Email),
    ...c.CcFull.map((t) => t.Email),
    ...c.To.split(","),
    ...(c.Cc ?? "").split(","),
  ]
    .map((d) => d.trim())
    .filter(Boolean);

  // El HTML suele traer más estructura (tablas) que el texto plano.
  const texto = c.HtmlBody ? htmlATexto(c.HtmlBody) : (c.TextBody ?? "");
  return {
    messageId: c.MessageID,
    de: c.From,
    responderA: c.ReplyTo || null,
    destinatarios: [...new Set(destinatarios)],
    asunto: c.Subject,
    texto,
  };
}
