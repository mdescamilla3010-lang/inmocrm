import { z } from "zod";

/** `integraciones.config` de un número de WhatsApp (no secreto). */
export const esquemaConfigWhatsApp = z.object({
  numero: z.string().nullable().optional(),
  waba_id: z.string().nullable().optional(),
  /** Plantilla aprobada para el primer mensaje a leads de anuncios/portales. */
  plantilla_bienvenida: z.string().nullable().optional(),
  idioma: z.string().default("es_MX"),
  /** Texto aprobado de la plantilla con {{1}} = nombre del prospecto y {{2}} = inmobiliaria. */
  texto_bienvenida: z.string().nullable().optional(),
  /** Plantilla para avisar al asesor ({{1}} prospecto, {{2}} motivo). */
  plantilla_aviso_asesor: z.string().nullable().optional(),
});
export type ConfigWhatsApp = z.infer<typeof esquemaConfigWhatsApp>;

export const esquemaCredencialesCloud = z.object({ token: z.string().min(10) });
export const esquemaCredencialesTwilio = z.object({ accountSid: z.string().min(10), authToken: z.string().min(10), numero: z.string() });

/** Rellena {{1}}, {{2}}… con los parámetros (para guardar lo que se envió). */
export function rellenarPlantilla(texto: string, parametros: string[]): string {
  return texto.replace(/\{\{(\d+)\}\}/g, (m, n: string) => parametros[Number(n) - 1] ?? m);
}
