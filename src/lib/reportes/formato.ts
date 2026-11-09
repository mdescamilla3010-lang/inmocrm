import { z } from "zod";

/** 45 → "45 s", 240 → "4 min", 4800 → "1 h 20 min", 183600 → "2 d 3 h". */
export function formatearDuracion(segundos: number | null | undefined): string {
  if (segundos === null || segundos === undefined || !Number.isFinite(segundos)) return "—";
  const s = Math.max(0, Math.round(segundos));
  if (s < 60) return `${s} s`;
  const min = Math.round(s / 60);
  if (min < 60) return `${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return min % 60 ? `${h} h ${min % 60} min` : `${h} h`;
  const d = Math.floor(h / 24);
  return h % 24 ? `${d} d ${h % 24} h` : `${d} d`;
}

/** Proporción 0–1, o null si no hay base. */
export function proporcion(parte: number, total: number): number | null {
  return total > 0 ? parte / total : null;
}

const pct = new Intl.NumberFormat("es-MX", { style: "percent", maximumFractionDigits: 0 });
const pctFino = new Intl.NumberFormat("es-MX", { style: "percent", maximumFractionDigits: 1 });

export function formatearPorcentaje(p: number | null): string {
  if (p === null) return "—";
  // Con menos de 10 % un decimal sí cambia la lectura (3.4 % vs 3 %).
  return (p > 0 && p < 0.1 ? pctFino : pct).format(p);
}

export type Variacion = { texto: string; sentido: "sube" | "baja" | "igual"; calificacion: "buena" | "mala" | "neutra" };

/**
 * Cambio contra el periodo anterior. `mejorSiBaja` para métricas donde bajar es
 * bueno (tiempo de respuesta). Para proporciones se reporta en puntos.
 */
export function variacion(
  actual: number | null,
  anterior: number | null,
  o: { mejorSiBaja?: boolean; esProporcion?: boolean } = {},
): Variacion | null {
  if (actual === null || anterior === null) return null;
  const neutra = { texto: "Igual que el periodo anterior", sentido: "igual" as const, calificacion: "neutra" as const };
  let texto: string;
  let delta: number;
  if (o.esProporcion) {
    delta = Math.round((actual - anterior) * 100);
    if (delta === 0) return neutra;
    texto = `${delta > 0 ? "+" : "−"}${Math.abs(delta)} pts`;
  } else {
    if (anterior === 0) return actual === 0 ? neutra : { texto: "Sin datos del periodo anterior", sentido: "sube", calificacion: "neutra" };
    delta = Math.round(((actual - anterior) / anterior) * 100);
    if (delta === 0) return neutra;
    texto = `${delta > 0 ? "+" : "−"}${Math.abs(delta)} %`;
  }
  const sentido = delta > 0 ? "sube" : "baja";
  const buena = o.mejorSiBaja ? sentido === "baja" : sentido === "sube";
  return { texto, sentido, calificacion: buena ? "buena" : "mala" };
}

const conteo = z.number().int().nonnegative();
const segundos = z.number().nonnegative().nullable();

/** Lo que devuelve public.reporte_dueno(). */
export const esquemaReporte = z.object({
  leads: conteo,
  respuesta: z.object({
    medidos: conteo,
    promedio_seg: segundos,
    mediana_seg: segundos,
    p90_seg: segundos,
    menos_1_min: conteo,
    sin_contacto: conteo,
  }),
  embudo: z.object({ leads: conteo, contactados: conteo, respondieron: conteo, con_cita: conteo, visitaron: conteo }),
  por_score: z.object({ caliente: conteo, tibio: conteo, frio: conteo, sin_score: conteo }),
  por_fuente: z.array(
    z.object({ fuente: z.string(), leads: conteo, con_cita: conteo, calientes: conteo, mediana_resp_seg: segundos }),
  ),
  por_asesor: z.array(
    z.object({
      asesor_id: z.string(),
      nombre: z.string(),
      activo: z.boolean(),
      leads_asignados: conteo,
      leads_con_cita: conteo,
      citas: conteo,
      visitas_realizadas: conteo,
      no_asistio: conteo,
      canceladas: conteo,
      pendientes: conteo,
      agendadas_por_agente: conteo,
    }),
  ),
  sin_asignar: conteo,
  por_dia: z.array(z.object({ dia: z.string(), leads: conteo, con_cita: conteo })),
});

export type Reporte = z.infer<typeof esquemaReporte>;

/** Marcas de eje "limpias": 0 y un tope redondo ≥ al máximo. */
export function topeEje(maximo: number): number {
  if (maximo <= 0) return 1;
  const magnitud = 10 ** Math.floor(Math.log10(maximo));
  for (const paso of [1, 2, 2.5, 5, 10]) {
    if (paso * magnitud >= maximo) return paso * magnitud;
  }
  return 10 * magnitud;
}
