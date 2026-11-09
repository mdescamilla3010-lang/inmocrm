export const BUCKET_FOTOS = "propiedades";
export const TIPOS_FOTO = ["image/jpeg", "image/png", "image/webp"] as const;
export const MAX_BYTES_FOTO = 10 * 1024 * 1024;
export const MAX_FOTOS_POR_PROPIEDAD = 30;

const EXTENSION: Record<(typeof TIPOS_FOTO)[number], string> = {
  "image/jpeg": "jpg",
  "image/png": "png",
  "image/webp": "webp",
};

/** <inmobiliaria>/<propiedad>/<aleatorio>.<ext>: la política de Storage exige la carpeta de la inmobiliaria. */
export function rutaNuevaFoto(inmobiliariaId: string, propiedadId: string, tipo: string, aleatorio: string): string | null {
  const ext = EXTENSION[tipo as (typeof TIPOS_FOTO)[number]];
  if (!ext) return null;
  return `${inmobiliariaId}/${propiedadId}/${aleatorio}.${ext}`;
}

/** El servidor sólo registra rutas dentro de la carpeta de esa propiedad. */
export function esRutaDeLaPropiedad(ruta: string, inmobiliariaId: string, propiedadId: string): boolean {
  const prefijo = `${inmobiliariaId}/${propiedadId}/`;
  if (!ruta.startsWith(prefijo)) return false;
  const archivo = ruta.slice(prefijo.length);
  return /^[a-zA-Z0-9_-]{8,64}\.(jpg|png|webp)$/.test(archivo);
}

export function urlPublicaFoto(supabaseUrl: string, ruta: string): string {
  return `${supabaseUrl.replace(/\/$/, "")}/storage/v1/object/public/${BUCKET_FOTOS}/${ruta
    .split("/")
    .map(encodeURIComponent)
    .join("/")}`;
}

export function validarArchivoFoto(archivo: { type: string; size: number }): string | null {
  if (!(TIPOS_FOTO as readonly string[]).includes(archivo.type)) return "Sólo JPG, PNG o WebP";
  if (archivo.size > MAX_BYTES_FOTO) return "Cada foto debe pesar menos de 10 MB";
  return null;
}
