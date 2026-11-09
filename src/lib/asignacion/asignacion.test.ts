import { describe, expect, it } from "vitest";
import { candidatosParaLead, type AsesorParaAsignar } from "./asignacion";

const luis: AsesorParaAsignar = { id: "luis", activo: true, recibeLeads: true, zonaIds: ["jur", "zib"] };
const marta: AsesorParaAsignar = { id: "marta", activo: true, recibeLeads: true, zonaIds: ["centro"] };
const pedro: AsesorParaAsignar = { id: "pedro", activo: true, recibeLeads: true, zonaIds: ["jur"] };
const inactivo: AsesorParaAsignar = { id: "inactivo", activo: false, recibeLeads: true, zonaIds: ["jur"] };
const duena: AsesorParaAsignar = { id: "duena", activo: true, recibeLeads: false, zonaIds: ["jur"] };
const equipo = [luis, marta, pedro, inactivo, duena];

describe("candidatosParaLead · round robin", () => {
  it("reparte entre todos los que están activos y reciben leads", () => {
    expect(candidatosParaLead({ estrategia: "round_robin", asesores: equipo, zonaId: "jur" })).toEqual({
      candidatos: ["luis", "marta", "pedro"],
      motivo: "round_robin",
    });
  });

  it("ignora la zona aunque venga", () => {
    const r = candidatosParaLead({ estrategia: "round_robin", asesores: equipo, zonaId: "centro" });
    expect(r.candidatos).toHaveLength(3);
  });
});

describe("candidatosParaLead · por zona", () => {
  it("sólo asesores disponibles que cubren la zona", () => {
    expect(candidatosParaLead({ estrategia: "zona", asesores: equipo, zonaId: "jur" })).toEqual({
      candidatos: ["luis", "pedro"],
      motivo: "zona",
    });
  });

  it("un solo asesor en la zona se lleva el lead", () => {
    expect(candidatosParaLead({ estrategia: "zona", asesores: equipo, zonaId: "centro" }).candidatos).toEqual(["marta"]);
  });

  it("sin zona conocida usa round robin de respaldo", () => {
    expect(candidatosParaLead({ estrategia: "zona", asesores: equipo, zonaId: null })).toEqual({
      candidatos: ["luis", "marta", "pedro"],
      motivo: "respaldo_sin_zona",
    });
  });

  it("si nadie disponible cubre la zona, usa round robin de respaldo", () => {
    const soloInactivoEnJur = [marta, inactivo];
    expect(candidatosParaLead({ estrategia: "zona", asesores: soloInactivoEnJur, zonaId: "jur" })).toEqual({
      candidatos: ["marta"],
      motivo: "respaldo_zona_sin_asesor",
    });
  });

  it("zona que nadie cubre", () => {
    expect(candidatosParaLead({ estrategia: "zona", asesores: equipo, zonaId: "polanco" }).motivo).toBe(
      "respaldo_zona_sin_asesor",
    );
  });
});

describe("candidatosParaLead · sin equipo disponible", () => {
  it.each(["round_robin", "zona"] as const)("%s: nadie recibe leads", (estrategia) => {
    expect(candidatosParaLead({ estrategia, asesores: [inactivo, duena], zonaId: "jur" })).toEqual({
      candidatos: [],
      motivo: "sin_asesores",
    });
  });

  it("equipo vacío", () => {
    expect(candidatosParaLead({ estrategia: "zona", asesores: [], zonaId: null }).motivo).toBe("sin_asesores");
  });
});
