import type Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { Constants } from "@/lib/supabase/database.types";

const E = Constants.public.Enums;

// Con strict: true todas las propiedades van en `required`; las opcionales se
// declaran como anulables.
const anulable = (tipo: "string" | "number" | "integer" | "boolean", extra: Record<string, unknown> = {}) => ({
  type: [tipo, "null"],
  ...extra,
});
const enumAnulable = (valores: readonly string[], description?: string) => ({
  type: ["string", "null"],
  enum: [...valores, null],
  ...(description ? { description } : {}),
});

function herramienta(name: string, description: string, properties: Record<string, unknown>): Anthropic.Beta.BetaTool {
  return {
    name,
    description,
    strict: true,
    input_schema: { type: "object", properties, required: Object.keys(properties), additionalProperties: false },
  };
}

export const MOTIVOS_ESCALAMIENTO = ["pide_humano", "negociacion", "queja", "no_entiende", "pregunta_especializada", "otro"] as const;

/** Orden fijo: cambiar el orden o el texto invalida la caché de prompts. */
export const HERRAMIENTAS: Anthropic.Beta.BetaTool[] = [
  herramienta(
    "guardar_calificacion",
    "Guarda lo que el prospecto ha dicho sobre lo que busca. Llámala en cuanto aprendas algo nuevo; usa null en lo que no sepas (no borra lo ya guardado). Devuelve el score actualizado y los datos que aún faltan.",
    {
      nombre: anulable("string", { description: "Nombre con el que se presentó" }),
      operacion: enumAnulable(E.operacion_propiedad),
      tipo_propiedad: enumAnulable(E.tipo_propiedad),
      zona: anulable("string", { description: "Zona, colonia o municipio tal como lo dijo" }),
      presupuesto_min: anulable("number", { description: "En pesos MXN (renta: mensual)" }),
      presupuesto_max: anulable("number", { description: "En pesos MXN (renta: mensual)" }),
      forma_pago: enumAnulable(E.forma_pago),
      credito_preaprobado: anulable("boolean", { description: "true si dijo que ya tiene el crédito aprobado o precalificado" }),
      urgencia: enumAnulable(E.urgencia_lead, "Para cuándo necesita la propiedad"),
      recamaras_min: anulable("integer"),
      notas: anulable("string", { description: "Otros detalles útiles para el asesor (mascotas, estacionamiento, etc.)" }),
    },
  ),
  herramienta(
    "buscar_propiedades",
    "Busca en el catálogo de la inmobiliaria propiedades disponibles que coincidan. Usa null en los criterios que no conozcas. Devuelve hasta 3 opciones con su id, precio y por qué le sirven.",
    {
      operacion: enumAnulable(E.operacion_propiedad),
      tipo_propiedad: enumAnulable(E.tipo_propiedad),
      zona: anulable("string"),
      presupuesto_min: anulable("number"),
      presupuesto_max: anulable("number"),
      recamaras_min: anulable("integer"),
      forma_pago: enumAnulable(E.forma_pago),
    },
  ),
  herramienta("enviar_fotos_propiedad", "Envía al prospecto por WhatsApp hasta 3 fotos de una propiedad del catálogo.", {
    propiedad_id: { type: "string", description: "id devuelto por buscar_propiedades" },
  }),
  herramienta(
    "ofrecer_horarios",
    "Consulta la agenda real de su asesor y devuelve hasta 4 horarios libres para visitar (hora local). Usa null si no pidió fecha o franja.",
    {
      fecha: anulable("string", { description: "Día que pidió, formato AAAA-MM-DD" }),
      franja: enumAnulable(["manana", "tarde", "cualquiera"], "manana = antes de las 13:00"),
    },
  ),
  herramienta(
    "agendar_cita",
    "Agenda la visita en el horario que eligió el prospecto. `inicio` debe ser exactamente uno de los que devolvió ofrecer_horarios.",
    {
      inicio: { type: "string", description: "Valor `inicio` (ISO) de la opción elegida" },
      propiedad_id: anulable("string", { description: "id de la propiedad que va a ver, si ya eligió una" }),
    },
  ),
  herramienta("confirmar_cita", "Marca como confirmada una visita agendada (p. ej. cuando responde que sí asistirá a un recordatorio).", {
    cita_id: { type: "string", description: "cita_id que aparece en el estado del lead" },
  }),
  herramienta("cancelar_cita", "Cancela una visita agendada (para reprogramar, cancela y luego ofrece horarios nuevos).", {
    cita_id: { type: "string", description: "cita_id que aparece en el estado del lead" },
    motivo: { type: "string", description: "Por qué la cancela, en pocas palabras" },
  }),
  herramienta(
    "registrar_interes_visita",
    "Úsala sólo si ninguno de los horarios ofrecidos le acomoda o no hay horarios: registra cuándo le gustaría visitar para que su asesor lo coordine.",
    {
      propiedad_id: anulable("string", { description: "id devuelto por buscar_propiedades, si ya eligió una" }),
      disponibilidad: { type: "string", description: "Días y horarios que propuso, tal como los dijo" },
    },
  ),
  herramienta(
    "escalar_a_asesor",
    "Pasa la conversación a un asesor humano. Después de llamarla ya no responderás más en esta conversación.",
    {
      motivo: { type: "string", enum: [...MOTIVOS_ESCALAMIENTO] },
      resumen: { type: "string", description: "Resumen breve para el asesor: qué busca y qué pidió" },
    },
  ),
  herramienta("registrar_baja", "Registra que el prospecto pidió no ser contactado más.", {}),
];

const numeroPositivo = z.number().positive().nullable();

export const ESQUEMAS = {
  guardar_calificacion: z.object({
    nombre: z.string().trim().max(120).nullable(),
    operacion: z.enum(E.operacion_propiedad).nullable(),
    tipo_propiedad: z.enum(E.tipo_propiedad).nullable(),
    zona: z.string().trim().max(200).nullable(),
    presupuesto_min: numeroPositivo,
    presupuesto_max: numeroPositivo,
    forma_pago: z.enum(E.forma_pago).nullable(),
    credito_preaprobado: z.boolean().nullable(),
    urgencia: z.enum(E.urgencia_lead).nullable(),
    recamaras_min: z.number().int().min(0).max(20).nullable(),
    notas: z.string().trim().max(1000).nullable(),
  }),
  buscar_propiedades: z.object({
    operacion: z.enum(E.operacion_propiedad).nullable(),
    tipo_propiedad: z.enum(E.tipo_propiedad).nullable(),
    zona: z.string().trim().max(200).nullable(),
    presupuesto_min: numeroPositivo,
    presupuesto_max: numeroPositivo,
    recamaras_min: z.number().int().min(0).max(20).nullable(),
    forma_pago: z.enum(E.forma_pago).nullable(),
  }),
  enviar_fotos_propiedad: z.object({ propiedad_id: z.uuid() }),
  ofrecer_horarios: z.object({
    fecha: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/)
      .nullable(),
    franja: z.enum(["manana", "tarde", "cualquiera"]).nullable(),
  }),
  agendar_cita: z.object({
    inicio: z.iso.datetime({ offset: true }),
    propiedad_id: z.uuid().nullable(),
  }),
  confirmar_cita: z.object({ cita_id: z.uuid() }),
  cancelar_cita: z.object({ cita_id: z.uuid(), motivo: z.string().trim().min(1).max(300) }),
  registrar_interes_visita: z.object({ propiedad_id: z.uuid().nullable(), disponibilidad: z.string().trim().min(1).max(500) }),
  escalar_a_asesor: z.object({ motivo: z.enum(MOTIVOS_ESCALAMIENTO), resumen: z.string().trim().min(1).max(1000) }),
  registrar_baja: z.object({}),
} as const;

export type NombreHerramienta = keyof typeof ESQUEMAS;
export type EntradaHerramienta<N extends NombreHerramienta> = z.infer<(typeof ESQUEMAS)[N]>;

export function esHerramienta(nombre: string): nombre is NombreHerramienta {
  return nombre in ESQUEMAS;
}
