import { dentroDeVentana } from "@/lib/mensajeria/tipos";
import type { Database } from "@/lib/supabase/database.types";

type E = Database["public"]["Enums"];
export type TipoSeguimiento = E["tipo_seguimiento"];

export const ES_RECORDATORIO: Record<TipoSeguimiento, boolean> = {
  recordatorio_24h: true,
  recordatorio_2h: true,
  reactivacion_3d: false,
  reactivacion_7d: false,
  reactivacion_15d: false,
};

const ANTICIPACION_MIN: Partial<Record<TipoSeguimiento, number>> = { recordatorio_24h: 24 * 60, recordatorio_2h: 120 };

/** Estados en los que un lead ya no se reactiva (avanzó o se cerró). */
const ESTADOS_SIN_REACTIVACION = new Set<E["estado_lead"]>(["cita_agendada", "visita_realizada", "ganado", "perdido", "descartado"]);

export type ContextoSeguimiento = {
  tipo: TipoSeguimiento;
  programadoPara: Date;
  ahora: Date;
  config: { recordatoriosActivos: boolean; reactivacionActiva: boolean };
  lead: { optOut: boolean; telefono: string | null; score: E["score_lead"] | null; estado: E["estado_lead"] };
  conversacion: { iaActiva: boolean; ultimoEntrante: Date | null } | null;
  cita: { estado: E["estado_cita"]; inicio: Date } | null;
  /** Visitas activas del lead (para no reactivar a quien ya tiene una). */
  citasActivas: number;
  canal: { conectado: boolean; plantilla: string | null };
};

export type Decision = { accion: "enviar"; via: "texto" | "plantilla" } | { accion: "cancelar"; motivo: string };

const cancelar = (motivo: string): Decision => ({ accion: "cancelar", motivo });

/**
 * ¿Todavía tiene sentido enviar este seguimiento? Se decide al momento de
 * enviar porque entre que se programó y ahora el prospecto pudo contestar,
 * agendar, pedir la baja o el asesor tomar la conversación.
 */
export function decidirSeguimiento(c: ContextoSeguimiento): Decision {
  if (!c.lead.telefono) return cancelar("El lead no tiene teléfono");
  if (c.lead.optOut) return cancelar("El prospecto pidió no ser contactado");
  if (!c.canal.conectado) return cancelar("WhatsApp no está conectado");

  const minutosAtraso = (c.ahora.getTime() - c.programadoPara.getTime()) / 60_000;

  if (ES_RECORDATORIO[c.tipo]) {
    if (!c.config.recordatoriosActivos) return cancelar("Los recordatorios están desactivados");
    if (!c.cita || (c.cita.estado !== "programada" && c.cita.estado !== "confirmada")) return cancelar("La cita ya no está activa");
    const faltan = (c.cita.inicio.getTime() - c.ahora.getTime()) / 60_000;
    if (faltan <= 0) return cancelar("La visita ya pasó");
    const esperado = c.cita.inicio.getTime() - (ANTICIPACION_MIN[c.tipo] ?? 0) * 60_000;
    if (Math.abs(esperado - c.programadoPara.getTime()) > 5 * 60_000) return cancelar("La cita se reprogramó");
    // Si el de 24 h se atrasó hasta la ventana del de 2 h, ya sólo va el de 2 h.
    if (c.tipo === "recordatorio_24h" && faltan <= 150) return cancelar("Se atrasó; queda el recordatorio de 2 h");
    if (c.tipo === "recordatorio_2h" && faltan <= 20) return cancelar("Demasiado cerca de la visita");
  } else {
    if (!c.config.reactivacionActiva) return cancelar("La reactivación está desactivada");
    if (ESTADOS_SIN_REACTIVACION.has(c.lead.estado)) return cancelar("El lead ya avanzó o se cerró");
    if (c.citasActivas > 0) return cancelar("Tiene una visita agendada");
    if (c.lead.score === "caliente" || c.lead.score === "tibio") return cancelar("No es un lead frío");
    if (c.conversacion && !c.conversacion.iaActiva) return cancelar("Lo atiende un asesor");
    // Si el cron estuvo caído días, no se manda un mensaje desfasado.
    if (minutosAtraso > 2 * 24 * 60) return cancelar("Venció sin enviarse");
  }

  if (dentroDeVentana(c.conversacion?.ultimoEntrante ?? null, c.ahora)) return { accion: "enviar", via: "texto" };
  if (c.canal.plantilla) return { accion: "enviar", via: "plantilla" };
  return cancelar("Fuera de la ventana de 24 h y sin plantilla aprobada configurada");
}

export type DatosMensaje = {
  nombre: string | null;
  inmobiliaria: string;
  /** "sábado 15 de noviembre, 10:00" */
  cuando?: string;
  /** "10:00" */
  hora?: string;
  lugar?: string | null;
  asesor?: string | null;
};

const saludo = (nombre: string | null) => (nombre ? `Hola ${nombre.split(" ")[0]}` : "Hola");

/** Texto libre (sólo dentro de la ventana de 24 h). */
export function textoSeguimiento(tipo: TipoSeguimiento, d: DatosMensaje): string {
  const lugar = d.lugar ? ` en ${d.lugar}` : "";
  const asesor = d.asesor ? `${d.asesor} te atiende.` : "";
  switch (tipo) {
    case "recordatorio_24h":
      return `${saludo(d.nombre)} 👋 Te recuerdo tu visita de mañana, ${d.cuando}${lugar}. ${asesor} ¿Nos confirmas que sigue en pie?`.replace(/\s+/g, " ").trim();
    case "recordatorio_2h":
      return `${saludo(d.nombre)}, nos vemos hoy a las ${d.hora}${lugar}. ${asesor} Si surge algo, avísanos por aquí.`.replace(/\s+/g, " ").trim();
    case "reactivacion_3d":
      return `${saludo(d.nombre)}, ¿pudiste pensar en lo que buscas? Si me cuentas tu zona y presupuesto, te comparto opciones de ${d.inmobiliaria}.`;
    case "reactivacion_7d":
      return `${saludo(d.nombre)}, seguimos con propiedades disponibles que podrían interesarte. ¿Te gustaría que te mande algunas opciones?`;
    case "reactivacion_15d":
      return `${saludo(d.nombre)}, ¿sigues buscando propiedad? Si ya no, dímelo y dejo de escribirte. Si sí, aquí estoy para ayudarte.`;
  }
}

/** Parámetros de la plantilla aprobada ({{1}}, {{2}}, …). */
export function parametrosPlantilla(tipo: TipoSeguimiento, d: DatosMensaje): string[] {
  const nombre = d.nombre?.split(" ")[0] ?? "hola";
  return ES_RECORDATORIO[tipo] ? [nombre, d.cuando ?? "", d.lugar ?? "la propiedad"] : [nombre, d.inmobiliaria];
}

export const MAX_INTENTOS = 3;

/** Cuándo reintentar un envío fallido; null = ya no (se marca como fallido). */
export function siguienteReintento(intentos: number, ahora: Date): Date | null {
  if (intentos >= MAX_INTENTOS) return null;
  return new Date(ahora.getTime() + intentos * 15 * 60_000);
}

export const ETIQUETA_SEGUIMIENTO: Record<TipoSeguimiento, string> = {
  recordatorio_24h: "Recordatorio 24 h antes",
  recordatorio_2h: "Recordatorio 2 h antes",
  reactivacion_3d: "Reactivación (3 días)",
  reactivacion_7d: "Reactivación (7 días)",
  reactivacion_15d: "Reactivación (15 días)",
};
