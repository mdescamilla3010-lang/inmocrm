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

export type EstadoLeadParaAgente = {
  nombre: string | null;
  fuente: string;
  mensajeInicial: string | null;
  propiedadInteres: string | null;
  operacion: string | null;
  tipoPropiedad: string | null;
  zona: string | null;
  presupuestoMin: number | null;
  presupuestoMax: number | null;
  formaPago: string | null;
  creditoPreaprobado: boolean | null;
  urgencia: string | null;
  recamarasMin: number | null;
  interesVisita: string | null;
  /** Visitas próximas ya agendadas, descritas en hora local. */
  citas: string[];
  score: string | null;
  faltantes: string[];
  asesor: string | null;
  previos: string[];
};

const pesos = (n: number | null) => (n === null ? null : `$${Math.round(n).toLocaleString("es-MX")}`);

/** Texto del mensaje de sistema con el estado del lead y la hora local. */
export function describirEstadoLead(e: EstadoLeadParaAgente, horaLocal: string): string {
  const presupuesto =
    e.presupuestoMin || e.presupuestoMax ? [pesos(e.presupuestoMin), pesos(e.presupuestoMax)].filter(Boolean).join(" a ") : null;
  const sufijoCredito = e.creditoPreaprobado === true ? " (preaprobado)" : e.creditoPreaprobado === false ? " (sin aprobar)" : "";
  const pago = e.formaPago ? `${e.formaPago}${sufijoCredito}` : null;
  const lineas: [string, string | null][] = [
    ["Nombre", e.nombre],
    ["Llegó por", e.fuente],
    ["Propiedad por la que preguntó", e.propiedadInteres],
    ["Su primer mensaje o formulario", e.mensajeInicial],
    ["Operación", e.operacion],
    ["Tipo de propiedad", e.tipoPropiedad],
    ["Zona", e.zona],
    ["Presupuesto", presupuesto],
    ["Forma de pago", pago],
    ["Para cuándo", e.urgencia],
    ["Recámaras mínimas", e.recamarasMin?.toString() ?? null],
    ["Quiere visitar", e.interesVisita],
    ["Score actual", e.score],
    ["Asesor asignado", e.asesor],
  ];
  const datos = lineas.filter(([, v]) => v).map(([k, v]) => `- ${k}: ${v}`);
  return [
    `Hora local: ${horaLocal}.`,
    "Estado del lead (actualizado):",
    ...(datos.length ? datos : ["- Aún no sabemos nada de lo que busca."]),
    ...(e.citas.length ? [`Visitas agendadas: ${e.citas.join("; ")}.`] : []),
    e.faltantes.length ? `Falta averiguar: ${e.faltantes.join(", ")}.` : "Ya tenemos los datos clave.",
    ...(e.previos.length ? [`Antes de que respondiera le enviamos: "${e.previos.join(" / ")}"`] : []),
  ].join("\n");
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
