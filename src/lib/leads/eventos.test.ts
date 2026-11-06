import { describe, expect, it } from "vitest";
import { describirEvento } from "./eventos";

const nombres = { u1: "Ana", u2: "Luis", u3: "Marta" };
const ev = (tipo: string, datos: object = {}, usuario_id: string | null = null) => ({ tipo, datos, usuario_id }) as never;

describe("describirEvento", () => {
  it.each([
    [ev("capturado", { fuente: "meta_ads" }), "Llegó por Meta Ads"],
    [ev("capturado", { fuente: "manual" }, "u2"), "Llegó por Manual (capturado por Luis)"],
    [ev("recapturado", { fuente: "lamudi", reabierto: true }), "Volvió a escribir por Lamudi; se reabrió"],
    [ev("asignado", { asesor_id: "u2", descripcion: "Asignado por zona" }), "Asignado a Luis · Asignado por zona"],
    [ev("reasignado", { de: "u2", asesor_id: "u3" }, "u1"), "Reasignado de Luis a Marta por Ana"],
    [ev("estado_cambiado", { de: "nuevo", a: "calificado" }, "u2"), "Estado: Nuevo → Calificado (Luis)"],
    [ev("score_cambiado", { a: "caliente", motivo: "Contado y urgente" }), "Score: Caliente · Contado y urgente"],
    [ev("calificacion_editada", { campos: ["presupuesto_max", "forma_pago"] }, "u2"), "Luis actualizó presupuesto máximo, forma de pago"],
    [ev("nota", { texto: "Llamar el lunes" }, "u2"), "Llamar el lunes"],
    [ev("asignado", { asesor_id: "desconocido" }), "Asignado a otro asesor"],
    [ev("cita_agendada", { origen: "agente" }), "El agente agendó una visita"],
    [ev("cita_agendada", { origen: "asesor" }, "u2"), "Visita agendada por Luis"],
    [ev("cita_cancelada", { motivo: "No puede ese día" }), "Visita cancelada · No puede ese día"],
    [ev("seguimiento_enviado", { tipo: "recordatorio_24h", via: "plantilla" }), "Se envió: Recordatorio 24 h antes"],
  ])("%#", (evento, esperado) => {
    expect(describirEvento(evento, nombres)).toBe(esperado);
  });
});
