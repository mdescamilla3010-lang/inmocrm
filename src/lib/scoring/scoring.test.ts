import { describe, expect, it } from "vitest";
import { calcularScore, type DatosScoring } from "./scoring";

const base: DatosScoring = {
  operacion: "venta",
  tipoPropiedad: null,
  zonaConocida: false,
  presupuestoMin: null,
  presupuestoMax: null,
  formaPago: null,
  creditoPreaprobado: null,
  urgencia: null,
  coincidencias: 0,
  quiereVisitar: false,
  respondio: true,
};

describe("calcularScore", () => {
  it("prospecto ideal: contado, urgente, con presupuesto, zona, tipo y quiere visitar → caliente", () => {
    const r = calcularScore({
      ...base,
      tipoPropiedad: "casa",
      zonaConocida: true,
      presupuestoMax: 3_000_000,
      formaPago: "contado",
      urgencia: "menos_1_mes",
      coincidencias: 2,
      quiereVisitar: true,
    });
    expect(r.puntos).toBe(95);
    expect(r.score).toBe("caliente");
    expect(r.faltantes).toEqual([]);
    expect(r.motivo).toBe(
      "Quiere visitar, quiere mudarse en menos de 1 mes, paga de contado, 2 propiedades coinciden con su presupuesto.",
    );
  });

  it("Infonavit en 1 a 3 meses: la precalificación es lo que lo vuelve caliente", () => {
    const datos: DatosScoring = {
      ...base,
      tipoPropiedad: "casa",
      zonaConocida: true,
      presupuestoMax: 1_800_000,
      formaPago: "infonavit",
      urgencia: "uno_a_tres_meses",
      coincidencias: 1,
    };
    const sinPrecalificar = calcularScore(datos);
    expect(sinPrecalificar.puntos).toBe(22 + 16 + 10 + 5 + 5 + 5);
    expect(sinPrecalificar.score).toBe("tibio");

    const precalificado = calcularScore({ ...datos, creditoPreaprobado: true });
    expect(precalificado.puntos).toBe(22 + 20 + 10 + 5 + 5 + 5);
    expect(precalificado.score).toBe("caliente");
    expect(precalificado.motivo).toContain("tiene crédito Infonavit precalificado");
  });

  it("crédito bancario sin aprobar, 3 a 6 meses → tibio", () => {
    const r = calcularScore({
      ...base,
      tipoPropiedad: "departamento",
      presupuestoMax: 2_500_000,
      formaPago: "credito_bancario",
      creditoPreaprobado: false,
      urgencia: "tres_a_seis_meses",
    });
    expect(r.puntos).toBe(10 + 14 + 10 + 5);
    expect(r.score).toBe("tibio");
    expect(r.motivo).toContain("ninguna propiedad del catálogo coincide");
    expect(r.faltantes).toEqual(["zona"]);
  });

  it("sólo saludó: frío y lista lo que falta", () => {
    const r = calcularScore(base);
    expect(r.score).toBe("frio");
    expect(r.puntos).toBe(0);
    expect(r.faltantes).toEqual(["urgencia", "forma de pago", "presupuesto", "zona", "tipo de propiedad"]);
    expect(r.motivo).toBe("Aún no tenemos datos para calificarlo. Falta: urgencia, forma de pago, presupuesto, zona, tipo de propiedad.");
  });

  it("sin prisa (más de 6 meses) nunca es caliente aunque sume mucho", () => {
    const r = calcularScore({
      ...base,
      tipoPropiedad: "casa",
      zonaConocida: true,
      presupuestoMax: 5_000_000,
      formaPago: "contado",
      urgencia: "mas_de_seis_meses",
      coincidencias: 3,
      quiereVisitar: true,
    });
    expect(r.puntos).toBeGreaterThanOrEqual(65);
    expect(r.score).toBe("tibio");
  });

  it("si nunca respondió es frío aunque el formulario traiga datos", () => {
    const r = calcularScore({ ...base, formaPago: "contado", urgencia: "menos_1_mes", presupuestoMax: 3e6, respondio: false });
    expect(r.score).toBe("frio");
    expect(r.motivo.startsWith("No ha respondido")).toBe(true);
  });

  it("renta: pesa el presupuesto, no la forma de pago", () => {
    const r = calcularScore({
      ...base,
      operacion: "renta",
      tipoPropiedad: "departamento",
      zonaConocida: true,
      presupuestoMax: 25_000,
      urgencia: "menos_1_mes",
      coincidencias: 1,
    });
    expect(r.puntos).toBe(30 + 20 + 5 + 5 + 5);
    expect(r.score).toBe("caliente");
    expect(r.faltantes).not.toContain("forma de pago");
    expect(r.motivo).toContain("tiene presupuesto de renta definido");
  });

  it("límites exactos de los umbrales", () => {
    // 35 = tibio
    const tibio = calcularScore({ ...base, urgencia: "menos_1_mes", zonaConocida: true });
    expect(tibio.puntos).toBe(35);
    expect(tibio.score).toBe("tibio");
    // 30 = frío
    const frio2 = calcularScore({ ...base, urgencia: "uno_a_tres_meses", formaPago: "otro" });
    expect(frio2.puntos).toBe(30);
    expect(frio2.score).toBe("frio");
    // 65 = caliente
    const caliente = calcularScore({ ...base, urgencia: "menos_1_mes", formaPago: "contado", presupuestoMax: 1e6, quiereVisitar: false, zonaConocida: false, tipoPropiedad: null });
    expect(caliente.puntos).toBe(65);
    expect(caliente.score).toBe("caliente");
  });

  it("es determinista", () => {
    const d: DatosScoring = { ...base, formaPago: "fovissste", creditoPreaprobado: true, urgencia: "uno_a_tres_meses" };
    expect(calcularScore(d)).toEqual(calcularScore(d));
  });
});
