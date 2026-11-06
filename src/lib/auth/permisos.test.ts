import { describe, expect, it } from "vitest";
import { dejariaSinDueno, navegacionPara, puedeAdministrarEquipo, puedeVerReportes } from "./permisos";

describe("navegacionPara", () => {
  it("el dueño ve reportes y configuración", () => {
    const hrefs = navegacionPara("dueno").map((i) => i.href);
    expect(hrefs).toEqual(["/leads", "/citas", "/propiedades", "/reportes", "/configuracion", "/perfil"]);
  });

  it("el asesor no ve reportes ni configuración", () => {
    const hrefs = navegacionPara("asesor").map((i) => i.href);
    expect(hrefs).toEqual(["/leads", "/citas", "/propiedades", "/perfil"]);
  });
});

describe("permisos por rol", () => {
  it("sólo el dueño administra equipo y ve reportes", () => {
    expect(puedeAdministrarEquipo("dueno")).toBe(true);
    expect(puedeAdministrarEquipo("asesor")).toBe(false);
    expect(puedeVerReportes("dueno")).toBe(true);
    expect(puedeVerReportes("asesor")).toBe(false);
  });
});

describe("dejariaSinDueno", () => {
  const equipo = [
    { id: "d1", rol: "dueno" as const, activo: true },
    { id: "a1", rol: "asesor" as const, activo: true },
  ];

  it("bloquea que el único dueño se cambie a asesor", () => {
    expect(dejariaSinDueno(equipo, { id: "d1", rol: "asesor", activo: true })).toBe(true);
  });

  it("bloquea desactivar al único dueño", () => {
    expect(dejariaSinDueno(equipo, { id: "d1", rol: "dueno", activo: false })).toBe(true);
  });

  it("permite cambios cuando hay otro dueño activo", () => {
    const conDos = [...equipo, { id: "d2", rol: "dueno" as const, activo: true }];
    expect(dejariaSinDueno(conDos, { id: "d1", rol: "asesor", activo: true })).toBe(false);
  });

  it("no cuenta a un dueño inactivo como respaldo", () => {
    const conInactivo = [...equipo, { id: "d2", rol: "dueno" as const, activo: false }];
    expect(dejariaSinDueno(conInactivo, { id: "d1", rol: "asesor", activo: true })).toBe(true);
  });

  it("permite desactivar asesores", () => {
    expect(dejariaSinDueno(equipo, { id: "a1", rol: "asesor", activo: false })).toBe(false);
  });
});
