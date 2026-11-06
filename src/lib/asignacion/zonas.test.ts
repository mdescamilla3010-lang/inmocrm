import { describe, expect, it } from "vitest";
import { resolverZona, type Zona } from "./zonas";

const zonas: Zona[] = [
  { id: "jur", nombre: "Juriquilla", alias: ["Jurica", "Real de Juriquilla"] },
  { id: "zib", nombre: "Zibatá", alias: ["Zibata", "El Marqués"] },
  { id: "pol", nombre: "Polanco", alias: ["Polanquito", "Granada"] },
  { id: "pol5", nombre: "Polanco V Sección", alias: [] },
];

describe("resolverZona", () => {
  it.each([
    ["Busco casa en Juriquilla", "jur"],
    ["por zibata porfa", "zib"],
    ["ZIBATÁ", "zib"],
    ["algo en el marques", "zib"],
    ["Me gusta Polanquito", "pol"],
    ["depa en polanco", "pol"],
  ])("%s → %s", (texto, esperado) => {
    expect(resolverZona(texto, zonas)).toBe(esperado);
  });

  it("prefiere la mención más específica", () => {
    expect(resolverZona("Polanco V Sección", zonas)).toBe("pol5");
  });

  it("si menciona dos zonas distintas, gana la primera", () => {
    expect(resolverZona("Jurica o Zibata", zonas)).toBe("jur");
  });

  it("compara palabras completas (no 'granadas' por 'Granada')", () => {
    expect(resolverZona("me gustan las granadas", zonas)).toBeNull();
  });

  it.each([[null], [undefined], [""], ["   "], ["Cancún"]])("%s → null", (texto) => {
    expect(resolverZona(texto, zonas)).toBeNull();
  });
});
