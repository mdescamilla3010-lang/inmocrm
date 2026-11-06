import { describe, expect, it } from "vitest";
import { esSlugValido, generarSlug } from "./slug";

describe("generarSlug", () => {
  it.each([
    ["Casas del Bajío, S.A.", "casas-del-bajio-s-a"],
    ["  Inmobiliaria Peña  ", "inmobiliaria-pena"],
    ["MÉRIDA Propiedades 2026", "merida-propiedades-2026"],
    ["---Hola---", "hola"],
  ])("%s → %s", (entrada, esperado) => {
    expect(generarSlug(entrada)).toBe(esperado);
  });

  it("corta a 40 caracteres sin dejar guion al final", () => {
    const slug = generarSlug("Inmobiliaria con un nombre larguísimo de verdad muy largo");
    expect(slug.length).toBeLessThanOrEqual(40);
    expect(slug.endsWith("-")).toBe(false);
    expect(esSlugValido(slug)).toBe(true);
  });
});

describe("esSlugValido", () => {
  it.each(["casas-a", "abc", "inmo123"])("%s es válido", (s) => expect(esSlugValido(s)).toBe(true));
  it.each(["ab", "-casas", "Casas", "casas_a", "a".repeat(41)])("%s no es válido", (s) =>
    expect(esSlugValido(s)).toBe(false),
  );
});
