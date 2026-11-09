import type { Database } from "@/lib/supabase/database.types";

type E = Database["public"]["Enums"];

export type PropiedadCatalogo = {
  id: string;
  titulo: string;
  clave: string | null;
  tipo: E["tipo_propiedad"];
  operacion: E["operacion_propiedad"];
  estado: E["estado_propiedad"];
  precio: number;
  moneda: string;
  zonaId: string | null;
  zonaNombre: string | null;
  colonia: string | null;
  recamaras: number | null;
  banos: number | null;
  m2Construccion: number | null;
  aceptaCreditoBancario: boolean;
  aceptaInfonavit: boolean;
  aceptaFovissste: boolean;
  fotos: number;
};

export type CriteriosBusqueda = {
  operacion?: E["operacion_propiedad"] | null;
  tipo?: E["tipo_propiedad"] | null;
  zonaId?: string | null;
  presupuestoMin?: number | null;
  presupuestoMax?: number | null;
  recamarasMin?: number | null;
  formaPago?: E["forma_pago"] | null;
};

export type Recomendacion = { propiedad: PropiedadCatalogo; puntaje: number; razones: string[] };

/** Margen sobre el presupuesto que todavía vale la pena ofrecer ("un poco arriba"). */
export const TOLERANCIA_PRESUPUESTO = 0.1;

function aceptaFormaPago(p: PropiedadCatalogo, forma: CriteriosBusqueda["formaPago"]): boolean {
  switch (forma) {
    case "infonavit":
      return p.aceptaInfonavit;
    case "fovissste":
      return p.aceptaFovissste;
    case "credito_bancario":
      return p.aceptaCreditoBancario;
    default:
      return true; // contado, otro o desconocida
  }
}

/**
 * Propiedades del catálogo que le sirven al prospecto, de mejor a peor.
 * Filtros duros: disponible, operación, tipo, presupuesto (+10 %), recámaras
 * y forma de pago. La zona no excluye: suma puntos, para poder ofrecer
 * alternativas cuando en su zona no hay nada.
 */
export function recomendarPropiedades(
  catalogo: readonly PropiedadCatalogo[],
  c: CriteriosBusqueda,
  limite = 3,
): Recomendacion[] {
  const tope = c.presupuestoMax ? c.presupuestoMax * (1 + TOLERANCIA_PRESUPUESTO) : null;

  const candidatas = catalogo.filter((p) => {
    if (p.estado !== "disponible") return false;
    if (c.operacion && p.operacion !== c.operacion) return false;
    if (c.tipo && p.tipo !== c.tipo) return false;
    if ((c.presupuestoMax || c.presupuestoMin) && p.moneda !== "MXN") return false;
    if (tope !== null && p.precio > tope) return false;
    if (c.recamarasMin && (p.recamaras ?? 0) < c.recamarasMin) return false;
    return aceptaFormaPago(p, c.formaPago);
  });

  return candidatas
    .map((p) => {
      const razones: string[] = [];
      let puntaje = 0;

      if (c.zonaId && p.zonaId === c.zonaId) {
        puntaje += 3;
        razones.push("en la zona que busca");
      }
      if (c.presupuestoMax) {
        if (p.precio <= c.presupuestoMax && (!c.presupuestoMin || p.precio >= c.presupuestoMin * 0.8)) {
          puntaje += 2;
          razones.push("dentro de su presupuesto");
        } else if (p.precio > c.presupuestoMax) {
          puntaje -= 1;
          razones.push("un poco arriba de su presupuesto");
        }
        // Entre más cerca del presupuesto, mejor (aprovecha lo que puede pagar).
        puntaje += Math.max(0, 1 - Math.abs(p.precio - c.presupuestoMax) / c.presupuestoMax);
      }
      if (c.recamarasMin && p.recamaras !== null && p.recamaras >= c.recamarasMin) {
        puntaje += 1;
        razones.push(`${p.recamaras} recámaras`);
      }
      if (c.formaPago === "infonavit" || c.formaPago === "fovissste") {
        razones.push(`acepta ${c.formaPago === "infonavit" ? "Infonavit" : "Fovissste"}`);
      }
      if (p.fotos > 0) puntaje += 0.5;

      return { propiedad: p, puntaje: Math.round(puntaje * 100) / 100, razones };
    })
    .sort((a, b) => b.puntaje - a.puntaje || a.propiedad.precio - b.propiedad.precio)
    .slice(0, limite);
}
