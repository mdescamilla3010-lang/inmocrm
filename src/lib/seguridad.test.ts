import { describe, expect, it } from "vitest";
import { contrasenaBasic, secretosIguales } from "./seguridad";

describe("secretosIguales", () => {
  it("compara contenido", () => {
    expect(secretosIguales("abc", "abc")).toBe(true);
    expect(secretosIguales("abc", "abd")).toBe(false);
    expect(secretosIguales("abc", "abcd")).toBe(false);
  });
});

describe("contrasenaBasic", () => {
  const basic = (s: string) => `Basic ${Buffer.from(s).toString("base64")}`;
  it("extrae la contraseña", () => {
    expect(contrasenaBasic(basic("postmark:s3cr3t:con:dos-puntos"))).toBe("s3cr3t:con:dos-puntos");
  });
  it.each([[null], ["Bearer x"], [basic("sin-dos-puntos")]])("%s → null", (h) => {
    expect(contrasenaBasic(h)).toBeNull();
  });
});
