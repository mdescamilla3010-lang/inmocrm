type Contacto = {
  nombre: string | null;
  telefono: string | null;
  email: string | null;
  propiedad_interes_id: string | null;
  zona_interes: string | null;
};

/**
 * Cuando un prospecto ya existente vuelve a llegar (otro portal, otro
 * anuncio), sólo se completan los datos que faltaban: nunca se sobrescribe lo
 * que el asesor o el agente ya tenían.
 */
export function camposParaCompletar(existente: Contacto, nuevo: Partial<Contacto>): Partial<Contacto> {
  const cambios: Partial<Contacto> = {};
  for (const campo of ["nombre", "telefono", "email", "propiedad_interes_id", "zona_interes"] as const) {
    const valor = nuevo[campo];
    if (!existente[campo] && valor) cambios[campo] = valor;
  }
  return cambios;
}
