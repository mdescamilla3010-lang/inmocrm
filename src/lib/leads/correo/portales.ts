import { normalizarTelefono } from "@/lib/telefono";
import { normalizarTexto } from "@/lib/asignacion/texto";

export type Portal = "inmuebles24" | "lamudi" | "vivanuncios";

const DOMINIOS: Record<Portal, string> = {
  inmuebles24: "inmuebles24.com",
  lamudi: "lamudi.com.mx",
  vivanuncios: "vivanuncios.com.mx",
};

export type CorreoParaParsear = {
  de: string;
  responderA?: string | null;
  asunto: string;
  texto: string;
};

export type DatosPortal = {
  fuente: Portal;
  nombre: string | null;
  telefono: string | null;
  email: string | null;
  mensaje: string | null;
  /** Código/clave del anuncio para ligar el lead con una propiedad del catálogo. */
  referencia: string | null;
  urlAnuncio: string | null;
};

export type ResultadoParseo = { ok: true; datos: DatosPortal } | { ok: false; motivo: string };

/** Identifica el portal por remitente o por menciones en el correo (reenvíos manuales). */
export function detectarPortal(correo: CorreoParaParsear): Portal | null {
  const remitentes = `${correo.de} ${correo.responderA ?? ""}`.toLowerCase();
  for (const [portal, dominio] of Object.entries(DOMINIOS) as [Portal, string][]) {
    if (remitentes.includes(dominio)) return portal;
  }
  const cuerpo = `${correo.asunto}\n${correo.texto}`.toLowerCase();
  for (const [portal, dominio] of Object.entries(DOMINIOS) as [Portal, string][]) {
    if (cuerpo.includes(dominio) || cuerpo.includes(portal)) return portal;
  }
  return null;
}

type Campo = "nombre" | "telefono" | "email" | "mensaje" | "referencia";

// Etiquetas normalizadas (sin acentos, minúsculas). Orden: de más a menos específica.
const ETIQUETAS: Record<Campo, string[]> = {
  nombre: ["nombre completo", "nombre del interesado", "nombre del contacto", "nombre", "interesado", "contacto"],
  telefono: ["telefono de contacto", "numero de telefono", "telefono", "tel", "celular", "movil", "whatsapp"],
  email: ["correo electronico", "e mail", "email", "correo", "mail"],
  mensaje: ["mensaje", "comentarios", "comentario", "consulta", "pregunta"],
  referencia: [
    "codigo del aviso", "codigo de aviso", "codigo del anunciante", "codigo de anunciante",
    "id del aviso", "id del anuncio", "id de la propiedad", "clave de la propiedad",
    "referencia", "clave", "codigo",
  ],
};

const CAMPO_POR_ETIQUETA = new Map<string, Campo>(
  (Object.entries(ETIQUETAS) as [Campo, string[]][]).flatMap(([campo, etiquetas]) =>
    etiquetas.map((e) => [e, campo] as const),
  ),
);

const RE_EMAIL = /[a-z0-9._%+-]+@[a-z0-9.-]+\.[a-z]{2,}/gi;
const RE_TELEFONO = /(?:\+?\d[\d\s().-]{8,18}\d)/g;
const RE_URL_PORTAL = /https?:\/\/(?:www\.)?(?:inmuebles24\.com|lamudi\.com\.mx|vivanuncios\.com\.mx)\/[^\s)"'<>]+/gi;

function esCorreoDelSistema(email: string): boolean {
  const e = email.toLowerCase();
  return (
    Object.values(DOMINIOS).some((d) => e.endsWith(`@${d}`) || e.endsWith(`.${d}`)) ||
    /^(no-?reply|noresponder|notificaciones|notifications|mailer-daemon)@/.test(e)
  );
}

/** Busca "Etiqueta: valor", "Etiqueta<TAB>valor" o la etiqueta sola con el valor en la línea siguiente. */
function extraerPorEtiquetas(texto: string): Partial<Record<Campo, string>> {
  const lineas = texto.split("\n").map((l) => l.trim());
  const encontrados: Partial<Record<Campo, string>> = {};

  for (let i = 0; i < lineas.length; i++) {
    const m = /^([^:\t]{2,40}?)\s*[:\t]\s*(.*)$/.exec(lineas[i]) ?? /^([^:\t]{2,40})$/.exec(lineas[i]);
    if (!m) continue;
    const campo = CAMPO_POR_ETIQUETA.get(normalizarTexto(m[1]));
    if (!campo || encontrados[campo]) continue;

    let valor = (m[2] ?? "").trim();
    if (!valor) {
      const siguiente = lineas.slice(i + 1).find((l) => l !== "");
      // Si la siguiente línea es otra etiqueta, el campo venía vacío.
      if (siguiente && !CAMPO_POR_ETIQUETA.has(normalizarTexto(siguiente.split(/[:\t]/)[0] ?? ""))) {
        valor = siguiente;
      }
    }
    if (valor) encontrados[campo] = valor.replace(/\s*\t\s*/g, " ").trim();
  }
  return encontrados;
}

export function parsearCorreoPortal(correo: CorreoParaParsear): ResultadoParseo {
  const fuente = detectarPortal(correo);
  if (!fuente) return { ok: false, motivo: "No es un correo de Inmuebles24, Lamudi ni Vivanuncios" };

  const campos = extraerPorEtiquetas(correo.texto);

  let email = campos.email?.match(RE_EMAIL)?.[0]?.toLowerCase() ?? null;
  if (!email && correo.responderA && !esCorreoDelSistema(correo.responderA)) {
    email = correo.responderA.match(RE_EMAIL)?.[0]?.toLowerCase() ?? null;
  }
  if (!email) {
    email = (correo.texto.match(RE_EMAIL) ?? []).map((e) => e.toLowerCase()).find((e) => !esCorreoDelSistema(e)) ?? null;
  }

  let telefono = normalizarTelefono(campos.telefono);
  if (!telefono) {
    telefono = (correo.texto.match(RE_TELEFONO) ?? []).map((t) => normalizarTelefono(t)).find(Boolean) ?? null;
  }

  if (!telefono && !email) {
    return { ok: false, motivo: `Correo de ${fuente} sin teléfono ni correo del interesado` };
  }

  const urlAnuncio = correo.texto.match(RE_URL_PORTAL)?.[0] ?? null;
  const referencia = campos.referencia?.split(/\s/)[0]?.replace(/[.,;]+$/, "") ?? null;

  return {
    ok: true,
    datos: {
      fuente,
      nombre: campos.nombre ?? null,
      telefono,
      email,
      mensaje: campos.mensaje ?? null,
      referencia,
      urlAnuncio,
    },
  };
}
