import { describe, expect, it } from "vitest";
import { formatearTelefono, normalizarTelefono } from "./telefono";

describe("normalizarTelefono", () => {
  it.each([
    ["5512345678", "+525512345678", "10 dígitos nacionales"],
    ["55 1234 5678", "+525512345678", "con espacios"],
    ["(55) 1234-5678", "+525512345678", "con paréntesis y guion"],
    ["+52 55 1234 5678", "+525512345678", "E.164 con espacios"],
    ["+5215512345678", "+525512345678", "+521 de WhatsApp"],
    ["5215512345678", "+525512345678", "521 sin +"],
    ["525512345678", "+525512345678", "52 sin +"],
    ["0445512345678", "+525512345678", "prefijo 044"],
    ["0453312345678", "+523312345678", "prefijo 045"],
    ["013312345678", "+523312345678", "prefijo 01"],
    ["00525512345678", "+525512345678", "prefijo internacional 00"],
    ["+1 (415) 555-2671", "+14155552671", "Estados Unidos"],
    ["+34 612 34 56 78", "+34612345678", "España"],
  ])("%s → %s (%s)", (entrada, esperado) => {
    expect(normalizarTelefono(entrada)).toBe(esperado);
  });

  it.each([
    [null],
    [undefined],
    [""],
    ["   "],
    ["12345"],
    ["0512345678"], // número nacional no puede empezar con 0
    ["+52 55 1234"], // incompleto
    ["123456789012345678"], // demasiado largo
    ["+0123456789"],
    ["abc"],
  ])("%s → null", (entrada) => {
    expect(normalizarTelefono(entrada)).toBeNull();
  });

  it("es idempotente", () => {
    const una = normalizarTelefono("+5215512345678");
    expect(normalizarTelefono(una)).toBe(una);
  });
});

describe("formatearTelefono", () => {
  it("formatea números mexicanos", () => {
    expect(formatearTelefono("+525512345678")).toBe("55 1234 5678");
  });
  it("deja intactos otros países", () => {
    expect(formatearTelefono("+14155552671")).toBe("+14155552671");
  });
});
