/**
 * Saca el slug de la inmobiliaria de la dirección a la que llegó el correo:
 * "casas-del-bajio@leads.inmocrm.mx" → "casas-del-bajio". Acepta etiquetas
 * "slug+algo@dominio" y nombres "Casas <slug@dominio>".
 */
export function slugDeDestinatarios(direcciones: readonly string[], dominio: string): string | null {
  const dom = dominio.toLowerCase().replace(/^@/, "");
  for (const d of direcciones) {
    const email = (/<([^>]+)>/.exec(d)?.[1] ?? d).trim().toLowerCase();
    const [local, host] = email.split("@");
    if (!local || host !== dom) continue;
    const slug = local.split("+")[0];
    if (/^[a-z0-9][a-z0-9-]{2,39}$/.test(slug)) return slug;
  }
  return null;
}
