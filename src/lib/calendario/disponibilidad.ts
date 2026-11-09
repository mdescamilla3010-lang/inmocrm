import { fechaIso, localAUtc, partesLocales, sumarDias } from "./zona-horaria";

export type Intervalo = { inicio: Date; fin: Date };

/** {"lun": ["09:00", "19:00"], …, "dom": null} — formato de inmobiliarias.horario_visitas. */
export type HorarioVisitas = Partial<Record<"lun" | "mar" | "mie" | "jue" | "vie" | "sab" | "dom", [string, string] | null>>;

const CLAVE_DIA = ["dom", "lun", "mar", "mie", "jue", "vie", "sab"] as const;

export type ParametrosDisponibilidad = {
  horario: HorarioVisitas;
  zonaHoraria: string;
  duracionMin: number;
  /** Tiempo libre antes y después de cada compromiso (traslados). */
  margenMin: number;
  /** No ofrecer nada que empiece antes de ahora + anticipación. */
  anticipacionMin: number;
  /** Ocupado según Google Calendar y citas ya agendadas. */
  ocupados: readonly Intervalo[];
  ahora: Date;
  dias: number;
  /** Cada cuántos minutos puede empezar una visita. */
  pasoMin?: number;
};

function minutosDelDia(hhmm: string): number | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(hhmm);
  if (!m) return null;
  const h = Number(m[1]);
  const min = Number(m[2]);
  return h <= 24 && min < 60 ? h * 60 + min : null;
}

/**
 * Horarios en los que el asesor puede recibir una visita: dentro del horario
 * de visitas de la inmobiliaria (hora local), sin empalmarse con nada ocupado
 * (con margen de traslado) y con la anticipación mínima.
 */
export function horariosLibres(p: ParametrosDisponibilidad): Intervalo[] {
  const paso = p.pasoMin ?? 30;
  const limite = p.ahora.getTime() + p.anticipacionMin * 60_000;
  const margen = p.margenMin * 60_000;
  const ocupados = p.ocupados.map((o) => ({ inicio: o.inicio.getTime() - margen, fin: o.fin.getTime() + margen }));
  const hoy = partesLocales(p.zonaHoraria, p.ahora);
  const libres: Intervalo[] = [];

  for (let d = 0; d < p.dias; d++) {
    const fecha = sumarDias(hoy, d);
    const rango = p.horario[CLAVE_DIA[fecha.diaSemana]];
    if (!rango) continue;
    const abre = minutosDelDia(rango[0]);
    const cierra = minutosDelDia(rango[1]);
    if (abre === null || cierra === null) continue;

    for (let t = abre; t + p.duracionMin <= cierra; t += paso) {
      const inicio = localAUtc(p.zonaHoraria, { ...fecha, hora: Math.floor(t / 60), minuto: t % 60 });
      const fin = new Date(inicio.getTime() + p.duracionMin * 60_000);
      if (inicio.getTime() < limite) continue;
      // En el salto de horario de verano una hora local puede no existir y repetirse la siguiente.
      if (libres.some((l) => l.inicio.getTime() === inicio.getTime())) continue;
      if (ocupados.some((o) => inicio.getTime() < o.fin && fin.getTime() > o.inicio)) continue;
      libres.push({ inicio, fin });
    }
  }
  return libres;
}

export type Franja = "manana" | "tarde" | "cualquiera";

/**
 * Pocas opciones bien repartidas para ofrecer por WhatsApp: hasta `porDia`
 * por día, separadas al menos `separacionMin`, en la fecha y franja pedidas.
 */
export function elegirOpciones(
  libres: readonly Intervalo[],
  o: { zonaHoraria: string; fecha?: string | null; franja?: Franja | null; max?: number; porDia?: number; separacionMin?: number },
): Intervalo[] {
  const max = o.max ?? 4;
  const porDia = o.porDia ?? 2;
  const separacion = (o.separacionMin ?? 120) * 60_000;
  const elegidas: Intervalo[] = [];
  const porFecha = new Map<string, Intervalo[]>();

  for (const l of libres) {
    const local = partesLocales(o.zonaHoraria, l.inicio);
    const fecha = fechaIso(local);
    if (o.fecha && fecha !== o.fecha) continue;
    if (o.franja === "manana" && local.hora >= 13) continue;
    if (o.franja === "tarde" && local.hora < 13) continue;
    const delDia = porFecha.get(fecha) ?? [];
    if (delDia.length >= porDia) continue;
    if (delDia.some((x) => Math.abs(x.inicio.getTime() - l.inicio.getTime()) < separacion)) continue;
    delDia.push(l);
    porFecha.set(fecha, delDia);
    elegidas.push(l);
    if (elegidas.length >= max) break;
  }
  return elegidas;
}

const fechaLarga = new Map<string, Intl.DateTimeFormat>();

/** "sábado 15 de noviembre, 10:00" en la zona de la inmobiliaria. */
export function describirHorarioCita(inicio: Date, zonaHoraria: string): string {
  let f = fechaLarga.get(zonaHoraria);
  if (!f) {
    f = new Intl.DateTimeFormat("es-MX", { weekday: "long", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit", hourCycle: "h23", timeZone: zonaHoraria });
    fechaLarga.set(zonaHoraria, f);
  }
  const p = Object.fromEntries(f.formatToParts(inicio).map((x) => [x.type, x.value]));
  return `${p.weekday} ${p.day} de ${p.month}, ${p.hour}:${p.minute}`;
}

/** ¿El inicio propuesto coincide con un horario libre? (para validar lo que eligió el prospecto). */
export function esHorarioLibre(libres: readonly Intervalo[], inicio: Date): Intervalo | null {
  return libres.find((l) => l.inicio.getTime() === inicio.getTime()) ?? null;
}
