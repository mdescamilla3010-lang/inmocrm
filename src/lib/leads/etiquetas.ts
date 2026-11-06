import type { Database } from "@/lib/supabase/database.types";

type E = Database["public"]["Enums"];

export const ETIQUETA_ESTADO: Record<E["estado_lead"], string> = {
  nuevo: "Nuevo",
  en_conversacion: "En conversación",
  calificado: "Calificado",
  cita_agendada: "Cita agendada",
  visita_realizada: "Visita realizada",
  ganado: "Ganado",
  perdido: "Perdido",
  descartado: "Descartado",
};

export const ETIQUETA_FUENTE: Record<E["fuente_lead"], string> = {
  meta_ads: "Meta Ads",
  landing: "Landing",
  inmuebles24: "Inmuebles24",
  lamudi: "Lamudi",
  vivanuncios: "Vivanuncios",
  whatsapp: "WhatsApp",
  manual: "Manual",
};

export const ETIQUETA_SCORE: Record<E["score_lead"], string> = {
  caliente: "Caliente",
  tibio: "Tibio",
  frio: "Frío",
};

export const ETIQUETA_FORMA_PAGO: Record<E["forma_pago"], string> = {
  contado: "Contado",
  credito_bancario: "Crédito bancario",
  infonavit: "Infonavit",
  fovissste: "Fovissste",
  otro: "Otro",
};

export const ETIQUETA_URGENCIA: Record<E["urgencia_lead"], string> = {
  menos_1_mes: "Menos de 1 mes",
  uno_a_tres_meses: "1 a 3 meses",
  tres_a_seis_meses: "3 a 6 meses",
  mas_de_seis_meses: "Más de 6 meses",
  sin_definir: "Sin definir",
};

export const ETIQUETA_TIPO_PROPIEDAD: Record<E["tipo_propiedad"], string> = {
  casa: "Casa",
  departamento: "Departamento",
  terreno: "Terreno",
  local_comercial: "Local comercial",
  oficina: "Oficina",
  bodega: "Bodega",
  otro: "Otro",
};

export const ETIQUETA_OPERACION: Record<E["operacion_propiedad"], string> = {
  venta: "Venta",
  renta: "Renta",
};

export const ETIQUETA_ESTADO_PROPIEDAD: Record<E["estado_propiedad"], string> = {
  borrador: "Borrador",
  disponible: "Disponible",
  apartada: "Apartada",
  vendida: "Vendida",
  rentada: "Rentada",
  inactiva: "Inactiva",
};

/** Convierte un Record de etiquetas en opciones para <select>. */
export function opciones<K extends string>(etiquetas: Record<K, string>) {
  return (Object.entries(etiquetas) as [K, string][]).map(([valor, etiqueta]) => ({ valor, etiqueta }));
}
