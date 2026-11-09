export type EstrategiaAsignacion = "round_robin" | "zona";

export type AsesorParaAsignar = {
  id: string;
  activo: boolean;
  recibeLeads: boolean;
  zonaIds: readonly string[];
};

export type MotivoAsignacion =
  | "zona"                 // asesores que cubren la zona del lead
  | "round_robin"          // estrategia round robin
  | "respaldo_sin_zona"    // estrategia por zona, pero no se conoce la zona
  | "respaldo_zona_sin_asesor" // nadie disponible cubre esa zona
  | "sin_asesores";        // nadie del equipo recibe leads

export type ResultadoCandidatos = { candidatos: string[]; motivo: MotivoAsignacion };

/**
 * Decide entre quiénes se reparte un lead. El elegido final (el que lleva más
 * tiempo sin recibir un lead) lo escoge la base de datos de forma atómica:
 * `siguiente_asesor_round_robin`.
 *
 * Por zona, si no hay zona o nadie la cubre, se usa round robin entre todo el
 * equipo como respaldo (decisión #5 de docs/arquitectura.md).
 */
export function candidatosParaLead(args: {
  estrategia: EstrategiaAsignacion;
  asesores: readonly AsesorParaAsignar[];
  zonaId: string | null;
}): ResultadoCandidatos {
  const disponibles = args.asesores.filter((a) => a.activo && a.recibeLeads);
  const todos = disponibles.map((a) => a.id);
  if (todos.length === 0) return { candidatos: [], motivo: "sin_asesores" };

  if (args.estrategia === "round_robin") return { candidatos: todos, motivo: "round_robin" };

  if (!args.zonaId) return { candidatos: todos, motivo: "respaldo_sin_zona" };

  const deLaZona = disponibles.filter((a) => a.zonaIds.includes(args.zonaId!)).map((a) => a.id);
  if (deLaZona.length === 0) return { candidatos: todos, motivo: "respaldo_zona_sin_asesor" };
  return { candidatos: deLaZona, motivo: "zona" };
}

export const DESCRIPCION_MOTIVO: Record<MotivoAsignacion, string> = {
  zona: "Asignado por zona",
  round_robin: "Asignado por turno (round robin)",
  respaldo_sin_zona: "Zona desconocida: asignado por turno",
  respaldo_zona_sin_asesor: "Nadie cubre esa zona: asignado por turno",
  sin_asesores: "Sin asesores disponibles: queda sin asignar",
};
