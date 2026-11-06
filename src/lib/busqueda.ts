/** Quita caracteres con significado en los filtros de PostgREST. */
export function limpiarBusqueda(q: string): string {
  return q.replace(/[,()*%\\:"']/g, " ").replace(/\s+/g, " ").trim();
}

export function primerValor(v: string | string[] | undefined): string | undefined {
  return Array.isArray(v) ? v[0] : v;
}
