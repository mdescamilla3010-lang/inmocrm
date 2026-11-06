import type Anthropic from "@anthropic-ai/sdk";

type Fila = {
  direccion: "entrante" | "saliente";
  autor: "prospecto" | "agente" | "asesor" | "sistema";
  contenido: string | null;
  tipo: string;
  nombreAsesor?: string | null;
};

/**
 * Convierte los mensajes guardados en el historial para la API: lo del
 * prospecto es `user`; lo que mandó la inmobiliaria (agente, asesor,
 * plantillas) es `assistant`. Al final va un mensaje de sistema con el estado
 * del lead (canal del operador: no rompe la caché ni se confunde con lo que
 * escribió el prospecto).
 *
 * Devuelve null si no hay nada que contestar (el último mensaje no es del prospecto).
 */
export function construirHistorial(filas: readonly Fila[], estadoLead: string): Anthropic.Beta.BetaMessageParam[] | null {
  const turnos: { role: "user" | "assistant"; partes: string[] }[] = [];
  for (const f of filas) {
    const texto = f.contenido?.trim();
    if (!texto) continue;
    const role = f.direccion === "entrante" ? "user" : "assistant";
    const contenido =
      f.autor === "asesor" ? `[Mensaje de ${f.nombreAsesor ?? "un asesor"}] ${texto}` : f.tipo === "plantilla" ? `[Plantilla] ${texto}` : texto;
    const ultimo = turnos.at(-1);
    if (ultimo?.role === role) ultimo.partes.push(contenido);
    else turnos.push({ role, partes: [contenido] });
  }

  // La API exige que el primer mensaje sea del usuario. Lo que la inmobiliaria
  // mandó antes (la plantilla de bienvenida) ya va descrito en el estado del lead.
  while (turnos[0]?.role === "assistant") turnos.shift();
  if (!turnos.length || turnos.at(-1)!.role !== "user") return null;

  return [
    ...turnos.map((t) => ({ role: t.role, content: t.partes.join("\n") })),
    { role: "system" as const, content: estadoLead },
  ];
}

/** Primeros mensajes que la inmobiliaria mandó antes de que el prospecto escribiera. */
export function mensajesPrevios(filas: readonly Fila[]): string[] {
  const previos: string[] = [];
  for (const f of filas) {
    if (f.direccion === "entrante") break;
    if (f.contenido?.trim()) previos.push(f.contenido.trim());
  }
  return previos;
}
