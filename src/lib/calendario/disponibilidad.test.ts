import { describe, expect, it } from "vitest";
import { describirHorarioCita, elegirOpciones, esHorarioLibre, horariosLibres, type HorarioVisitas } from "./disponibilidad";
import { desfaseMinutos, localAUtc, partesLocales, sumarDias } from "./zona-horaria";

const CDMX = "America/Mexico_City";
const TIJUANA = "America/Tijuana";

describe("zona horaria", () => {
  it("Ciudad de México es UTC-6 todo el año (sin horario de verano desde 2022)", () => {
    expect(desfaseMinutos(CDMX, new Date("2026-01-15T12:00:00Z"))).toBe(-360);
    expect(desfaseMinutos(CDMX, new Date("2026-07-15T12:00:00Z"))).toBe(-360);
  });

  it("Tijuana cambia de -8 a -7 con el horario de verano", () => {
    expect(desfaseMinutos(TIJUANA, new Date("2026-01-15T12:00:00Z"))).toBe(-480);
    expect(desfaseMinutos(TIJUANA, new Date("2026-07-15T12:00:00Z"))).toBe(-420);
  });

  it("localAUtc es la inversa de partesLocales", () => {
    const utc = localAUtc(CDMX, { anio: 2026, mes: 11, dia: 14, hora: 10, minuto: 30 });
    expect(utc.toISOString()).toBe("2026-11-14T16:30:00.000Z");
    expect(partesLocales(CDMX, utc)).toMatchObject({ anio: 2026, mes: 11, dia: 14, hora: 10, minuto: 30, diaSemana: 6 });
  });

  it("localAUtc respeta el horario de verano de Tijuana", () => {
    expect(localAUtc(TIJUANA, { anio: 2026, mes: 7, dia: 1, hora: 10, minuto: 0 }).toISOString()).toBe("2026-07-01T17:00:00.000Z");
    expect(localAUtc(TIJUANA, { anio: 2026, mes: 12, dia: 1, hora: 10, minuto: 0 }).toISOString()).toBe("2026-12-01T18:00:00.000Z");
  });

  it("sumarDias cruza fin de mes y de año", () => {
    expect(sumarDias({ anio: 2026, mes: 12, dia: 30 }, 3)).toEqual({ anio: 2027, mes: 1, dia: 2, diaSemana: 6 });
  });
});

const horario: HorarioVisitas = {
  lun: ["09:00", "19:00"], mar: ["09:00", "19:00"], mie: ["09:00", "19:00"], jue: ["09:00", "19:00"], vie: ["09:00", "19:00"],
  sab: ["10:00", "14:00"], dom: null,
};
// Viernes 13 de noviembre de 2026, 17:00 en CDMX.
const ahora = new Date("2026-11-13T23:00:00Z");
const base = { horario, zonaHoraria: CDMX, duracionMin: 60, margenMin: 30, anticipacionMin: 120, ocupados: [], ahora, dias: 3 };
const horaLocal = (d: Date) => {
  const p = partesLocales(CDMX, d);
  return `${p.dia} ${String(p.hora).padStart(2, "0")}:${String(p.minuto).padStart(2, "0")}`;
};

describe("horariosLibres", () => {
  it("respeta anticipación, horario por día, domingos cerrados y que la visita termine antes de cerrar", () => {
    const libres = horariosLibres(base).map((l) => horaLocal(l.inicio));
    // Viernes: 17:00 + 2 h de anticipación = 19:00, ya cerró. Sábado 10:00–14:00 → hasta 13:00. Domingo cerrado.
    expect(libres).toEqual(["14 10:00", "14 10:30", "14 11:00", "14 11:30", "14 12:00", "14 12:30", "14 13:00"]);
  });

  it("descarta lo ocupado en Google o en otras citas, con margen de traslado", () => {
    const ocupados = [{ inicio: new Date("2026-11-14T17:00:00Z"), fin: new Date("2026-11-14T18:00:00Z") }]; // sábado 11:00–12:00
    const libres = horariosLibres({ ...base, ocupados }).map((l) => horaLocal(l.inicio));
    // 10:00 termina 11:00 pero choca con el margen (10:30); 12:30 empieza justo al terminar el margen.
    expect(libres).toEqual(["14 12:30", "14 13:00"]);
  });

  it("sin margen sí cabe pegado al compromiso", () => {
    const ocupados = [{ inicio: new Date("2026-11-14T17:00:00Z"), fin: new Date("2026-11-14T18:00:00Z") }];
    const libres = horariosLibres({ ...base, margenMin: 0, ocupados }).map((l) => horaLocal(l.inicio));
    expect(libres).toEqual(["14 10:00", "14 12:00", "14 12:30", "14 13:00"]);
  });

  it("varios días y duración de 90 minutos", () => {
    const libres = horariosLibres({ ...base, duracionMin: 90, dias: 4, pasoMin: 60 }).map((l) => horaLocal(l.inicio));
    expect(libres.filter((l) => l.startsWith("14"))).toEqual(["14 10:00", "14 11:00", "14 12:00"]);
    // Lunes 9:00–19:00 con visitas de 90 min cada hora: de 9:00 a 17:00 (la de 18:00 terminaría 19:30).
    expect(libres.filter((l) => l.startsWith("16"))).toEqual([9, 10, 11, 12, 13, 14, 15, 16, 17].map((h) => `16 ${String(h).padStart(2, "0")}:00`));
    expect(libres.some((l) => l.startsWith("15"))).toBe(false);
  });

  it("todo ocupado → sin horarios", () => {
    const ocupados = [{ inicio: new Date("2026-11-01T00:00:00Z"), fin: new Date("2026-12-01T00:00:00Z") }];
    expect(horariosLibres({ ...base, ocupados, dias: 7 })).toEqual([]);
  });
});

describe("elegirOpciones", () => {
  const libres = horariosLibres({ ...base, dias: 5, pasoMin: 30 });

  it("reparte: máximo 2 por día, separadas al menos 2 horas", () => {
    const opciones = elegirOpciones(libres, { zonaHoraria: CDMX, max: 4 }).map((l) => horaLocal(l.inicio));
    expect(opciones).toEqual(["14 10:00", "14 12:00", "16 09:00", "16 11:00"]);
  });

  it("filtra por fecha y franja", () => {
    expect(elegirOpciones(libres, { zonaHoraria: CDMX, fecha: "2026-11-16", franja: "tarde" }).map((l) => horaLocal(l.inicio))).toEqual([
      "16 13:00",
      "16 15:00",
    ]);
    expect(elegirOpciones(libres, { zonaHoraria: CDMX, fecha: "2026-11-15" })).toEqual([]);
  });
});

describe("textos y validación", () => {
  it("describe la cita en español y hora local", () => {
    expect(describirHorarioCita(new Date("2026-11-14T16:00:00Z"), CDMX)).toBe("sábado 14 de noviembre, 10:00");
  });

  it("esHorarioLibre sólo acepta inicios exactos de la lista", () => {
    const libres = horariosLibres(base);
    expect(esHorarioLibre(libres, new Date("2026-11-14T16:00:00Z"))).not.toBeNull();
    expect(esHorarioLibre(libres, new Date("2026-11-14T16:10:00Z"))).toBeNull();
  });
});
