import { describe, expect, it } from "vitest";
import {
  erroresPorCampo,
  esquemaCrearInmobiliaria,
  esquemaInvitacion,
  esquemaMiembro,
  esquemaNuevaContrasena,
  esquemaRegistro,
} from "./esquemas";

describe("esquemaRegistro", () => {
  it("normaliza el correo", () => {
    const r = esquemaRegistro.parse({
      nombre: "Ana López",
      email: "  ANA@Inmo.MX ",
      password: "segura123",
      nombreInmobiliaria: "Casas Ana",
    });
    expect(r.email).toBe("ana@inmo.mx");
  });

  it("explica en español qué está mal", () => {
    const r = esquemaRegistro.safeParse({ nombre: "A", email: "x", password: "123", nombreInmobiliaria: "" });
    expect(r.success).toBe(false);
    if (!r.success) {
      expect(erroresPorCampo(r.error)).toEqual({
        nombre: "El nombre es muy corto",
        email: "Correo no válido",
        password: "La contraseña debe tener al menos 8 caracteres",
        nombreInmobiliaria: "El nombre es muy corto",
      });
    }
  });
});

describe("esquemaCrearInmobiliaria", () => {
  it("genera el slug a partir del nombre si no viene", () => {
    const r = esquemaCrearInmobiliaria.parse({ nombreInmobiliaria: "Casas del Bajío", nombreDueno: "Ana" });
    expect(r.slug).toBe("casas-del-bajio");
  });

  it("respeta un slug válido", () => {
    const r = esquemaCrearInmobiliaria.parse({ nombreInmobiliaria: "X Y Z", nombreDueno: "Ana", slug: "Mi-Inmo" });
    expect(r.slug).toBe("mi-inmo");
  });

  it("rechaza slugs inválidos", () => {
    const r = esquemaCrearInmobiliaria.safeParse({ nombreInmobiliaria: "Casas", nombreDueno: "Ana", slug: "con espacios" });
    expect(r.success).toBe(false);
  });
});

describe("esquemaNuevaContrasena", () => {
  it("exige que coincidan", () => {
    const r = esquemaNuevaContrasena.safeParse({ password: "segura123", confirmacion: "segura124" });
    expect(r.success).toBe(false);
    if (!r.success) expect(erroresPorCampo(r.error).confirmacion).toBe("Las contraseñas no coinciden");
  });
});

describe("esquemaInvitacion", () => {
  it("normaliza el teléfono a E.164", () => {
    const r = esquemaInvitacion.parse({ nombre: "Luis", email: "luis@x.mx", rol: "asesor", telefono: "55 1234 5678" });
    expect(r.telefono).toBe("+525512345678");
  });

  it("acepta teléfono vacío", () => {
    const r = esquemaInvitacion.parse({ nombre: "Luis", email: "luis@x.mx", rol: "asesor", telefono: "" });
    expect(r.telefono).toBeNull();
  });

  it("rechaza teléfono inválido y rol desconocido", () => {
    const r = esquemaInvitacion.safeParse({ nombre: "Luis", email: "luis@x.mx", rol: "admin", telefono: "123" });
    expect(r.success).toBe(false);
    if (!r.success) {
      const e = erroresPorCampo(r.error);
      expect(e.rol).toBe("Rol no válido");
      expect(e.telefono).toBe("Teléfono no válido");
    }
  });
});

describe("esquemaMiembro", () => {
  it("convierte checkboxes de formulario a boolean", () => {
    const r = esquemaMiembro.parse({ id: "6f1c3e1e-2b7a-4c55-9d8e-1a2b3c4d5e6f", rol: "asesor", activo: "on" });
    expect(r.activo).toBe(true);
    expect(r.recibeLeads).toBe(false);
  });
});
