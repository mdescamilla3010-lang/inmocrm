import { createHmac } from "node:crypto";
import { describe, expect, it } from "vitest";
import { mapearCamposMeta, parsearWebhookMeta, resumirRespuestas, verificarFirmaMeta } from "./meta";

const secreto = "app-secret-de-prueba";
const firmar = (cuerpo: string, s = secreto) => `sha256=${createHmac("sha256", s).update(cuerpo).digest("hex")}`;

describe("verificarFirmaMeta", () => {
  const cuerpo = JSON.stringify({ object: "page", entry: [] });

  it("acepta la firma correcta", () => {
    expect(verificarFirmaMeta(cuerpo, firmar(cuerpo), secreto)).toBe(true);
  });

  it.each([
    ["sin firma", null],
    ["sin prefijo", createHmac("sha256", secreto).update(cuerpo).digest("hex")],
    ["con otro secreto", firmar(cuerpo, "otro")],
    ["hex inválido", "sha256=zzzz"],
    ["truncada", firmar(cuerpo).slice(0, 20)],
  ])("rechaza %s", (_, firma) => {
    expect(verificarFirmaMeta(cuerpo, firma, secreto)).toBe(false);
  });

  it("rechaza si el cuerpo cambió", () => {
    expect(verificarFirmaMeta(cuerpo + " ", firmar(cuerpo), secreto)).toBe(false);
  });
});

describe("parsearWebhookMeta", () => {
  it("extrae los leadgen de todas las entradas", () => {
    const cuerpo = {
      object: "page",
      entry: [
        {
          id: "111",
          time: 1730000000,
          changes: [
            { field: "leadgen", value: { leadgen_id: 444, page_id: 111, form_id: 555, ad_id: 666, created_time: 1730000000 } },
            { field: "feed", value: { leadgen_id: "x", page_id: "111" } },
          ],
        },
        { id: "222", changes: [{ field: "leadgen", value: { leadgen_id: "777", page_id: "222" } }] },
      ],
    };
    expect(parsearWebhookMeta(cuerpo)).toEqual([
      { pageId: "111", leadgenId: "444", formId: "555", adId: "666" },
      { pageId: "222", leadgenId: "777", formId: undefined, adId: undefined },
    ]);
  });

  it.each([[null], [{}], [{ object: "user", entry: [] }], [{ object: "page", entry: "x" }]])(
    "ignora payloads que no son de páginas: %j",
    (cuerpo) => {
      expect(parsearWebhookMeta(cuerpo)).toEqual([]);
    },
  );
});

describe("mapearCamposMeta", () => {
  it("formulario estándar con preguntas personalizadas", () => {
    const r = mapearCamposMeta([
      { name: "full_name", values: ["  María Pérez "] },
      { name: "phone_number", values: ["+5215512345678"] },
      { name: "email", values: ["Maria@Correo.MX"] },
      { name: "¿cuál_es_tu_presupuesto?", values: ["Entre 2 y 3 millones"] },
      { name: "zona_de_interés", values: ["Juriquilla"] },
    ]);
    expect(r).toEqual({
      nombre: "María Pérez",
      telefono: "+525512345678",
      email: "maria@correo.mx",
      respuestas: { "¿cuál_es_tu_presupuesto?": "Entre 2 y 3 millones", "zona_de_interés": "Juriquilla" },
    });
  });

  it("une nombre y apellido si no viene full_name", () => {
    const r = mapearCamposMeta([
      { name: "first_name", values: ["Juan"] },
      { name: "last_name", values: ["López"] },
    ]);
    expect(r.nombre).toBe("Juan López");
    expect(r.telefono).toBeNull();
    expect(r.email).toBeNull();
  });

  it("teléfono inválido queda en null", () => {
    expect(mapearCamposMeta([{ name: "phone_number", values: ["123"] }]).telefono).toBeNull();
  });
});

describe("resumirRespuestas", () => {
  it("una línea por pregunta", () => {
    expect(resumirRespuestas({ zona_de_interes: "Zibatá", presupuesto: "3M" })).toBe(
      "zona de interes: Zibatá\npresupuesto: 3M",
    );
  });
  it("null si no hay respuestas", () => {
    expect(resumirRespuestas({})).toBeNull();
  });
});
