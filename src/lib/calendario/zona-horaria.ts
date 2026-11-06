/**
 * Conversión entre hora local de una zona IANA y UTC usando sólo Intl.
 * Correcta también para zonas con horario de verano (Tijuana, Cd. Juárez…).
 */

export type FechaLocal = { anio: number; mes: number; dia: number; hora: number; minuto: number };
export type PartesLocales = FechaLocal & { diaSemana: number }; // 0 = domingo

const formateadores = new Map<string, Intl.DateTimeFormat>();

function formateador(zona: string) {
  let f = formateadores.get(zona);
  if (!f) {
    f = new Intl.DateTimeFormat("en-US", {
      timeZone: zona,
      hourCycle: "h23",
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
      weekday: "short",
    });
    formateadores.set(zona, f);
  }
  return f;
}

const DIAS_SEMANA: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };

export function partesLocales(zona: string, instante: Date): PartesLocales {
  const partes = Object.fromEntries(formateador(zona).formatToParts(instante).map((p) => [p.type, p.value]));
  return {
    anio: Number(partes.year),
    mes: Number(partes.month),
    dia: Number(partes.day),
    hora: Number(partes.hour),
    minuto: Number(partes.minute),
    diaSemana: DIAS_SEMANA[partes.weekday] ?? 0,
  };
}

/** Minutos que la zona va adelante de UTC en ese instante (México centro: -360). */
export function desfaseMinutos(zona: string, instante: Date): number {
  const p = partesLocales(zona, instante);
  const comoUtc = Date.UTC(p.anio, p.mes - 1, p.dia, p.hora, p.minuto);
  const sinSegundos = Math.floor(instante.getTime() / 60_000) * 60_000;
  return Math.round((comoUtc - sinSegundos) / 60_000);
}

/** Instante UTC de una hora local. En el salto de horario de verano se recorre hacia adelante. */
export function localAUtc(zona: string, f: FechaLocal): Date {
  const ingenuo = Date.UTC(f.anio, f.mes - 1, f.dia, f.hora, f.minuto);
  let utc = ingenuo - desfaseMinutos(zona, new Date(ingenuo)) * 60_000;
  // Segunda pasada: el desfase pudo cambiar entre la estimación y el resultado.
  utc = ingenuo - desfaseMinutos(zona, new Date(utc)) * 60_000;
  return new Date(utc);
}

/** Suma días a una fecha de calendario (sin horas), cruzando meses y años. */
export function sumarDias(f: { anio: number; mes: number; dia: number }, dias: number) {
  const d = new Date(Date.UTC(f.anio, f.mes - 1, f.dia + dias));
  return { anio: d.getUTCFullYear(), mes: d.getUTCMonth() + 1, dia: d.getUTCDate(), diaSemana: d.getUTCDay() };
}

/** "YYYY-MM-DD" de la fecha local. */
export function fechaIso(f: { anio: number; mes: number; dia: number }): string {
  return `${f.anio}-${String(f.mes).padStart(2, "0")}-${String(f.dia).padStart(2, "0")}`;
}
