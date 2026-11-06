import { describe, expect, it } from "vitest";
import { limpiarBusqueda } from "@/lib/busqueda";
import { esquemaFiltros } from "./filtros";

describe("esquemaFiltros", () => {
  it("acepta filtros válidos", () => {
    expect(esquemaFiltros.parse({ estado: "nuevo", score: "caliente", pagina: "2" })).toMatchObject({
      estado: "nuevo",
      score: "caliente",
      pagina: 2,
    });
  });

  it("ignora valores inválidos en lugar de fallar", () => {
    expect(esquemaFiltros.parse({ estado: "inventado", asesor: "no-uuid", pagina: "-3" })).toEqual({
      estado: undefined,
      asesor: undefined,
      fuente: undefined,
      score: undefined,
      q: undefined,
      atencion: undefined,
      pagina: 1,
    });
  });
});

describe("limpiarBusqueda", () => {
  it("quita caracteres que romperían el filtro or()", () => {
    expect(limpiarBusqueda("ana),email.eq.(x")).toBe("ana email.eq. x");
    expect(limpiarBusqueda("  María  López ")).toBe("María López");
  });
});
