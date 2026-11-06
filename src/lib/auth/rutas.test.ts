import { describe, expect, it } from "vitest";
import { esRutaPublica, rutaSegura } from "./rutas";

describe("esRutaPublica", () => {
  it.each(["/login", "/registro", "/recuperar", "/auth/confirmar"])("%s es pública", (r) => {
    expect(esRutaPublica(r)).toBe(true);
  });

  it.each(["/", "/leads", "/configuracion/equipo", "/bienvenida", "/login-falso", "/authx"])(
    "%s requiere sesión",
    (r) => {
      expect(esRutaPublica(r)).toBe(false);
    },
  );
});

describe("rutaSegura", () => {
  it("acepta rutas internas con query", () => {
    expect(rutaSegura("/leads?estado=nuevo")).toBe("/leads?estado=nuevo");
  });

  it.each([
    ["https://evil.com", "URL absoluta"],
    ["//evil.com", "protocolo relativo"],
    ["/\\evil.com", "barra invertida"],
    ["leads", "sin barra inicial"],
    ["", "vacío"],
    ["/leads\n", "caracteres de control"],
  ])("rechaza %s (%s)", (destino) => {
    expect(rutaSegura(destino)).toBe("/leads");
  });

  it("rechaza tipos que no son string y usa el default indicado", () => {
    expect(rutaSegura(null, "/bienvenida")).toBe("/bienvenida");
    expect(rutaSegura(["/x"])).toBe("/leads");
  });
});
