import { describe, expect, it } from "vitest";
import { partesLocales } from "@/lib/calendario/zona-horaria";
import { esquemaReporte, formatearDuracion, formatearPorcentaje, proporcion, topeEje, variacion } from "./formato";
import { rangoPeriodo } from "./periodos";

const CDMX = "America/Mexico_City";
// Lunes 9 de noviembre de 2026, 15:00 hora de CDMX.
const ahora = new Date("2026-11-09T21:00:00Z");
const local = (d: Date) => {
  const p = partesLocales(CDMX, d);
  return `${p.anio}-${String(p.mes).padStart(2, "0")}-${String(p.dia).padStart(2, "0")} ${String(p.hora).padStart(2, "0")}:${String(p.minuto).padStart(2, "0")}`;
};

describe("rangoPeriodo", () => {
  it("últimos 7 días: días completos locales, incluido hoy, y la semana anterior", () => {
    const r = rangoPeriodo("7d", ahora, CDMX);
    expect([local(r.desde), local(r.hasta), local(r.anteriorDesde), local(r.anteriorHasta)]).toEqual([
      "2026-11-03 00:00",
      "2026-11-10 00:00",
      "2026-10-27 00:00",
      "2026-11-03 00:00",
    ]);
    expect(r.desde.toISOString()).toBe("2026-11-03T06:00:00.000Z");
  });

  it("este mes se compara contra los mismos días del mes anterior", () => {
    const r = rangoPeriodo("mes", ahora, CDMX);
    expect([local(r.desde), local(r.hasta), local(r.anteriorDesde), local(r.anteriorHasta)]).toEqual([
      "2026-11-01 00:00",
      "2026-11-10 00:00",
      "2026-10-01 00:00",
      "2026-10-10 00:00",
    ]);
    expect(r.etiqueta).toBe("noviembre de 2026 (al día de hoy)");
  });

  it("este mes el día 31 no se pasa del fin del mes anterior más corto", () => {
    const r = rangoPeriodo("mes", new Date("2026-12-31T18:00:00Z"), CDMX);
    expect([local(r.anteriorDesde), local(r.anteriorHasta)]).toEqual(["2026-11-01 00:00", "2026-12-01 00:00"]);
  });

  it("mes anterior completo, cruzando el año", () => {
    const r = rangoPeriodo("mes_anterior", new Date("2027-01-15T18:00:00Z"), CDMX);
    expect([local(r.desde), local(r.hasta), local(r.anteriorDesde), local(r.anteriorHasta)]).toEqual([
      "2026-12-01 00:00",
      "2027-01-01 00:00",
      "2026-11-01 00:00",
      "2026-12-01 00:00",
    ]);
    expect(r.etiqueta).toBe("diciembre de 2026");
  });
});

describe("formatos", () => {
  it.each([
    [null, "—"],
    [0, "0 s"],
    [45, "45 s"],
    [240, "4 min"],
    [3600, "1 h"],
    [4800, "1 h 20 min"],
    [183600, "2 d 3 h"],
  ])("duración %s → %s", (s, esperado) => {
    expect(formatearDuracion(s)).toBe(esperado);
  });

  it("porcentajes", () => {
    expect(proporcion(3, 0)).toBeNull();
    expect(formatearPorcentaje(proporcion(3, 5))).toMatch(/^60\s?%$/);
    expect(formatearPorcentaje(0.034)).toMatch(/^3\.4\s?%$/);
    expect(formatearPorcentaje(null)).toBe("—");
  });

  it("topes de eje redondos", () => {
    expect([topeEje(0), topeEje(7), topeEje(13), topeEje(42), topeEje(240)]).toEqual([1, 10, 20, 50, 250]);
  });
});

describe("variacion", () => {
  it("conteos en %", () => {
    expect(variacion(120, 100)).toEqual({ texto: "+20 %", sentido: "sube", calificacion: "buena" });
    expect(variacion(80, 100)).toEqual({ texto: "−20 %", sentido: "baja", calificacion: "mala" });
  });
  it("tiempo de respuesta: bajar es bueno", () => {
    expect(variacion(30, 60, { mejorSiBaja: true })).toEqual({ texto: "−50 %", sentido: "baja", calificacion: "buena" });
  });
  it("proporciones en puntos", () => {
    expect(variacion(0.25, 0.2, { esProporcion: true })).toEqual({ texto: "+5 pts", sentido: "sube", calificacion: "buena" });
  });
  it("sin base", () => {
    expect(variacion(5, 0)?.texto).toBe("Sin datos del periodo anterior");
    expect(variacion(0, 0)?.sentido).toBe("igual");
    expect(variacion(null, 3)).toBeNull();
  });
});

describe("esquemaReporte", () => {
  it("acepta la forma que devuelve la función SQL", () => {
    const r = esquemaReporte.parse({
      leads: 5,
      respuesta: { medidos: 3, promedio_seg: 240, mediana_seg: 90, p90_seg: 498, menos_1_min: 1, sin_contacto: 1 },
      embudo: { leads: 5, contactados: 4, respondieron: 2, con_cita: 3, visitaron: 1 },
      por_score: { caliente: 1, tibio: 1, frio: 1, sin_score: 2 },
      por_fuente: [{ fuente: "meta_ads", leads: 2, con_cita: 2, calientes: 1, mediana_resp_seg: 60 }],
      por_asesor: [],
      sin_asignar: 1,
      por_dia: [{ dia: "2026-11-02", leads: 2, con_cita: 2 }],
    });
    expect(r.respuesta.promedio_seg).toBe(240);
  });
  it("sin leads, los tiempos vienen en null", () => {
    expect(
      esquemaReporte.safeParse({
        leads: 0,
        respuesta: { medidos: 0, promedio_seg: null, mediana_seg: null, p90_seg: null, menos_1_min: 0, sin_contacto: 0 },
        embudo: { leads: 0, contactados: 0, respondieron: 0, con_cita: 0, visitaron: 0 },
        por_score: { caliente: 0, tibio: 0, frio: 0, sin_score: 0 },
        por_fuente: [],
        por_asesor: [],
        sin_asignar: 0,
        por_dia: [],
      }).success,
    ).toBe(true);
  });
});
