import { randomBytes } from "node:crypto";
import { describe, expect, it } from "vitest";
import { cifrar, descifrar } from "./cripto";

const llave = randomBytes(32).toString("base64");

describe("cifrar / descifrar", () => {
  it("ida y vuelta, con acentos y emojis", () => {
    const secreto = "EAAG…token-de-página ñandú 🏠";
    expect(descifrar(cifrar(secreto, llave), llave)).toBe(secreto);
  });

  it("cada cifrado es distinto (IV aleatorio)", () => {
    expect(cifrar("abc", llave)).not.toBe(cifrar("abc", llave));
  });

  it("no expone el texto en claro", () => {
    expect(cifrar("token-super-secreto", llave)).not.toContain("token");
  });

  it("falla con otra llave", () => {
    const otra = randomBytes(32).toString("base64");
    expect(() => descifrar(cifrar("abc", llave), otra)).toThrow();
  });

  it("detecta manipulación", () => {
    const partes = cifrar("abc", llave).split(".");
    partes[3] = Buffer.from("xyz").toString("base64url");
    expect(() => descifrar(partes.join("."), llave)).toThrow();
  });

  it("rechaza llaves de tamaño incorrecto", () => {
    expect(() => cifrar("abc", Buffer.from("corta").toString("base64"))).toThrow(/32 bytes/);
  });

  it("rechaza formatos desconocidos", () => {
    expect(() => descifrar("v0.a.b.c", llave)).toThrow(/Formato/);
  });
});
