import { describe, expect, it } from "vitest";
import { dentroDeVentana } from "./tipos";
import { dividirMensaje, esSolicitudDeBaja } from "./texto";

describe("esSolicitudDeBaja", () => {
  it.each(["BAJA", "Stop", "alto", " baja ", "Por favor no me escriban más", "Ya dejen de escribirme!!", "Quiero darme de baja", "no me contacten gracias"])(
    "%s es baja",
    (t) => expect(esSolicitudDeBaja(t)).toBe(true),
  );

  it.each(["No me interesa por ahora", "¿Cuánto cuesta la casa en alto lindo?", "bajaron el precio?", "Hola", "", null])(
    "%s no es baja",
    (t) => expect(esSolicitudDeBaja(t)).toBe(false),
  );
});

describe("dividirMensaje", () => {
  it("no divide textos cortos", () => {
    expect(dividirMensaje("Hola, ¿cómo estás?")).toEqual(["Hola, ¿cómo estás?"]);
  });
  it("corta en párrafos cuando puede", () => {
    const a = "a".repeat(60);
    const b = "b".repeat(30);
    expect(dividirMensaje(`${a}\n\n${b}`, 80)).toEqual([a, b]);
  });
  it("corta en espacios si no hay renglones y nunca excede el máximo", () => {
    const texto = Array.from({ length: 50 }, (_, i) => `palabra${i}`).join(" ");
    const partes = dividirMensaje(texto, 40);
    expect(partes.every((p) => p.length <= 40)).toBe(true);
    expect(partes.join(" ")).toBe(texto);
  });
  it("vacío → sin partes", () => {
    expect(dividirMensaje("   ")).toEqual([]);
  });
});

describe("dentroDeVentana", () => {
  const ahora = new Date("2026-11-08T12:00:00Z");
  it("23 h después: sí; 25 h después: no; sin mensajes: no", () => {
    expect(dentroDeVentana("2026-11-07T13:00:00Z", ahora)).toBe(true);
    expect(dentroDeVentana("2026-11-07T11:00:00Z", ahora)).toBe(false);
    expect(dentroDeVentana(null, ahora)).toBe(false);
  });
});
