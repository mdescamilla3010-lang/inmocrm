/** Mismo patrón que el check de `inmobiliarias.slug` en la base. */
export const PATRON_SLUG = /^[a-z0-9][a-z0-9-]{2,39}$/;

/** "Casas del Bajío, S.A." → "casas-del-bajio-s-a" */
export function generarSlug(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/ñ/g, "n")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 40)
    .replace(/-+$/g, "");
}

export function esSlugValido(slug: string): boolean {
  return PATRON_SLUG.test(slug);
}
