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

const textoOpcional = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => v || null);

/** Formulario de Integraciones para conectar un número de la Cloud API. */
export const esquemaFormWhatsApp = z.object({
  phoneNumberId: z.string().trim().regex(/^\d{6,30}$/, { error: "El Phone number ID son sólo números" }),
  numero: z.string().trim().min(8, { error: "Escribe el número de WhatsApp" }),
  wabaId: textoOpcional(40),
  token: z.string().trim().min(20, { error: "Pega el token de acceso permanente" }).max(1000),
  plantillaBienvenida: textoOpcional(120),
  idioma: z.string().trim().regex(/^[a-z]{2}(_[A-Z]{2})?$/, { error: "Código de idioma como es_MX" }).default("es_MX"),
  textoBienvenida: textoOpcional(1024),
  plantillaAvisoAsesor: textoOpcional(120),
});

/** Rellena {{1}}, {{2}}… con los parámetros (para guardar lo que se envió). */
export function rellenarPlantilla(texto: string, parametros: string[]): string {
  return texto.replace(/\{\{(\d+)\}\}/g, (m, n: string) => parametros[Number(n) - 1] ?? m);
}
