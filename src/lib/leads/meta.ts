import { createHmac, timingSafeEqual } from "node:crypto";
import { z } from "zod";
import { normalizarTelefono } from "@/lib/telefono";

/**
 * Verifica X-Hub-Signature-256 (HMAC-SHA256 del body crudo con el App Secret).
 * Comparación en tiempo constante.
 */
export function verificarFirmaMeta(cuerpoCrudo: string, firma: string | null, appSecret: string): boolean {
  if (!firma?.startsWith("sha256=")) return false;
  const esperada = createHmac("sha256", appSecret).update(cuerpoCrudo, "utf8").digest();
  let recibida: Buffer;
  try {
    recibida = Buffer.from(firma.slice("sha256=".length), "hex");
  } catch {
    return false;
  }
  return recibida.length === esperada.length && timingSafeEqual(recibida, esperada);
}

const esquemaWebhook = z.object({
  object: z.string(),
  entry: z.array(
    z.object({
      id: z.string(),
      changes: z
        .array(
          z.object({
            field: z.string(),
            value: z
              .object({
                leadgen_id: z.coerce.string(),
                page_id: z.coerce.string(),
                form_id: z.coerce.string().optional(),
                ad_id: z.coerce.string().optional(),
                created_time: z.number().optional(),
              })
              .passthrough(),
          }),
        )
        .default([]),
    }),
  ),
});

export type AvisoLeadMeta = {
  pageId: string;
  leadgenId: string;
  formId?: string;
  adId?: string;
};

/** Extrae los avisos de lead nuevo del webhook (ignora otros campos de la página). */
export function parsearWebhookMeta(cuerpo: unknown): AvisoLeadMeta[] {
  const r = esquemaWebhook.safeParse(cuerpo);
  if (!r.success || r.data.object !== "page") return [];
  return r.data.entry.flatMap((e) =>
    e.changes
      .filter((c) => c.field === "leadgen")
      .map((c) => ({
        pageId: c.value.page_id,
        leadgenId: c.value.leadgen_id,
        formId: c.value.form_id,
        adId: c.value.ad_id,
      })),
  );
}

export const esquemaLeadGraph = z.object({
  id: z.string(),
  created_time: z.string().optional(),
  form_id: z.string().optional(),
  ad_id: z.string().optional(),
  campaign_id: z.string().optional(),
  field_data: z.array(z.object({ name: z.string(), values: z.array(z.string()).default([]) })).default([]),
});

export type LeadGraph = z.infer<typeof esquemaLeadGraph>;

export type ContactoMeta = {
  nombre: string | null;
  telefono: string | null;
  email: string | null;
  /** Preguntas personalizadas del formulario (presupuesto, zona…). */
  respuestas: Record<string, string>;
};

const CAMPOS_ESTANDAR = new Set(["full_name", "first_name", "last_name", "phone_number", "email"]);

/** Convierte field_data de la Graph API en datos de contacto. */
export function mapearCamposMeta(fieldData: LeadGraph["field_data"]): ContactoMeta {
  const valor = (nombre: string) => fieldData.find((f) => f.name === nombre)?.values[0]?.trim() || null;

  const nombreCompleto =
    valor("full_name") ?? ([valor("first_name"), valor("last_name")].filter(Boolean).join(" ") || null);

  const respuestas: Record<string, string> = {};
  for (const f of fieldData) {
    if (!CAMPOS_ESTANDAR.has(f.name) && f.values.length) {
      respuestas[f.name] = f.values.join(", ");
    }
  }

  return {
    nombre: nombreCompleto,
    telefono: normalizarTelefono(valor("phone_number")),
    email: valor("email")?.toLowerCase() ?? null,
    respuestas,
  };
}

/** Texto legible de las respuestas personalizadas para mostrar al asesor y al agente. */
export function resumirRespuestas(respuestas: Record<string, string>): string | null {
  const lineas = Object.entries(respuestas).map(([pregunta, r]) => `${pregunta.replace(/_/g, " ")}: ${r}`);
  return lineas.length ? lineas.join("\n") : null;
}
