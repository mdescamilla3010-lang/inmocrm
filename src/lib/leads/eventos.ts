import type { Database, Json } from "@/lib/supabase/database.types";
import { ETIQUETA_SEGUIMIENTO } from "@/lib/seguimiento/reglas";
import { ETIQUETA_ESTADO, ETIQUETA_FUENTE, ETIQUETA_SCORE } from "./etiquetas";

type Evento = Pick<Database["public"]["Tables"]["eventos_lead"]["Row"], "tipo" | "datos" | "usuario_id">;

const CAMPOS: Record<string, string> = {
  operacion_interes: "operación",
  tipo_propiedad_interes: "tipo de propiedad",
  zona_interes: "zona",
  zona_id: "zona del catálogo",
  presupuesto_min: "presupuesto mínimo",
  presupuesto_max: "presupuesto máximo",
  forma_pago: "forma de pago",
  credito_preaprobado: "crédito preaprobado",
  urgencia: "urgencia",
  recamaras_min: "recámaras",
  notas_calificacion: "notas",
  nombre: "nombre",
  telefono: "teléfono",
  email: "correo",
};

function dato(datos: Json, clave: string): string | null {
  if (datos && typeof datos === "object" && !Array.isArray(datos)) {
    const v = datos[clave];
    if (typeof v === "string") return v;
    if (typeof v === "boolean") return String(v);
  }
  return null;
}

function lista(datos: Json, clave: string): string[] {
  if (datos && typeof datos === "object" && !Array.isArray(datos) && Array.isArray(datos[clave])) {
    return (datos[clave] as Json[]).filter((x): x is string => typeof x === "string");
  }
  return [];
}

const etiqueta = <K extends string>(mapa: Record<K, string>, valor: string | null) =>
  valor && valor in mapa ? mapa[valor as K] : (valor ?? "—");

/** Texto de un evento de la línea de tiempo. `nombres` resuelve ids de usuario. */
export function describirEvento(evento: Evento, nombres: Record<string, string>): string {
  const d = evento.datos;
  const quien = evento.usuario_id ? (nombres[evento.usuario_id] ?? "Alguien del equipo") : null;
  const asesor = (id: string | null) => (id ? (nombres[id] ?? "otro asesor") : "nadie");

  switch (evento.tipo) {
    case "capturado":
      return `Llegó por ${etiqueta(ETIQUETA_FUENTE, dato(d, "fuente"))}${quien ? ` (capturado por ${quien})` : ""}`;
    case "recapturado": {
      const reabierto = dato(d, "reabierto") === "true" ? "; se reabrió" : "";
      return `Volvió a escribir por ${etiqueta(ETIQUETA_FUENTE, dato(d, "fuente"))}${reabierto}`;
    }
    case "asignado": {
      const motivo = dato(d, "descripcion");
      return `Asignado a ${asesor(dato(d, "asesor_id"))}${quien ? ` por ${quien}` : motivo ? ` · ${motivo}` : ""}`;
    }
    case "reasignado":
      return `Reasignado de ${asesor(dato(d, "de"))} a ${asesor(dato(d, "asesor_id"))}${quien ? ` por ${quien}` : ""}`;
    case "estado_cambiado":
      return `Estado: ${etiqueta(ETIQUETA_ESTADO, dato(d, "de"))} → ${etiqueta(ETIQUETA_ESTADO, dato(d, "a"))}${quien ? ` (${quien})` : ""}`;
    case "score_cambiado": {
      const motivo = dato(d, "motivo");
      return `Score: ${etiqueta(ETIQUETA_SCORE, dato(d, "a"))}${motivo ? ` · ${motivo}` : ""}`;
    }
    case "calificacion_editada":
    case "contacto_editado": {
      const campos = lista(d, "campos").map((c) => CAMPOS[c] ?? c);
      return `${quien ?? "Se"} actualizó ${campos.join(", ") || "datos"}`;
    }
    case "nota":
      return dato(d, "texto") ?? "";
    case "cita_agendada":
      return dato(d, "origen") === "agente" ? "El agente agendó una visita" : `Visita agendada${quien ? ` por ${quien}` : ""}`;
    case "cita_cancelada": {
      const motivo = dato(d, "motivo");
      return `Visita cancelada${motivo ? ` · ${motivo}` : ""}`;
    }
    case "cita_realizada":
      return `Visita realizada${quien ? ` (marcó ${quien})` : ""}`;
    case "cita_no_asistio":
      return "No asistió a la visita";
    case "seguimiento_enviado":
      return `Se envió: ${ETIQUETA_SEGUIMIENTO[dato(d, "tipo") as keyof typeof ETIQUETA_SEGUIMIENTO] ?? "seguimiento"}`;
    case "ia_pausada":
      return `${quien ?? "Un asesor"} tomó la conversación (IA en pausa)`;
    case "ia_reanudada":
      return "La IA retomó la conversación";
    case "opt_out":
      return "Pidió no ser contactado";
    default:
      return evento.tipo;
  }
}
