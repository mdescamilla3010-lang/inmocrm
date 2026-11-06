import { createHash, timingSafeEqual } from "node:crypto";

/** Compara secretos en tiempo constante (sin filtrar la longitud). */
export function secretosIguales(a: string, b: string): boolean {
  const ha = createHash("sha256").update(a).digest();
  const hb = createHash("sha256").update(b).digest();
  return timingSafeEqual(ha, hb);
}

/** Contraseña de un header `Authorization: Basic …` (el usuario se ignora). */
export function contrasenaBasic(header: string | null): string | null {
  if (!header?.startsWith("Basic ")) return null;
  try {
    const decodificado = Buffer.from(header.slice(6).trim(), "base64").toString("utf8");
    const i = decodificado.indexOf(":");
    return i === -1 ? null : decodificado.slice(i + 1);
  } catch {
    return null;
  }
}
