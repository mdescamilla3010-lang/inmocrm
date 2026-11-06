import type Anthropic from "@anthropic-ai/sdk";
import { describe, expect, it, vi } from "vitest";
import { ejecutarBucle, type ClienteModelo } from "./bucle";
import { construirHistorial, describirEstadoLead, mensajesPrevios } from "./contexto";
import { ESQUEMAS, HERRAMIENTAS } from "./herramientas";
import { construirPromptSistema, describirHorario } from "./prompt";

describe("construirPromptSistema", () => {
  const datos = {
    inmobiliaria: "Casas del Bajío",
    nombreAgente: "Sofía",
    instrucciones: "Háblales de usted. Tenemos promoción de escrituración gratis.",
    zonas: ["Juriquilla", "Zibatá"],
    horarioVisitas: "lunes a viernes de 09:00 a 19:00",
  };

  it("incluye identidad, zonas, horario e indicaciones del dueño", () => {
    const p = construirPromptSistema(datos);
    expect(p).toContain("Eres Sofía, la asistente virtual de Casas del Bajío");
    expect(p).toContain("Juriquilla, Zibatá");
    expect(p).toContain("lunes a viernes de 09:00 a 19:00");
    expect(p).toContain("# Indicaciones de Casas del Bajío\nHáblales de usted.");
  });

  it("es estable (cacheable): mismos datos → mismo texto, sin fechas", () => {
    expect(construirPromptSistema(datos)).toBe(construirPromptSistema({ ...datos }));
    expect(construirPromptSistema(datos)).not.toMatch(/20\d\d/);
  });

  it("menciona todas las herramientas y los criterios de escalamiento aprobados", () => {
    const p = construirPromptSistema({ ...datos, instrucciones: null });
    for (const h of HERRAMIENTAS) expect(p).toContain(h.name);
    for (const criterio of ["hablar con una persona", "negociar precio", "queja", "dos intentos"]) expect(p).toContain(criterio);
    expect(p).not.toContain("# Indicaciones");
  });
});

describe("describirHorario", () => {
  it("agrupa días consecutivos con el mismo horario", () => {
    expect(
      describirHorario({
        lun: ["09:00", "19:00"], mar: ["09:00", "19:00"], mie: ["09:00", "19:00"], jue: ["09:00", "19:00"], vie: ["09:00", "19:00"],
        sab: ["10:00", "14:00"], dom: null,
      }),
    ).toBe("lunes a viernes de 09:00 a 19:00; sábado de 10:00 a 14:00");
  });
  it("sin horario", () => {
    expect(describirHorario(null)).toBe("a convenir");
    expect(describirHorario({ lun: null })).toBe("a convenir");
  });
});

describe("HERRAMIENTAS", () => {
  it.each(HERRAMIENTAS.map((h) => [h.name, h] as const))("%s: strict, todo requerido y alineada con su esquema Zod", (nombre, h) => {
    expect(h.strict).toBe(true);
    const schema = h.input_schema as unknown as { properties: Record<string, unknown>; required: string[]; additionalProperties: boolean };
    expect(schema.additionalProperties).toBe(false);
    expect([...schema.required].sort()).toEqual(Object.keys(schema.properties).sort());
    const zod = ESQUEMAS[nombre as keyof typeof ESQUEMAS];
    expect(Object.keys(zod.shape).sort()).toEqual(Object.keys(schema.properties).sort());
  });

  it("Zod rechaza entradas fuera de esquema", () => {
    expect(ESQUEMAS.escalar_a_asesor.safeParse({ motivo: "aburrido", resumen: "x" }).success).toBe(false);
    expect(ESQUEMAS.enviar_fotos_propiedad.safeParse({ propiedad_id: "no-uuid" }).success).toBe(false);
  });
});

describe("construirHistorial", () => {
  const f = (direccion: "entrante" | "saliente", contenido: string, extra: object = {}) =>
    ({ direccion, autor: direccion === "entrante" ? "prospecto" : "agente", contenido, tipo: "texto", ...extra }) as const;

  it("alterna roles, junta mensajes seguidos, quita la plantilla inicial y cierra con el estado", () => {
    const h = construirHistorial(
      [
        f("saliente", "Hola Ana, gracias por tu interés", { tipo: "plantilla" }),
        f("entrante", "Hola"),
        f("entrante", "¿Sigue disponible?"),
        f("saliente", "¡Sí! ¿Buscas para comprar?"),
        f("saliente", "Te mando fotos", { autor: "asesor", nombreAsesor: "Luis" }),
        f("entrante", "Comprar, con Infonavit"),
      ],
      "ESTADO",
    );
    expect(h).toEqual([
      { role: "user", content: "Hola\n¿Sigue disponible?" },
      { role: "assistant", content: "¡Sí! ¿Buscas para comprar?\n[Mensaje de Luis] Te mando fotos" },
      { role: "user", content: "Comprar, con Infonavit" },
      { role: "system", content: "ESTADO" },
    ]);
  });

  it("null si ya contestamos (el último mensaje es nuestro) o no hay nada del prospecto", () => {
    expect(construirHistorial([f("entrante", "Hola"), f("saliente", "¡Hola!")], "E")).toBeNull();
    expect(construirHistorial([f("saliente", "Plantilla")], "E")).toBeNull();
    expect(construirHistorial([], "E")).toBeNull();
  });

  it("mensajesPrevios devuelve lo que mandamos antes de que respondiera", () => {
    expect(mensajesPrevios([f("saliente", "Plantilla"), f("entrante", "Hola"), f("saliente", "x")])).toEqual(["Plantilla"]);
  });
});

describe("describirEstadoLead", () => {
  it("lista sólo lo conocido, lo que falta y lo que ya se le envió", () => {
    const texto = describirEstadoLead(
      {
        nombre: "Ana",
        fuente: "Meta Ads",
        mensajeInicial: null,
        propiedadInteres: null,
        operacion: "venta",
        tipoPropiedad: null,
        zona: "Juriquilla",
        presupuestoMin: 2_000_000,
        presupuestoMax: 3_000_000,
        formaPago: "infonavit",
        creditoPreaprobado: true,
        urgencia: null,
        recamarasMin: null,
        interesVisita: null,
        score: "tibio",
        faltantes: ["urgencia", "tipo de propiedad"],
        asesor: "Luis",
        previos: ["Hola Ana, gracias por tu interés"],
      },
      "sábado 8 de noviembre, 10:15",
    );
    expect(texto).toBe(
      [
        "Hora local: sábado 8 de noviembre, 10:15.",
        "Estado del lead (actualizado):",
        "- Nombre: Ana",
        "- Llegó por: Meta Ads",
        "- Operación: venta",
        "- Zona: Juriquilla",
        "- Presupuesto: $2,000,000 a $3,000,000",
        "- Forma de pago: infonavit (preaprobado)",
        "- Score actual: tibio",
        "- Asesor asignado: Luis",
        "Falta averiguar: urgencia, tipo de propiedad.",
        'Antes de que respondiera le enviamos: "Hola Ana, gracias por tu interés"',
      ].join("\n"),
    );
  });

  it("sin datos lo dice explícitamente", () => {
    const vacio = {
      nombre: null, fuente: "WhatsApp", mensajeInicial: null, propiedadInteres: null, operacion: null, tipoPropiedad: null,
      zona: null, presupuestoMin: null, presupuestoMax: null, formaPago: null, creditoPreaprobado: null, urgencia: null,
      recamarasMin: null, interesVisita: null, score: null, faltantes: [], asesor: null, previos: [],
    };
    expect(describirEstadoLead(vacio, "x")).toContain("- Llegó por: WhatsApp");
  });
});

describe("ejecutarBucle", () => {
  const texto = (t: string): Anthropic.Beta.BetaContentBlock => ({ type: "text", text: t, citations: null }) as Anthropic.Beta.BetaContentBlock;
  const uso = (id: string, name: string, input: unknown): Anthropic.Beta.BetaContentBlock =>
    ({ type: "tool_use", id, name, input }) as Anthropic.Beta.BetaContentBlock;
  const base = { sistema: "S", herramientas: HERRAMIENTAS, mensajes: [{ role: "user" as const, content: "Hola" }] };

  it("ejecuta varias herramientas del mismo turno y manda sus resultados en un solo mensaje", async () => {
    const cliente = vi
      .fn<ClienteModelo>()
      .mockResolvedValueOnce({ stop_reason: "tool_use", content: [uso("t1", "guardar_calificacion", { a: 1 }), uso("t2", "buscar_propiedades", { b: 2 })] })
      .mockResolvedValueOnce({ stop_reason: "end_turn", content: [texto("Tengo 2 opciones para ti")] });
    const ejecutar = vi.fn().mockResolvedValueOnce({ contenido: "ok" }).mockResolvedValueOnce({ contenido: "[]" });

    const r = await ejecutarBucle({ ...base, cliente, ejecutar });

    expect(r).toEqual({
      texto: "Tengo 2 opciones para ti",
      fin: "respuesta",
      herramientas: [
        { nombre: "guardar_calificacion", esError: false },
        { nombre: "buscar_propiedades", esError: false },
      ],
    });
    const segunda = cliente.mock.calls[1][0].mensajes;
    expect(segunda).toHaveLength(3);
    expect(segunda[2]).toEqual({
      role: "user",
      content: [
        { type: "tool_result", tool_use_id: "t1", content: "ok" },
        { type: "tool_result", tool_use_id: "t2", content: "[]" },
      ],
    });
  });

  it("si la herramienta truena, el modelo recibe is_error y el bucle sigue", async () => {
    const cliente = vi
      .fn<ClienteModelo>()
      .mockResolvedValueOnce({ stop_reason: "tool_use", content: [uso("t1", "enviar_fotos_propiedad", {})] })
      .mockResolvedValueOnce({ stop_reason: "end_turn", content: [texto("Perdón, no pude enviar las fotos")] });
    const r = await ejecutarBucle({ ...base, cliente, ejecutar: vi.fn().mockRejectedValue(new Error("sin fotos")) });
    expect(r.herramientas).toEqual([{ nombre: "enviar_fotos_propiedad", esError: true }]);
    expect(cliente.mock.calls[1][0].mensajes.at(-1)).toEqual({
      role: "user",
      content: [{ type: "tool_result", tool_use_id: "t1", content: "Error al ejecutar enviar_fotos_propiedad: sin fotos", is_error: true }],
    });
  });

  it("reporta rechazos sin texto", async () => {
    const cliente = vi.fn<ClienteModelo>().mockResolvedValue({ stop_reason: "refusal", content: [] });
    expect((await ejecutarBucle({ ...base, cliente, ejecutar: vi.fn() })).fin).toBe("rechazo");
  });

  it("corta si el modelo se queda pidiendo herramientas", async () => {
    const cliente = vi.fn<ClienteModelo>().mockResolvedValue({ stop_reason: "tool_use", content: [uso("t", "buscar_propiedades", {})] });
    const r = await ejecutarBucle({ ...base, cliente, ejecutar: vi.fn().mockResolvedValue({ contenido: "[]" }), maxIteraciones: 3 });
    expect(r.fin).toBe("max_iteraciones");
    expect(cliente).toHaveBeenCalledTimes(3);
  });

  it("no modifica el arreglo de mensajes original", async () => {
    const mensajes = [{ role: "user" as const, content: "Hola" }];
    const cliente = vi.fn<ClienteModelo>().mockResolvedValue({ stop_reason: "end_turn", content: [texto("¡Hola!")] });
    await ejecutarBucle({ ...base, mensajes, cliente, ejecutar: vi.fn() });
    expect(mensajes).toHaveLength(1);
  });
});
