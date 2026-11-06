import { localAUtc, partesLocales, sumarDias } from "@/lib/calendario/zona-horaria";

export const PERIODOS = [
  { clave: "7d", etiqueta: "Últimos 7 días" },
  { clave: "30d", etiqueta: "Últimos 30 días" },
  { clave: "90d", etiqueta: "Últimos 90 días" },
  { clave: "mes", etiqueta: "Este mes" },
  { clave: "mes_anterior", etiqueta: "Mes anterior" },
] as const;

export type ClavePeriodo = (typeof PERIODOS)[number]["clave"];

export type Rango = {
  desde: Date;
  hasta: Date;
  /** Periodo inmediato anterior de la misma duración, para comparar. */
  anteriorDesde: Date;
  anteriorHasta: Date;
  etiqueta: string;
};

export function esClavePeriodo(v: unknown): v is ClavePeriodo {
  return PERIODOS.some((p) => p.clave === v);
}

const medianoche = (zona: string, f: { anio: number; mes: number; dia: number }) => localAUtc(zona, { ...f, hora: 0, minuto: 0 });
const nombreMes = (zona: string, d: Date) => new Intl.DateTimeFormat("es-MX", { month: "long", year: "numeric", timeZone: zona }).format(d);

/**
 * Rangos en días completos de la hora local de la inmobiliaria. "Este mes"
 * va del día 1 a hoy y se compara contra los mismos días del mes anterior.
 */
export function rangoPeriodo(clave: ClavePeriodo, ahora: Date, zona: string): Rango {
  const hoy = partesLocales(zona, ahora);
  const manana = medianoche(zona, sumarDias(hoy, 1));

  if (clave === "7d" || clave === "30d" || clave === "90d") {
    const n = Number(clave.replace("d", ""));
    const desde = medianoche(zona, sumarDias(hoy, -(n - 1)));
    return {
      desde,
      hasta: manana,
      anteriorDesde: medianoche(zona, sumarDias(hoy, -(2 * n - 1))),
      anteriorHasta: desde,
      etiqueta: PERIODOS.find((p) => p.clave === clave)!.etiqueta,
    };
  }

  const primeroEsteMes = { anio: hoy.anio, mes: hoy.mes, dia: 1 };
  const primeroMesAnterior = hoy.mes === 1 ? { anio: hoy.anio - 1, mes: 12, dia: 1 } : { anio: hoy.anio, mes: hoy.mes - 1, dia: 1 };
  const primeroAntesAnterior =
    primeroMesAnterior.mes === 1 ? { anio: primeroMesAnterior.anio - 1, mes: 12, dia: 1 } : { ...primeroMesAnterior, mes: primeroMesAnterior.mes - 1 };

  if (clave === "mes") {
    const desde = medianoche(zona, primeroEsteMes);
    const diasTranscurridos = hoy.dia; // incluye hoy
    const anteriorDesde = medianoche(zona, primeroMesAnterior);
    // Mismos días del mes anterior, sin pasarse de su fin (31 → 30, etc.).
    const anteriorHasta = new Date(Math.min(medianoche(zona, sumarDias(primeroMesAnterior, diasTranscurridos)).getTime(), desde.getTime()));
    return { desde, hasta: manana, anteriorDesde, anteriorHasta, etiqueta: `${nombreMes(zona, ahora)} (al día de hoy)` };
  }

  const desde = medianoche(zona, primeroMesAnterior);
  return {
    desde,
    hasta: medianoche(zona, primeroEsteMes),
    anteriorDesde: medianoche(zona, primeroAntesAnterior),
    anteriorHasta: desde,
    etiqueta: nombreMes(zona, new Date(desde.getTime() + 12 * 3_600_000)),
  };
}
