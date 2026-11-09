import type { Database } from "@/lib/supabase/database.types";

type E = Database["public"]["Enums"];

/** Lo que sabemos del prospecto (lo extrae el agente o lo captura el asesor). */
export type DatosScoring = {
  operacion: E["operacion_propiedad"] | null;
  tipoPropiedad: E["tipo_propiedad"] | null;
  zonaConocida: boolean;
  presupuestoMin: number | null;
  presupuestoMax: number | null;
  formaPago: E["forma_pago"] | null;
  creditoPreaprobado: boolean | null;
  urgencia: E["urgencia_lead"] | null;
  /** Propiedades del catálogo que coinciden con lo que busca. */
  coincidencias: number;
  /** Pidió o aceptó visitar una propiedad. */
  quiereVisitar: boolean;
  /** Contestó al menos un mensaje. */
  respondio: boolean;
};

export type ResultadoScoring = {
  score: E["score_lead"];
  puntos: number;
  motivo: string;
  faltantes: string[];
};

export const UMBRAL_CALIENTE = 65;
export const UMBRAL_TIBIO = 35;

const PUNTOS_URGENCIA: Record<E["urgencia_lead"], number> = {
  menos_1_mes: 30,
  uno_a_tres_meses: 22,
  tres_a_seis_meses: 10,
  mas_de_seis_meses: 3,
  sin_definir: 0,
};

const TEXTO_URGENCIA: Record<E["urgencia_lead"], string | null> = {
  menos_1_mes: "quiere mudarse en menos de 1 mes",
  uno_a_tres_meses: "quiere mudarse en 1 a 3 meses",
  tres_a_seis_meses: "piensa mudarse en 3 a 6 meses",
  mas_de_seis_meses: "no tiene prisa (más de 6 meses)",
  sin_definir: null,
};

function puntosPago(d: DatosScoring): { puntos: number; texto: string | null } {
  if (d.operacion === "renta") {
    // En renta la forma de pago casi no distingue; pesa tener presupuesto claro.
    return d.presupuestoMax ? { puntos: 20, texto: "tiene presupuesto de renta definido" } : { puntos: 0, texto: null };
  }
  switch (d.formaPago) {
    case "contado":
      return { puntos: 25, texto: "paga de contado" };
    case "credito_bancario":
      if (d.creditoPreaprobado === true) return { puntos: 22, texto: "tiene crédito bancario preaprobado" };
      if (d.creditoPreaprobado === false) return { puntos: 14, texto: "usará crédito bancario (aún sin aprobar)" };
      return { puntos: 16, texto: "usará crédito bancario" };
    case "infonavit":
    case "fovissste": {
      const nombre = d.formaPago === "infonavit" ? "Infonavit" : "Fovissste";
      if (d.creditoPreaprobado === true) return { puntos: 20, texto: `tiene crédito ${nombre} precalificado` };
      return { puntos: 16, texto: `usará crédito ${nombre}` };
    }
    case "otro":
      return { puntos: 8, texto: "forma de pago por definir" };
    default:
      return { puntos: 0, texto: null };
  }
}

/**
 * Score determinista: mismos datos → mismo resultado. El motivo explica los
 * factores en lenguaje del asesor para que pueda confiar (o corregir) el score.
 */
export function calcularScore(d: DatosScoring): ResultadoScoring {
  const razones: string[] = [];
  const faltantes: string[] = [];
  let puntos = 0;

  if (d.urgencia) {
    puntos += PUNTOS_URGENCIA[d.urgencia];
    const t = TEXTO_URGENCIA[d.urgencia];
    if (t) razones.push(t);
  }
  if (!d.urgencia || d.urgencia === "sin_definir") faltantes.push("urgencia");

  const pago = puntosPago(d);
  puntos += pago.puntos;
  if (pago.texto) razones.push(pago.texto);
  if (d.operacion !== "renta" && !d.formaPago) faltantes.push("forma de pago");

  if (d.presupuestoMax || d.presupuestoMin) {
    if (d.operacion !== "renta") puntos += 10;
    if (d.coincidencias > 0) {
      puntos += 5;
      razones.push(`${d.coincidencias} ${d.coincidencias === 1 ? "propiedad coincide" : "propiedades coinciden"} con su presupuesto`);
    } else {
      razones.push("ninguna propiedad del catálogo coincide con su presupuesto");
    }
  } else {
    faltantes.push("presupuesto");
  }

  if (d.zonaConocida) puntos += 5;
  else faltantes.push("zona");
  if (d.tipoPropiedad) puntos += 5;
  else faltantes.push("tipo de propiedad");

  if (d.quiereVisitar) {
    puntos += 15;
    razones.unshift("quiere visitar");
  }

  puntos = Math.max(0, Math.min(100, puntos));

  let score: E["score_lead"] = puntos >= UMBRAL_CALIENTE ? "caliente" : puntos >= UMBRAL_TIBIO ? "tibio" : "frio";

  // Topes: sin respuesta o sin prisa no puede ser caliente.
  if (!d.respondio) {
    score = "frio";
    razones.unshift("no ha respondido");
  } else if (d.urgencia === "mas_de_seis_meses" && score === "caliente") {
    score = "tibio";
  }

  const motivo = razones.length
    ? capitalizar(razones.join(", "))
    : "Aún no tenemos datos para calificarlo";
  return { score, puntos, motivo: faltantes.length ? `${motivo}. Falta: ${faltantes.join(", ")}.` : `${motivo}.`, faltantes };
}

function capitalizar(t: string) {
  return t.charAt(0).toUpperCase() + t.slice(1);
}
