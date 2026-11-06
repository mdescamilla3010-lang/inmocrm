/** Rutas accesibles sin sesión. */
const PUBLICAS_EXACTAS = new Set(["/login", "/registro", "/recuperar"]);
const PUBLICAS_PREFIJO = ["/auth/"];

export function esRutaPublica(pathname: string): boolean {
  return PUBLICAS_EXACTAS.has(pathname) || PUBLICAS_PREFIJO.some((p) => pathname.startsWith(p));
}

/**
 * Devuelve `destino` sólo si es una ruta interna de la app; evita redirecciones
 * abiertas del tipo `?next=https://sitio-malicioso.com` o `?next=//evil.com`.
 */
export function rutaSegura(destino: unknown, porDefecto = "/leads"): string {
  if (typeof destino !== "string" || destino.length === 0) return porDefecto;
  if (!destino.startsWith("/") || destino.startsWith("//") || destino.startsWith("/\\")) {
    return porDefecto;
  }
  if (/[\u0000-\u001f]/.test(destino)) return porDefecto;
  return destino;
}
