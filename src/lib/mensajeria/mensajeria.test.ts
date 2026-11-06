import { createHmac } from "node:crypto";
import { describe, expect, it, vi } from "vitest";
import { parsearWebhookTwilio, ProveedorTwilio, verificarFirmaTwilio } from "./twilio";
import { parsearWebhookWhatsApp, ProveedorWhatsAppCloud } from "./whatsapp-cloud";

const ok = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: { "content-type": "application/json" } });

describe("ProveedorWhatsAppCloud", () => {
  const nuevo = (fetchFn: typeof fetch) => new ProveedorWhatsAppCloud({ phoneNumberId: "1099", token: "tok", version: "v23.0", fetchFn });

  it("envía texto al número sin + y devuelve el wamid", async () => {
    const fetchFn = vi.fn().mockResolvedValue(ok({ messages: [{ id: "wamid.1" }] }));
    expect(await nuevo(fetchFn).enviarTexto("+524421234567", "Hola")).toEqual({ idProveedor: "wamid.1" });
    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://graph.facebook.com/v23.0/1099/messages");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
    expect(JSON.parse(init.body as string)).toEqual({
      messaging_product: "whatsapp",
      recipient_type: "individual",
      to: "524421234567",
      type: "text",
      text: { body: "Hola", preview_url: false },
    });
  });

  it("arma plantillas con parámetros del cuerpo", async () => {
    const fetchFn = vi.fn().mockResolvedValue(ok({ messages: [{ id: "wamid.2" }] }));
    await nuevo(fetchFn).enviarPlantilla("+524421234567", { nombre: "bienvenida", idioma: "es_MX", parametros: ["Ana", "Casas del Bajío"] });
    const body = JSON.parse((fetchFn.mock.calls[0] as [string, RequestInit])[1].body as string);
    expect(body.template).toEqual({
      name: "bienvenida",
      language: { code: "es_MX" },
      components: [{ type: "body", parameters: [{ type: "text", text: "Ana" }, { type: "text", text: "Casas del Bajío" }] }],
    });
  });

  it("lanza ErrorMensajeria con el mensaje de Meta", async () => {
    const fetchFn = vi.fn().mockResolvedValue(ok({ error: { message: "Re-engagement message", code: 131047 } }, 400));
    await expect(nuevo(fetchFn).enviarTexto("+524421234567", "x")).rejects.toThrow("WhatsApp: Re-engagement message");
  });
});

describe("parsearWebhookWhatsApp", () => {
  const webhook = {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "WABA",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: { display_phone_number: "524420000000", phone_number_id: "1099" },
              contacts: [{ wa_id: "5214421234567", profile: { name: "Ana" } }],
              messages: [
                { from: "5214421234567", id: "wamid.a", timestamp: "1762600000", type: "text", text: { body: "Hola, ¿sigue disponible?" } },
                { from: "5214421234567", id: "wamid.b", timestamp: "1762600005", type: "interactive", interactive: { type: "button_reply", button_reply: { id: "si", title: "Sí, me interesa" } } },
                { from: "5214421234567", id: "wamid.c", timestamp: "1762600006", type: "audio", audio: { id: "x" } },
              ],
              statuses: [{ id: "wamid.out", status: "failed", errors: [{ title: "Message undeliverable" }] }, { id: "wamid.out2", status: "read" }],
            },
          },
        ],
      },
    ],
  };

  it("normaliza teléfono (+521 → +52), nombre, tipos y estados", () => {
    const [e] = parsearWebhookWhatsApp(webhook);
    expect(e.numeroNegocio).toBe("1099");
    expect(e.mensajes.map((m) => [m.idProveedor, m.telefono, m.nombrePerfil, m.tipo, m.texto])).toEqual([
      ["wamid.a", "+524421234567", "Ana", "texto", "Hola, ¿sigue disponible?"],
      ["wamid.b", "+524421234567", "Ana", "interactivo", "Sí, me interesa"],
      ["wamid.c", "+524421234567", "Ana", "audio", "[Envió una nota de voz]"],
    ]);
    expect(e.mensajes[0].recibidoEn.toISOString()).toBe("2025-11-08T11:06:40.000Z");
    expect(e.estados).toEqual([
      { idProveedor: "wamid.out", estado: "fallido", error: "Message undeliverable" },
      { idProveedor: "wamid.out2", estado: "leido", error: null },
    ]);
  });

  it("ignora payloads ajenos", () => {
    expect(parsearWebhookWhatsApp({ object: "page", entry: [] })).toEqual([]);
    expect(parsearWebhookWhatsApp(null)).toEqual([]);
  });
});

describe("Twilio", () => {
  it("envía con From/To whatsapp: y Basic auth", async () => {
    const fetchFn = vi.fn().mockResolvedValue(ok({ sid: "SM1" }, 201));
    const t = new ProveedorTwilio({ accountSid: "AC1", authToken: "tk", numero: "+14155238886", fetchFn });
    expect(await t.enviarPlantilla("+524421234567", { nombre: "HX123", idioma: "es", parametros: ["Ana"] })).toEqual({ idProveedor: "SM1" });
    const [url, init] = fetchFn.mock.calls[0] as [string, RequestInit];
    expect(url).toBe("https://api.twilio.com/2010-04-01/Accounts/AC1/Messages.json");
    const body = init.body as URLSearchParams;
    expect(body.get("From")).toBe("whatsapp:+14155238886");
    expect(body.get("To")).toBe("whatsapp:+524421234567");
    expect(body.get("ContentSid")).toBe("HX123");
    expect(body.get("ContentVariables")).toBe('{"1":"Ana"}');
  });

  it("verifica la firma del webhook", () => {
    const params = { Body: "Hola", From: "whatsapp:+5214421234567" };
    const url = "https://app.mx/api/webhooks/twilio";
    const firma = createHmac("sha1", "tk").update(url + "BodyHola" + "Fromwhatsapp:+5214421234567").digest("base64");
    expect(verificarFirmaTwilio(url, params, firma, "tk")).toBe(true);
    expect(verificarFirmaTwilio(url, { ...params, Body: "Otro" }, firma, "tk")).toBe(false);
    expect(verificarFirmaTwilio(url, params, null, "tk")).toBe(false);
  });

  it("parsea mensajes y estados", () => {
    expect(
      parsearWebhookTwilio({ MessageSid: "SM9", From: "whatsapp:+5214421234567", To: "whatsapp:+14155238886", Body: "Hola", ProfileName: "Ana", SmsStatus: "received" })?.mensajes[0],
    ).toMatchObject({ idProveedor: "SM9", telefono: "+524421234567", nombrePerfil: "Ana", texto: "Hola" });
    expect(parsearWebhookTwilio({ MessageSid: "SM1", To: "whatsapp:+14155238886", MessageStatus: "undelivered", ErrorCode: "63016" })?.estados).toEqual([
      { idProveedor: "SM1", estado: "fallido", error: "63016" },
    ]);
  });
});
