import { describe, expect, it } from "vitest";
import { esquemaCalificacion, esquemaContacto, esquemaLeadManual } from "./esquemas";

describe("esquemaCalificacion", () => {
  it("convierte el formulario a columnas", () => {
    const r = esquemaCalificacion.parse({
      operacion_interes: "venta",
      tipo_propiedad_interes: "",
      zona_interes: " Juriquilla ",
      zona_id: "",
      presupuesto_min: "2M",
      presupuesto_max: "3,000,000",
      forma_pago: "infonavit",
      credito_preaprobado: "si",
      urgencia: "uno_a_tres_meses",
      recamaras_min: "3",
      notas_calificacion: "",
    });
    expect(r).toEqual({
      operacion_interes: "venta",
      tipo_propiedad_interes: null,
      zona_interes: "Juriquilla",
      zona_id: null,
      presupuesto_min: 2000000,
      presupuesto_max: 3000000,
      forma_pago: "infonavit",
      credito_preaprobado: true,
      urgencia: "uno_a_tres_meses",
      recamaras_min: 3,
      notas_calificacion: null,
    });
  });

  it("valida que el máximo no sea menor al mínimo", () => {
    const r = esquemaCalificacion.safeParse({ presupuesto_min: "3M", presupuesto_max: "2M" });
    expect(r.success).toBe(false);
  });

  it("rechaza montos que no se entienden y enums inventados", () => {
    expect(esquemaCalificacion.safeParse({ presupuesto_max: "mucho" }).success).toBe(false);
    expect(esquemaCalificacion.safeParse({ forma_pago: "trueque" }).success).toBe(false);
  });

  it("crédito preaprobado sin respuesta queda en null", () => {
    expect(esquemaCalificacion.parse({ credito_preaprobado: "" }).credito_preaprobado).toBeNull();
  });
});

describe("esquemaContacto / esquemaLeadManual", () => {
  it("exige teléfono o correo", () => {
    expect(esquemaContacto.safeParse({ nombre: "Ana", telefono: "", email: "" }).success).toBe(false);
  });

  it("normaliza", () => {
    expect(esquemaContacto.parse({ nombre: "", telefono: "442 123 4567", email: "" })).toEqual({
      nombre: null,
      telefono: "+524421234567",
      email: null,
    });
  });

  it("asesor vacío significa asignación automática", () => {
    const r = esquemaLeadManual.parse({ telefono: "5512345678", asesorId: "", mensaje: "" });
    expect(r.asesorId).toBeNull();
  });
});
