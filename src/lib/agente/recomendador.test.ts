import { describe, expect, it } from "vitest";
import { recomendarPropiedades, type PropiedadCatalogo } from "./recomendador";

const prop = (p: Partial<PropiedadCatalogo> & { id: string }): PropiedadCatalogo => ({
  titulo: p.id,
  clave: null,
  tipo: "casa",
  operacion: "venta",
  estado: "disponible",
  precio: 2_000_000,
  moneda: "MXN",
  zonaId: null,
  zonaNombre: null,
  colonia: null,
  recamaras: 3,
  banos: 2,
  m2Construccion: 120,
  aceptaCreditoBancario: true,
  aceptaInfonavit: false,
  aceptaFovissste: false,
  fotos: 0,
  ...p,
});

const catalogo = [
  prop({ id: "jur-2.8", zonaId: "jur", precio: 2_800_000 }),
  prop({ id: "jur-4.8", zonaId: "jur", precio: 4_800_000 }),
  prop({ id: "zib-3.1", zonaId: "zib", precio: 3_100_000, fotos: 4 }),
  prop({ id: "ref-1.9-infonavit", zonaId: "ref", precio: 1_900_000, recamaras: 2, aceptaInfonavit: true, aceptaFovissste: true }),
  prop({ id: "depa-2.6", tipo: "departamento", zonaId: "zib", precio: 2_600_000, recamaras: 2 }),
  prop({ id: "vendida", zonaId: "jur", precio: 2_900_000, estado: "vendida" }),
  prop({ id: "renta-38k", tipo: "departamento", operacion: "renta", precio: 38_000, zonaId: "pol" }),
  prop({ id: "usd", precio: 150_000, moneda: "USD" }),
];
const ids = (r: ReturnType<typeof recomendarPropiedades>) => r.map((x) => x.propiedad.id);

describe("recomendarPropiedades", () => {
  it("prioriza la zona y el presupuesto; descarta vendidas y lo que excede 10 %", () => {
    const r = recomendarPropiedades(catalogo, { operacion: "venta", tipo: "casa", zonaId: "jur", presupuestoMax: 3_000_000 });
    // Lo que cabe en el presupuesto va antes que lo que se pasa un poco.
    expect(ids(r)).toEqual(["jur-2.8", "ref-1.9-infonavit", "zib-3.1"]);
    expect(r[0].razones).toEqual(["en la zona que busca", "dentro de su presupuesto"]);
    expect(r[2].razones).toContain("un poco arriba de su presupuesto");
  });

  it("con Infonavit sólo ofrece propiedades que lo aceptan", () => {
    const r = recomendarPropiedades(catalogo, { operacion: "venta", formaPago: "infonavit", presupuestoMax: 2_000_000 });
    expect(ids(r)).toEqual(["ref-1.9-infonavit"]);
    expect(r[0].razones).toContain("acepta Infonavit");
  });

  it("filtra por recámaras mínimas", () => {
    const r = recomendarPropiedades(catalogo, { operacion: "venta", recamarasMin: 3, presupuestoMax: 3_000_000 });
    expect(ids(r)).not.toContain("depa-2.6");
    expect(ids(r)).not.toContain("ref-1.9-infonavit");
  });

  it("renta y venta no se mezclan", () => {
    expect(ids(recomendarPropiedades(catalogo, { operacion: "renta", presupuestoMax: 40_000 }))).toEqual(["renta-38k"]);
  });

  it("si en su zona no hay nada, ofrece alternativas", () => {
    const r = recomendarPropiedades(catalogo, { operacion: "venta", tipo: "departamento", zonaId: "jur", presupuestoMax: 3_000_000 });
    expect(ids(r)).toEqual(["depa-2.6"]);
    expect(r[0].razones).not.toContain("en la zona que busca");
  });

  it("con presupuesto excluye propiedades en dólares; sin presupuesto las incluye", () => {
    expect(ids(recomendarPropiedades(catalogo, { presupuestoMax: 10_000_000 }, 20))).not.toContain("usd");
    expect(ids(recomendarPropiedades(catalogo, {}, 20))).toContain("usd");
  });

  it("respeta el límite y no devuelve nada si nada coincide", () => {
    expect(recomendarPropiedades(catalogo, { operacion: "venta" }, 2)).toHaveLength(2);
    expect(recomendarPropiedades(catalogo, { operacion: "venta", presupuestoMax: 500_000 })).toEqual([]);
  });
});
