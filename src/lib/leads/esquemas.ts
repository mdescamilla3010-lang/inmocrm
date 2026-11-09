import { z } from "zod";
import { interpretarMonto } from "@/lib/formato";
import { normalizarTelefono } from "@/lib/telefono";
import { Constants } from "@/lib/supabase/database.types";

const E = Constants.public.Enums;

/** "" o ausente → null; para selects y campos opcionales de formularios. */
const vacioANull = <T extends z.ZodType>(esquema: T) =>
  z.preprocess(
    (v) => (v === undefined || (typeof v === "string" && v.trim() === "") ? null : v),
    esquema.nullable(),
  );

const monto = z
  .string()
  .optional()
  .transform((v, ctx) => {
    if (!v || !v.trim()) return null;
    const n = interpretarMonto(v);
    if (n === null) {
      ctx.addIssue({ code: "custom", message: "Monto no válido (ej. 2,500,000 o 2.5M)" });
      return z.NEVER;
    }
    return n;
  });

const telefonoOpcional = z
  .string()
  .optional()
  .transform((v, ctx) => {
    if (!v || !v.trim()) return null;
    const n = normalizarTelefono(v);
    if (!n) {
      ctx.addIssue({ code: "custom", message: "Teléfono no válido" });
      return z.NEVER;
    }
    return n;
  });

const emailOpcional = vacioANull(z.string().trim().toLowerCase().pipe(z.email({ error: "Correo no válido" })));
const textoOpcional = (max: number) => vacioANull(z.string().trim().max(max, { error: "Texto demasiado largo" }));

export const esquemaContacto = z
  .object({
    nombre: textoOpcional(120),
    telefono: telefonoOpcional,
    email: emailOpcional,
  })
  .refine((d) => d.telefono || d.email, { path: ["telefono"], error: "Captura un teléfono o un correo" });

export const esquemaLeadManual = esquemaContacto.and(
  z.object({
    mensaje: textoOpcional(2000),
    // "" = asignación automática (sólo el dueño puede elegir)
    asesorId: vacioANull(z.uuid()),
  }),
);

export const esquemaCalificacion = z
  .object({
    operacion_interes: vacioANull(z.enum(E.operacion_propiedad)),
    tipo_propiedad_interes: vacioANull(z.enum(E.tipo_propiedad)),
    zona_interes: textoOpcional(200),
    zona_id: vacioANull(z.uuid()),
    presupuesto_min: monto,
    presupuesto_max: monto,
    forma_pago: vacioANull(z.enum(E.forma_pago)),
    credito_preaprobado: z
      .enum(["", "si", "no"])
      .optional()
      .transform((v) => (v === "si" ? true : v === "no" ? false : null)),
    urgencia: vacioANull(z.enum(E.urgencia_lead)),
    recamaras_min: vacioANull(z.coerce.number().int().min(0).max(20)),
    notas_calificacion: textoOpcional(2000),
  })
  .refine((d) => d.presupuesto_min === null || d.presupuesto_max === null || d.presupuesto_max >= d.presupuesto_min, {
    path: ["presupuesto_max"],
    error: "El máximo debe ser mayor o igual al mínimo",
  });

export const esquemaEstado = z.object({ estado: z.enum(E.estado_lead, { error: "Estado no válido" }) });

export const esquemaReasignar = z.object({ asesorId: z.uuid({ error: "Elige un asesor" }) });

export const esquemaNota = z.object({
  texto: z.string().trim().min(1, { error: "Escribe la nota" }).max(2000, { error: "La nota es muy larga" }),
});
