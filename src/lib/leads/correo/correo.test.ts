/**
 * OJO: los correos de estas pruebas son SINTÉTICOS, escritos imitando el
 * formato típico de notificaciones de portales. Hay que agregar correos
 * reales (anonimizados) en cuanto los tengamos y ajustar el parser.
 */
import { describe, expect, it } from "vitest";
import { slugDeDestinatarios } from "./destinatario";
import { correoDesdePostmark } from "./entrante";
import { htmlATexto } from "./html";
import { detectarPortal, parsearCorreoPortal } from "./portales";

const inmuebles24Html = `
<html><head><style>.x{color:red}</style></head><body>
<h2>¡Tienes un nuevo contacto!</h2>
<p>Un interesado escribi&oacute; por tu aviso <a href="https://www.inmuebles24.com/propiedades/casa-en-juriquilla-143829475.html">Casa en Juriquilla</a></p>
<table>
  <tr><td>Nombre:</td><td>Mar&iacute;a Fernanda Ruiz</td></tr>
  <tr><td>Email:</td><td>mafer.ruiz@gmail.com</td></tr>
  <tr><td>Teléfono:</td><td>442 123 4567</td></tr>
  <tr><td>Mensaje:</td><td>Hola, ¿sigue disponible? ¿Aceptan crédito Infonavit?</td></tr>
  <tr><td>Código del aviso:</td><td>CB-001</td></tr>
</table>
<p>Inmuebles24 · No respondas a este correo</p>
</body></html>`;

const lamudiTexto = `Hola Casas del Bajío,

Recibiste una nueva consulta en Lamudi.

Nombre
Jorge Medina
Teléfono
+52 1 55 9876 5432
Correo electrónico
jorge.medina@outlook.com
Mensaje
Me interesa el departamento, quisiera agendar una visita este fin de semana.
Referencia
CB-002

Ver anuncio: https://www.lamudi.com.mx/detalle/41032-73-a1b2c3d4
© Lamudi`;

const vivanunciosTexto = `Asunto: Tienes un nuevo mensaje sobre tu anuncio

Interesado: Laura Gómez
Mensaje: Buenas tardes, ¿la casa tiene estacionamiento para dos autos? Mi número es 33 1234 5678.
Responde a este mensaje desde Vivanuncios.
https://www.vivanuncios.com.mx/a-venta-inmuebles/zapopan/casa-1001234567`;

describe("htmlATexto", () => {
  it("convierte tablas en líneas con tabulador, decodifica entidades y conserva enlaces", () => {
    const texto = htmlATexto(inmuebles24Html);
    expect(texto).toContain("Nombre:\tMaría Fernanda Ruiz");
    expect(texto).toContain("escribió");
    expect(texto).toContain("Casa en Juriquilla (https://www.inmuebles24.com/propiedades/casa-en-juriquilla-143829475.html)");
    expect(texto).not.toContain("color:red");
  });
});

describe("detectarPortal", () => {
  it("por remitente", () => {
    expect(detectarPortal({ de: "Inmuebles24 <contactos@inmuebles24.com>", asunto: "", texto: "" })).toBe("inmuebles24");
  });
  it("por contenido en un reenvío manual", () => {
    expect(detectarPortal({ de: "ana@casasdelbajio.mx", asunto: "Fwd: nuevo contacto", texto: lamudiTexto })).toBe("lamudi");
  });
  it("correo ajeno", () => {
    expect(detectarPortal({ de: "banco@banco.mx", asunto: "Estado de cuenta", texto: "Saldo" })).toBeNull();
  });
});

describe("parsearCorreoPortal", () => {
  it("Inmuebles24 en HTML con tabla", () => {
    const r = parsearCorreoPortal({
      de: "Inmuebles24 <noreply@inmuebles24.com>",
      asunto: "Nuevo contacto para tu aviso",
      texto: htmlATexto(inmuebles24Html),
    });
    expect(r).toEqual({
      ok: true,
      datos: {
        fuente: "inmuebles24",
        nombre: "María Fernanda Ruiz",
        telefono: "+524421234567",
        email: "mafer.ruiz@gmail.com",
        mensaje: "Hola, ¿sigue disponible? ¿Aceptan crédito Infonavit?",
        referencia: "CB-001",
        urlAnuncio: "https://www.inmuebles24.com/propiedades/casa-en-juriquilla-143829475.html",
      },
    });
  });

  it("Lamudi en texto con la etiqueta en una línea y el valor en la siguiente", () => {
    const r = parsearCorreoPortal({ de: "Lamudi <consultas@lamudi.com.mx>", asunto: "Nueva consulta", texto: lamudiTexto });
    expect(r.ok && r.datos).toMatchObject({
      fuente: "lamudi",
      nombre: "Jorge Medina",
      telefono: "+525598765432",
      email: "jorge.medina@outlook.com",
      referencia: "CB-002",
      urlAnuncio: "https://www.lamudi.com.mx/detalle/41032-73-a1b2c3d4",
    });
  });

  it("Vivanuncios: sin etiqueta de teléfono, lo encuentra en el mensaje; email por Reply-To", () => {
    const r = parsearCorreoPortal({
      de: "Vivanuncios <no-reply@vivanuncios.com.mx>",
      responderA: "laura.gomez@yahoo.com.mx",
      asunto: "Tienes un nuevo mensaje",
      texto: vivanunciosTexto,
    });
    expect(r.ok && r.datos).toMatchObject({
      fuente: "vivanuncios",
      nombre: "Laura Gómez",
      telefono: "+523312345678",
      email: "laura.gomez@yahoo.com.mx",
      referencia: null,
    });
  });

  it("no toma correos del portal como si fueran del interesado", () => {
    const r = parsearCorreoPortal({
      de: "noreply@inmuebles24.com",
      responderA: "noreply@inmuebles24.com",
      asunto: "Nuevo contacto",
      texto: "Nombre: Pedro\nTeléfono: 5512345678\nEscríbenos a soporte@inmuebles24.com",
    });
    expect(r.ok && r.datos.email).toBeNull();
    expect(r.ok && r.datos.telefono).toBe("+525512345678");
  });

  it("descarta correos de portal sin datos de contacto", () => {
    const r = parsearCorreoPortal({ de: "noticias@lamudi.com.mx", asunto: "Tendencias del mercado", texto: "Lee nuestro blog" });
    expect(r).toEqual({ ok: false, motivo: "Correo de lamudi sin teléfono ni correo del interesado" });
  });

  it("descarta correos que no son de portales (p. ej. la verificación de reenvío de Gmail)", () => {
    const r = parsearCorreoPortal({
      de: "Gmail Team <forwarding-noreply@google.com>",
      asunto: "(#123456789) Confirmación de reenvío de Gmail",
      texto: "Código de confirmación: 123456789",
    });
    expect(r.ok).toBe(false);
  });
});

describe("slugDeDestinatarios", () => {
  it.each([
    [["casas-del-bajio@leads.inmocrm.mx"], "casas-del-bajio"],
    [["Casas <Casas-Del-Bajio@Leads.InmoCRM.mx>"], "casas-del-bajio"],
    [["ana@gmail.com", "casas-del-bajio+portales@leads.inmocrm.mx"], "casas-del-bajio"],
    [["casas-del-bajio@otro-dominio.mx"], null],
    [["x@leads.inmocrm.mx"], null],
    [[], null],
  ])("%j → %s", (dirs, esperado) => {
    expect(slugDeDestinatarios(dirs, "leads.inmocrm.mx")).toBe(esperado);
  });
});

describe("correoDesdePostmark", () => {
  it("normaliza destinatarios y prefiere el HTML", () => {
    const c = correoDesdePostmark({
      MessageID: "abc-123",
      From: "noreply@inmuebles24.com",
      To: "ana@gmail.com",
      OriginalRecipient: "casas-del-bajio@leads.inmocrm.mx",
      ToFull: [{ Email: "ana@gmail.com" }],
      Subject: "Nuevo contacto",
      TextBody: "texto plano",
      HtmlBody: "<p>Hola</p>",
    });
    expect(c).toEqual({
      messageId: "abc-123",
      de: "noreply@inmuebles24.com",
      responderA: null,
      destinatarios: ["casas-del-bajio@leads.inmocrm.mx", "ana@gmail.com"],
      asunto: "Nuevo contacto",
      texto: "Hola",
    });
  });

  it("rechaza payloads sin MessageID", () => {
    expect(correoDesdePostmark({ From: "x" })).toBeNull();
  });
});
