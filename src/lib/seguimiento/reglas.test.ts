import { describe, expect, it } from "vitest";
import { decidirSeguimiento, parametrosPlantilla, siguienteReintento, textoSeguimiento, type ContextoSeguimiento } from "./reglas";

const ahora = new Date("2026-11-14T16:00:00Z");
const h = (horas: number) => new Date(ahora.getTime() + horas * 3_600_000);

const base: ContextoSeguimiento = {
  tipo: "recordatorio_24h",
  programadoPara: ahora,
  ahora,
  config: { recordatoriosActivos: true, reactivacionActiva: true },
  lead: { optOut: false, telefono: "+524421234567", score: "tibio", estado: "cita_agendada" },
  conversacion: { iaActiva: true, ultimoEntrante: h(-30) },
  cita: { estado: "programada", inicio: h(24) },
  citasActivas: 1,
  canal: { conectado: true, plantilla: "recordatorio_visita" },
};

const reactivacion: ContextoSeguimiento = {
  ...base,
  tipo: "reactivacion_3d",
  lead: { ...base.lead, score: "frio", estado: "en_conversacion" },
  cita: null,
  citasActivas: 0,
  conversacion: { iaActiva: true, ultimoEntrante: h(-72) },
  canal: { conectado: true, plantilla: "reactivacion" },
};

describe("decidirSeguimiento · recordatorios", () => {
  it("fuera de la ventana de 24 h usa la plantilla", () => {
    expect(decidirSeguimiento(base)).toEqual({ accion: "enviar", via: "plantilla" });
  });

  it("dentro de la ventana manda texto libre", () => {
    expect(decidirSeguimiento({ ...base, conversacion: { iaActiva: true, ultimoEntrante: h(-2) } })).toEqual({ accion: "enviar", via: "texto" });
  });

  it.each([
    [{ cita: { estado: "cancelada" as const, inicio: h(24) } }, "La cita ya no está activa"],
    [{ cita: { estado: "programada" as const, inicio: h(48) } }, "La cita se reprogramó"],
    [{ cita: { estado: "programada" as const, inicio: h(2) }, programadoPara: h(-22) }, "Se atrasó; queda el recordatorio de 2 h"],
    [{ tipo: "recordatorio_2h" as const, cita: { estado: "confirmada" as const, inicio: h(0.25) }, programadoPara: h(-1.75) }, "Demasiado cerca de la visita"],
    [{ cita: { estado: "programada" as const, inicio: h(-1) }, programadoPara: h(-25) }, "La visita ya pasó"],
    [{ config: { recordatoriosActivos: false, reactivacionActiva: true } }, "Los recordatorios están desactivados"],
    [{ lead: { ...base.lead, optOut: true } }, "El prospecto pidió no ser contactado"],
    [{ lead: { ...base.lead, telefono: null } }, "El lead no tiene teléfono"],
    [{ canal: { conectado: false, plantilla: null } }, "WhatsApp no está conectado"],
    [{ canal: { conectado: true, plantilla: null } }, "Fuera de la ventana de 24 h y sin plantilla aprobada configurada"],
  ])("cancela: %j", (cambio, motivo) => {
    expect(decidirSeguimiento({ ...base, ...cambio })).toEqual({ accion: "cancelar", motivo });
  });

  it("el de 2 h se envía aunque la cita esté confirmada", () => {
    expect(
      decidirSeguimiento({ ...base, tipo: "recordatorio_2h", cita: { estado: "confirmada", inicio: h(2) }, programadoPara: ahora }),
    ).toEqual({ accion: "enviar", via: "plantilla" });
  });
});

describe("decidirSeguimiento · reactivación", () => {
  it("lead frío sin respuesta: se reactiva con plantilla", () => {
    expect(decidirSeguimiento(reactivacion)).toEqual({ accion: "enviar", via: "plantilla" });
  });

  it("lead que nunca contestó (sin score ni conversación) también se reactiva", () => {
    expect(decidirSeguimiento({ ...reactivacion, lead: { ...reactivacion.lead, score: null, estado: "nuevo" }, conversacion: null })).toEqual({
      accion: "enviar",
      via: "plantilla",
    });
  });

  it.each([
    [{ lead: { ...reactivacion.lead, score: "tibio" as const } }, "No es un lead frío"],
    [{ lead: { ...reactivacion.lead, score: "caliente" as const } }, "No es un lead frío"],
    [{ lead: { ...reactivacion.lead, estado: "perdido" as const } }, "El lead ya avanzó o se cerró"],
    [{ lead: { ...reactivacion.lead, estado: "cita_agendada" as const } }, "El lead ya avanzó o se cerró"],
    [{ citasActivas: 1 }, "Tiene una visita agendada"],
    [{ conversacion: { iaActiva: false, ultimoEntrante: h(-72) } }, "Lo atiende un asesor"],
    [{ programadoPara: h(-49) }, "Venció sin enviarse"],
    [{ config: { recordatoriosActivos: true, reactivacionActiva: false } }, "La reactivación está desactivada"],
  ])("cancela: %j", (cambio, motivo) => {
    expect(decidirSeguimiento({ ...reactivacion, ...cambio })).toEqual({ accion: "cancelar", motivo });
  });
});

describe("mensajes", () => {
  const d = { nombre: "Ana María López", inmobiliaria: "Casas del Bajío", cuando: "sábado 15 de noviembre, 10:00", hora: "10:00", lugar: "Av. Juriquilla 123", asesor: "Luis" };

  it("recordatorios con día, lugar y asesor", () => {
    expect(textoSeguimiento("recordatorio_24h", d)).toBe(
      "Hola Ana 👋 Te recuerdo tu visita de mañana, sábado 15 de noviembre, 10:00 en Av. Juriquilla 123. Luis te atiende. ¿Nos confirmas que sigue en pie?",
    );
    expect(textoSeguimiento("recordatorio_2h", { ...d, lugar: null, asesor: null })).toBe("Hola Ana, nos vemos hoy a las 10:00. Si surge algo, avísanos por aquí.");
  });

  it("la última reactivación ofrece dejar de escribir", () => {
    expect(textoSeguimiento("reactivacion_15d", { nombre: null, inmobiliaria: "X" })).toContain("dejo de escribirte");
  });

  it("parámetros de plantilla", () => {
    expect(parametrosPlantilla("recordatorio_24h", d)).toEqual(["Ana", "sábado 15 de noviembre, 10:00", "Av. Juriquilla 123"]);
    expect(parametrosPlantilla("reactivacion_7d", { nombre: null, inmobiliaria: "Casas del Bajío" })).toEqual(["hola", "Casas del Bajío"]);
  });
});

describe("siguienteReintento", () => {
  it("15 y 30 minutos; al tercer intento se rinde", () => {
    expect(siguienteReintento(1, ahora)).toEqual(new Date(ahora.getTime() + 15 * 60_000));
    expect(siguienteReintento(2, ahora)).toEqual(new Date(ahora.getTime() + 30 * 60_000));
    expect(siguienteReintento(3, ahora)).toBeNull();
  });
});
