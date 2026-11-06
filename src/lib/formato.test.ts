import { describe, expect, it } from "vitest";
import { formatearFechaHora, formatearPesos, haceCuanto, interpretarMonto } from "./formato";

describe("formatearPesos", () => {
  it("formatea MXN sin centavos", () => {
    expect(formatearPesos(2500000)).toBe("$2,500,000");
  });
  it("guion si no hay monto", () => {
    expect(formatearPesos(null)).toBe("—");
  });
  it("USD", () => {
    expect(formatearPesos(150000, "USD")).toContain("150,000");
  });
});

describe("interpretarMonto", () => {
  it.each([
    ["2500000", 2500000],
    ["2,500,000", 2500000],
    ["$2,500,000 MXN", 2500000],
    ["2.500.000", 2500000],
    ["2.5M", 2500000],
    ["2,5 millones", 2500000],
    ["3 millones", 3000000],
    ["$1.8 mdp", 1800000],
    ["800 mil", 800000],
    ["800k", 800000],
    ["38000", 38000],
    ["1500.50", 1500.5],
  ])("%s → %d", (texto, esperado) => {
    expect(interpretarMonto(texto)).toBe(esperado);
  });

  it.each([[null], [""], ["mucho dinero"], ["-5"], ["0"]])("%s → null", (texto) => {
    expect(interpretarMonto(texto)).toBeNull();
  });
});

describe("haceCuanto", () => {
  const ahora = new Date("2026-11-07T12:00:00Z");
  it.each([
    ["2026-11-07T11:59:30Z", "hace un momento"],
    ["2026-11-07T11:55:00Z", "hace 5 minutos"],
    ["2026-11-07T09:00:00Z", "hace 3 horas"],
    ["2026-11-06T12:00:00Z", "ayer"],
    ["2026-11-01T12:00:00Z", "hace 6 días"],
  ])("%s → %s", (fecha, esperado) => {
    expect(haceCuanto(fecha, ahora)).toBe(esperado);
  });
});

describe("formatearFechaHora", () => {
  it("usa la zona horaria de la inmobiliaria", () => {
    const texto = formatearFechaHora("2026-11-07T18:30:00Z", "America/Mexico_City");
    expect(texto).toMatch(/7 nov 2026/);
    expect(texto).toMatch(/12:30/);
  });
});
