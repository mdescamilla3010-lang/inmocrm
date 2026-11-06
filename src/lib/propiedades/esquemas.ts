import { z } from "zod";
import { interpretarMonto } from "@/lib/formato";
import { Constants } from "@/lib/supabase/database.types";

const E = Constants.public.Enums;

const vacioANull = <T extends z.ZodType>(esquema: T) =>
  z.preprocess((v) => (v === undefined || (typeof v === "string" && v.trim() === "") ? null : v), esquema.nullable());
const texto = (max: number) => vacioANull(z.string().trim().max(max, { error: "Texto demasiado largo" }));
const entero = (max: number) => vacioANull(z.coerce.number({ error: "Número no válido" }).int({ error: "Usa un número entero" }).min(0).max(max));
const decimal = (max: number) =>
  vacioANull(z.coerce.number({ error: "Número no válido" }).positive({ error: "Debe ser mayor a 0" }).max(max));
const casilla = z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean());

export const esquemaPropiedad = z.object({
  titulo: z.string({ error: "Escribe un título" }).trim().min(3, { error: "El título es muy corto" }).max(150),
  clave: texto(40),
  descripcion: texto(5000),
  tipo: z.enum(E.tipo_propiedad, { error: "Elige el tipo" }),
  operacion: z.enum(E.operacion_propiedad, { error: "Elige venta o renta" }),
  estado: z.enum(E.estado_propiedad, { error: "Estado no válido" }),
  precio: z
    .string({ error: "Escribe el precio" })
    .transform((v, ctx) => {
      const n = interpretarMonto(v);
      if (n === null) {
        ctx.addIssue({ code: "custom", message: "Precio no válido (ej. 2,500,000 o 2.5M)" });
        return z.NEVER;
      }
      return n;
    }),
  moneda: z.enum(["MXN", "USD"]).default("MXN"),
  zona_id: vacioANull(z.uuid()),
  colonia: texto(120),
  municipio: texto(120),
  entidad_federativa: texto(60),
  codigo_postal: vacioANull(z.string().trim().regex(/^\d{5}$/, { error: "El código postal son 5 dígitos" })),
  direccion: texto(300),
  recamaras: entero(50),
  banos: vacioANull(
    z.coerce
      .number({ error: "Número no válido" })
      .min(0)
      .max(50)
      .refine((n) => Number.isInteger(n * 2), { error: "Usa enteros o medios (ej. 2.5)" }),
  ),
  estacionamientos: entero(50),
  m2_construccion: decimal(1_000_000),
  m2_terreno: decimal(10_000_000),
  acepta_credito_bancario: casilla,
  acepta_infonavit: casilla,
  acepta_fovissste: casilla,
  amenidades: z
    .string()
    .optional()
    .transform((v) =>
      [...new Set((v ?? "").split(/[,\n]/).map((a) => a.trim()).filter(Boolean))].slice(0, 40),
    ),
  asesor_responsable_id: vacioANull(z.uuid()),
});

export type DatosPropiedad = z.output<typeof esquemaPropiedad>;
