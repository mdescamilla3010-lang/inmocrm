import { normalizarTexto } from "./texto";

export type Zona = { id: string; nombre: string; alias: readonly string[] };

/**
 * Encuentra la zona del catálogo que menciona un texto libre del prospecto
 * ("busco algo por Juriquilla o Zibatá", "Polanquito"). Compara palabras
 * completas, sin acentos. Si hay varias, gana la mención más específica
 * (más larga); si empatan, la que aparece primero en el texto.
 */
export function resolverZona(texto: string | null | undefined, zonas: readonly Zona[]): string | null {
  if (!texto) return null;
  const objetivo = ` ${normalizarTexto(texto)} `;
  if (objetivo.trim() === "") return null;

  let mejor: { id: string; largo: number; posicion: number } | null = null;
  for (const zona of zonas) {
    for (const termino of [zona.nombre, ...zona.alias]) {
      const t = normalizarTexto(termino);
      if (!t) continue;
      const posicion = objetivo.indexOf(` ${t} `);
      if (posicion === -1) continue;
      if (!mejor || t.length > mejor.largo || (t.length === mejor.largo && posicion < mejor.posicion)) {
        mejor = { id: zona.id, largo: t.length, posicion };
      }
    }
  }
  return mejor?.id ?? null;
}
