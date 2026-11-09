import { z } from "zod";
import type { HorarioVisitas } from "./disponibilidad";

export const DIAS = [
  { clave: "lun", nombre: "Lunes" },
  { clave: "mar", nombre: "Martes" },
  { clave: "mie", nombre: "Miércoles" },
  { clave: "jue", nombre: "Jueves" },
  { clave: "vie", nombre: "Viernes" },
  { clave: "sab", nombre: "Sábado" },
  { clave: "dom", nombre: "Domingo" },
] as const;

const HORA = /^([01]\d|2[0-3]):[0-5]\d$/;
const aMinutos = (h: string) => Number(h.slice(0, 2)) * 60 + Number(h.slice(3, 5));

/**
 * Formulario de Configuración → Agenda. Por día: `abierto_<dia>` (casilla),
 * `desde_<dia>` y `hasta_<dia>` (HH:MM).
 */
export function leerConfigAgenda(campos: Record<string, string>):
  | { ok: true; datos: { horario: HorarioVisitas; duracionMin: number; margenMin: number; anticipacionMin: number } }
  | { ok: false; errores: Record<string, string> } {
  const errores: Record<string, string> = {};
  const horario: HorarioVisitas = {};

  for (const { clave, nombre } of DIAS) {
    if (campos[`abierto_${clave}`] !== "on") {
      horario[clave] = null;
      continue;
    }
    const desde = campos[`desde_${clave}`] ?? "";
    const hasta = campos[`hasta_${clave}`] ?? "";
    if (!HORA.test(desde) || !HORA.test(hasta)) {
      errores[clave] = `${nombre}: usa horas como 09:00`;
    } else if (aMinutos(desde) >= aMinutos(hasta)) {
      errores[clave] = `${nombre}: la hora de cierre debe ser después de la de apertura`;
    } else {
      horario[clave] = [desde, hasta];
    }
  }

  const numeros = z.object({
    duracionMin: z.coerce.number().int().min(15, { error: "Mínimo 15 minutos" }).max(240, { error: "Máximo 4 horas" }),
    margenMin: z.coerce.number().int().min(0).max(180, { error: "Máximo 3 horas" }),
    anticipacionHoras: z.coerce.number().min(0).max(48, { error: "Máximo 48 horas" }),
  });
  const n = numeros.safeParse(campos);
  if (!n.success) for (const i of n.error.issues) errores[String(i.path[0])] ??= i.message;

  if (n.success) {
    for (const { clave, nombre } of DIAS) {
      const rango = horario[clave];
      if (rango && aMinutos(rango[1]) - aMinutos(rango[0]) < n.data.duracionMin) {
        errores[clave] ??= `${nombre}: el horario es más corto que una visita`;
      }
    }
  }
  if (!Object.values(horario).some(Boolean)) errores._ = "Abre al menos un día para recibir visitas";
  if (Object.keys(errores).length || !n.success) return { ok: false, errores };

  return {
    ok: true,
    datos: {
      horario,
      duracionMin: n.data.duracionMin,
      margenMin: n.data.margenMin,
      anticipacionMin: Math.round(n.data.anticipacionHoras * 60),
    },
  };
}

/** Agendar desde el detalle del lead: un horario libre o uno manual (hora local). */
export const esquemaAgendarPanel = z
  .object({
    inicio: z.string().optional().transform((v) => v || null),
    manual: z
      .string()
      .optional()
      .transform((v) => v || null),
    propiedadId: z.preprocess((v) => (v === "" ? null : v), z.uuid().nullable().optional()),
    notas: z.string().trim().max(500).optional().transform((v) => v || null),
  })
  .transform((d, ctx) => {
    if (d.manual) {
      const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/.exec(d.manual);
      if (!m) {
        ctx.addIssue({ code: "custom", path: ["manual"], message: "Fecha y hora no válidas" });
        return z.NEVER;
      }
      return {
        tipo: "manual" as const,
        local: { anio: +m[1], mes: +m[2], dia: +m[3], hora: +m[4], minuto: +m[5] },
        propiedadId: d.propiedadId ?? null,
        notas: d.notas,
      };
    }
    if (!d.inicio || Number.isNaN(Date.parse(d.inicio))) {
      ctx.addIssue({ code: "custom", path: ["inicio"], message: "Elige un horario" });
      return z.NEVER;
    }
    return { tipo: "libre" as const, inicio: new Date(d.inicio), propiedadId: d.propiedadId ?? null, notas: d.notas };
  });
