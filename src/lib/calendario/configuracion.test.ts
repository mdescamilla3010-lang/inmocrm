import { describe, expect, it } from "vitest";
import { esquemaAgendarPanel, leerConfigAgenda } from "./configuracion";

const semana = {
  abierto_lun: "on", desde_lun: "09:00", hasta_lun: "19:00",
  abierto_mar: "on", desde_mar: "09:00", hasta_mar: "19:00",
  abierto_sab: "on", desde_sab: "10:00", hasta_sab: "14:00",
  desde_dom: "10:00", hasta_dom: "14:00",
  duracionMin: "60", margenMin: "30", anticipacionHoras: "2",
};

describe("leerConfigAgenda", () => {
  it("arma el horario: días sin marcar quedan cerrados aunque traigan horas", () => {
    const r = leerConfigAgenda(semana);
    expect(r).toEqual({
      ok: true,
      datos: {
        horario: {
          lun: ["09:00", "19:00"], mar: ["09:00", "19:00"], mie: null, jue: null, vie: null, sab: ["10:00", "14:00"], dom: null,
        },
        duracionMin: 60,
        margenMin: 30,
        anticipacionMin: 120,
      },
    });
  });

  it("valida horas, orden, duración y que haya al menos un día", () => {
    const r = leerConfigAgenda({ ...semana, hasta_lun: "08:00", desde_mar: "9", hasta_sab: "10:30", duracionMin: "60" });
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.errores.lun).toMatch(/después/);
      expect(r.errores.mar).toMatch(/09:00/);
      expect(r.errores.sab).toMatch(/más corto que una visita/);
    }
    const nada = leerConfigAgenda({ duracionMin: "60", margenMin: "0", anticipacionHoras: "0" });
    expect(nada.ok).toBe(false);
    if (!nada.ok) expect(nada.errores._).toBeDefined();
  });

  it("rechaza duraciones fuera de rango", () => {
    const r = leerConfigAgenda({ ...semana, duracionMin: "5" });
    expect(r.ok === false && r.errores.duracionMin).toBe("Mínimo 15 minutos");
  });
});

describe("esquemaAgendarPanel", () => {
  it("horario libre", () => {
    expect(esquemaAgendarPanel.parse({ inicio: "2026-11-14T16:00:00.000Z", propiedadId: "" })).toEqual({
      tipo: "libre",
      inicio: new Date("2026-11-14T16:00:00.000Z"),
      propiedadId: null,
      notas: null,
    });
  });
  it("horario manual en hora local tiene prioridad", () => {
    const r = esquemaAgendarPanel.parse({ inicio: "2026-11-14T16:00:00.000Z", manual: "2026-11-20T18:30", notas: "Llega con su esposa" });
    expect(r).toMatchObject({ tipo: "manual", local: { anio: 2026, mes: 11, dia: 20, hora: 18, minuto: 30 }, notas: "Llega con su esposa" });
  });
  it("exige elegir algo", () => {
    expect(esquemaAgendarPanel.safeParse({}).success).toBe(false);
    expect(esquemaAgendarPanel.safeParse({ manual: "mañana" }).success).toBe(false);
  });
});
