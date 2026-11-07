import { describe, expect, it } from "vitest";
import { codigoFormularioLanding, esquemaPaginaMeta } from "./integraciones";
import { destinoGracias, esquemaLanding } from "./landing";
import { camposParaCompletar } from "./recaptura";

const clave = "0123456789abcdef0123456789abcdef";

describe("esquemaLanding", () => {
  it("normaliza teléfono y correo y junta los UTM", () => {
    const r = esquemaLanding.parse({
      clave,
      nombre: " Ana ",
      telefono: "442 123 4567",
      email: "Ana@Correo.MX",
      utm_source: "facebook",
      utm_campaign: "preventa-zibata",
      utm_medium: "",
    });
    expect(r).toMatchObject({
      nombre: "Ana",
      telefono: "+524421234567",
      email: "ana@correo.mx",
      utm: { utm_source: "facebook", utm_campaign: "preventa-zibata" },
      esSpam: false,
    });
  });

  it("acepta sólo correo", () => {
    expect(esquemaLanding.parse({ clave, email: "x@y.mx" }).telefono).toBeNull();
  });

  it("exige teléfono o correo", () => {
    expect(esquemaLanding.safeParse({ clave, nombre: "Ana" }).success).toBe(false);
  });

  it("rechaza teléfono inválido si no hay correo", () => {
    expect(esquemaLanding.safeParse({ clave, telefono: "123" }).success).toBe(false);
  });

  it("ignora un correo mal escrito si hay teléfono válido", () => {
    expect(esquemaLanding.parse({ clave, telefono: "5512345678", email: "no-es-correo" }).email).toBeNull();
  });

  it("marca como spam si llenaron el honeypot", () => {
    expect(esquemaLanding.parse({ clave, telefono: "5512345678", sitio_web: "http://spam" }).esSpam).toBe(true);
  });

  it("exige la clave de la inmobiliaria", () => {
    expect(esquemaLanding.safeParse({ telefono: "5512345678" }).success).toBe(false);
  });
});

describe("camposParaCompletar", () => {
  const existente = { nombre: "Ana", telefono: "+524421234567", email: null, propiedad_interes_id: null, zona_interes: "Zibatá" };

  it("sólo completa lo que faltaba", () => {
    expect(
      camposParaCompletar(existente, { nombre: "Ana María", email: "ana@x.mx", propiedad_interes_id: "p1", zona_interes: "Centro" }),
    ).toEqual({ email: "ana@x.mx", propiedad_interes_id: "p1" });
  });

  it("no cambia nada si no hay datos nuevos", () => {
    expect(camposParaCompletar(existente, { nombre: null, email: null })).toEqual({});
  });
});

describe("integraciones", () => {
  it("el código de landing trae endpoint, clave y honeypot", () => {
    const html = codigoFormularioLanding("https://app.mx/api/leads/landing", clave);
    expect(html).toContain('action="https://app.mx/api/leads/landing"');
    expect(html).toContain(`value="${clave}"`);
    expect(html).toContain('name="sitio_web"');
  });

  it("valida página de Meta", () => {
    expect(esquemaPaginaMeta.safeParse({ pageId: "1234567890", token: "x".repeat(30) }).success).toBe(true);
    expect(esquemaPaginaMeta.safeParse({ pageId: "mi-pagina", token: "x".repeat(30) }).success).toBe(false);
    expect(esquemaPaginaMeta.safeParse({ pageId: "1234567890", token: "corto" }).success).toBe(false);
  });
});

describe("destinoGracias", () => {
  it("permite regresar al mismo sitio que envió el formulario", () => {
    expect(destinoGracias("https://casas.mx/gracias", "https://casas.mx", null)).toBe("https://casas.mx/gracias");
    expect(destinoGracias("https://casas.mx/gracias?x=1", null, "https://casas.mx/landing")).toBe("https://casas.mx/gracias?x=1");
  });
  it.each([
    ["https://evil.com/robar", "https://casas.mx", null],
    ["https://casas.mx.evil.com/", "https://casas.mx", null],
    ["https://casas.mx/gracias", null, null],
    ["javascript:alert(1)", "https://casas.mx", null],
    ["/gracias", "https://casas.mx", null],
  ])("rechaza %s desde %s", (gracias, origen, referer) => {
    expect(destinoGracias(gracias, origen, referer)).toBeNull();
  });
});
