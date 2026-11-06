import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * `state` del flujo OAuth: id del usuario + caducidad, firmado con HMAC.
 * Evita que alguien conecte su calendario a la cuenta de otro (CSRF) y que
 * se reuse un enlace viejo.
 */
const VIGENCIA_MS = 10 * 60 * 1000;

function firma(datos: string, secreto: string) {
  return createHmac("sha256", `oauth-google:${secreto}`).update(datos).digest("base64url");
}

export function crearEstadoOAuth(usuarioId: string, secreto: string, ahora = Date.now()): string {
  const datos = `${usuarioId}.${ahora + VIGENCIA_MS}.${randomBytes(8).toString("base64url")}`;
  return `${datos}.${firma(datos, secreto)}`;
}

/** Devuelve el usuario si el state es auténtico y vigente. */
export function verificarEstadoOAuth(state: string | null, secreto: string, ahora = Date.now()): string | null {
  if (!state) return null;
  const partes = state.split(".");
  if (partes.length !== 4) return null;
  const [usuarioId, vence, nonce, recibida] = partes;
  const esperada = firma(`${usuarioId}.${vence}.${nonce}`, secreto);
  const a = Buffer.from(recibida);
  const b = Buffer.from(esperada);
  if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
  if (!(Number(vence) > ahora)) return null;
  return usuarioId;
}
