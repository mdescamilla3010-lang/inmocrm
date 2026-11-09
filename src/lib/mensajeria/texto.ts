import { normalizarTexto } from "@/lib/asignacion/texto";

/** Límite de WhatsApp: 4096 caracteres por mensaje de texto. */
export const MAX_CARACTERES = 4096;

/** Divide un texto largo en partes, cortando de preferencia en párrafos o renglones. */
export function dividirMensaje(texto: string, max = MAX_CARACTERES): string[] {
  const limpio = texto.trim();
  if (!limpio) return [];
  const partes: string[] = [];
  let resto = limpio;
  while (resto.length > max) {
    const ventana = resto.slice(0, max);
    let corte = ventana.lastIndexOf("\n\n");
    if (corte < max * 0.5) corte = ventana.lastIndexOf("\n");
    if (corte < max * 0.5) corte = ventana.lastIndexOf(" ");
    if (corte <= 0) corte = max;
    partes.push(resto.slice(0, corte).trim());
    resto = resto.slice(corte).trim();
  }
  if (resto) partes.push(resto);
  return partes;
}

const PALABRAS_BAJA = new Set(["baja", "stop", "alto", "cancelar", "darme de baja", "unsubscribe"]);
const FRASES_BAJA = [
  "no me escriban",
  "no me vuelvan a escribir",
  "dejen de escribirme",
  "dejen de mandarme",
  "no me manden mensajes",
  "no quiero que me contacten",
  "no me contacten",
  "darme de baja",
  "dar de baja mi numero",
  "borren mi numero",
];

/**
 * Detecta pedidos claros de no ser contactado (LFPDPPP / políticas de
 * WhatsApp). Es conservador a propósito: "no me interesa" no es una baja, lo
 * maneja el agente.
 */
export function esSolicitudDeBaja(texto: string | null | undefined): boolean {
  if (!texto) return false;
  const t = normalizarTexto(texto);
  if (PALABRAS_BAJA.has(t)) return true;
  return FRASES_BAJA.some((f) => ` ${t} `.includes(` ${f} `));
}
