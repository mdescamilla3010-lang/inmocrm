/**
 * Chat en la terminal con el agente, sin WhatsApp ni base de datos.
 * Usa el mismo prompt, herramientas, scoring y recomendador que producción,
 * con un catálogo de ejemplo en memoria. Sirve para revisar el tono y ajustar
 * las indicaciones antes de conectarlo.
 *
 *   ANTHROPIC_API_KEY=sk-ant-... pnpm agente:probar
 *
 * Cada mensaje es una llamada real a la API (se cobra).
 */
import Anthropic from "@anthropic-ai/sdk";
import { createInterface } from "node:readline/promises";
import { stdin as input, stdout as output } from "node:process";
import { resolverZona } from "../src/lib/asignacion/zonas";
import { ejecutarBucle, type EjecutorHerramienta } from "../src/lib/agente/bucle";
import { construirHistorial, describirEstadoLead } from "../src/lib/agente/contexto";
import { ESQUEMAS, esHerramienta, HERRAMIENTAS } from "../src/lib/agente/herramientas";
import { clienteModeloCon } from "../src/lib/agente/modelo-config";
import { construirPromptSistema } from "../src/lib/agente/prompt";
import { recomendarPropiedades, type PropiedadCatalogo } from "../src/lib/agente/recomendador";
import { describirHorarioCita, elegirOpciones, esHorarioLibre, horariosLibres } from "../src/lib/calendario/disponibilidad";
import { calcularScore } from "../src/lib/scoring/scoring";

const zonas = [
  { id: "jur", nombre: "Juriquilla", alias: ["Jurica"] },
  { id: "zib", nombre: "Zibatá", alias: ["Zibata", "El Marqués"] },
  { id: "ref", nombre: "Centro Sur", alias: ["El Refugio", "Milenio III"] },
];
const p = (x: Partial<PropiedadCatalogo> & Pick<PropiedadCatalogo, "id" | "titulo" | "precio">): PropiedadCatalogo => ({
  clave: null, tipo: "casa", operacion: "venta", estado: "disponible", moneda: "MXN", zonaId: null, zonaNombre: null, colonia: null,
  recamaras: 3, banos: 2, m2Construccion: 150, aceptaCreditoBancario: true, aceptaInfonavit: false, aceptaFovissste: false, fotos: 3, ...x,
});
const catalogo = [
  p({ id: "11111111-1111-4111-8111-111111111111", titulo: "Casa en Juriquilla con jardín", precio: 4_850_000, zonaId: "jur", zonaNombre: "Juriquilla", banos: 2.5, m2Construccion: 210 }),
  p({ id: "22222222-2222-4222-8222-222222222222", titulo: "Departamento en Zibatá", tipo: "departamento", precio: 2_650_000, zonaId: "zib", zonaNombre: "Zibatá", recamaras: 2, aceptaInfonavit: true, m2Construccion: 95 }),
  p({ id: "33333333-3333-4333-8333-333333333333", titulo: "Casa Infonavit en El Refugio", precio: 1_890_000, zonaId: "ref", zonaNombre: "Centro Sur", recamaras: 2, banos: 1.5, aceptaInfonavit: true, aceptaFovissste: true, m2Construccion: 90 }),
];

type Lead = Record<string, unknown> & { faltantes: string[]; citas: { id: string; inicio: Date }[] };
const lead: Lead = { nombre: null, faltantes: [], citas: [] };
const ZONA = "America/Mexico_City";
// Agenda simulada del asesor: horario típico sin compromisos previos, salvo sus citas.
const libres = () =>
  horariosLibres({
    horario: { lun: ["09:00", "19:00"], mar: ["09:00", "19:00"], mie: ["09:00", "19:00"], jue: ["09:00", "19:00"], vie: ["09:00", "19:00"], sab: ["10:00", "14:00"], dom: null },
    zonaHoraria: ZONA, duracionMin: 60, margenMin: 30, anticipacionMin: 120, dias: 14, ahora: new Date(),
    ocupados: lead.citas.map((c) => ({ inicio: c.inicio, fin: new Date(c.inicio.getTime() + 3_600_000) })),
  });
const historial: { direccion: "entrante" | "saliente"; autor: "prospecto" | "agente"; contenido: string; tipo: string }[] = [];

function puntuar() {
  const criterios = {
    operacion: lead.operacion as never, tipo: lead.tipo_propiedad as never, zonaId: lead.zona_id as string | null,
    presupuestoMin: lead.presupuesto_min as number | null, presupuestoMax: lead.presupuesto_max as number | null,
    recamarasMin: lead.recamaras_min as number | null, formaPago: lead.forma_pago as never,
  };
  return calcularScore({
    operacion: criterios.operacion ?? null, tipoPropiedad: criterios.tipo ?? null, zonaConocida: Boolean(lead.zona),
    presupuestoMin: criterios.presupuestoMin ?? null, presupuestoMax: criterios.presupuestoMax ?? null,
    formaPago: criterios.formaPago ?? null, creditoPreaprobado: (lead.credito_preaprobado as boolean | null) ?? null,
    urgencia: (lead.urgencia as never) ?? null, coincidencias: recomendarPropiedades(catalogo, criterios, 50).length,
    quiereVisitar: Boolean(lead.interes_visita) || lead.citas.length > 0, respondio: true,
  });
}

const ejecutar: EjecutorHerramienta = async (nombre, entrada) => {
  if (!esHerramienta(nombre)) return { contenido: "Herramienta desconocida", esError: true };
  const v = ESQUEMAS[nombre].safeParse(entrada);
  if (!v.success) return { contenido: `Entrada inválida: ${v.error.message}`, esError: true };
  console.log(`\x1b[2m  ⚙ ${nombre} ${JSON.stringify(entrada)}\x1b[0m`);
  const d = v.data as Record<string, unknown>;
  switch (nombre) {
    case "guardar_calificacion": {
      for (const [k, val] of Object.entries(d)) if (val !== null) lead[k] = val;
      if (d.zona) lead.zona_id = resolverZona(String(d.zona), zonas);
      const r = puntuar();
      lead.score = r.score;
      lead.faltantes = r.faltantes;
      console.log(`\x1b[2m  → score ${r.score} (${r.puntos} pts): ${r.motivo}\x1b[0m`);
      return { contenido: JSON.stringify({ guardado: true, score: r.score, faltan: r.faltantes }) };
    }
    case "buscar_propiedades": {
      const recs = recomendarPropiedades(catalogo, {
        operacion: d.operacion as never, tipo: d.tipo_propiedad as never, zonaId: d.zona ? resolverZona(String(d.zona), zonas) : null,
        presupuestoMin: d.presupuesto_min as number | null, presupuestoMax: d.presupuesto_max as number | null,
        recamarasMin: d.recamaras_min as number | null, formaPago: d.forma_pago as never,
      });
      return { contenido: JSON.stringify(recs.map((r) => ({ id: r.propiedad.id, titulo: r.propiedad.titulo, precio: r.propiedad.precio, zona: r.propiedad.zonaNombre, recamaras: r.propiedad.recamaras, por_que: r.razones }))) };
    }
    case "ofrecer_horarios": {
      const opciones = elegirOpciones(libres(), { zonaHoraria: ZONA, fecha: d.fecha as string | null, franja: d.franja as never });
      return { contenido: JSON.stringify({ asesor: "Luis", opciones: opciones.map((o) => ({ inicio: o.inicio.toISOString(), texto: describirHorarioCita(o.inicio, ZONA) })) }) };
    }
    case "agendar_cita": {
      const inicio = new Date(String(d.inicio));
      if (!esHorarioLibre(libres(), inicio)) return { contenido: "Ese horario ya no está disponible.", esError: true };
      const id = crypto.randomUUID();
      lead.citas.push({ id, inicio });
      console.log(`\x1b[33m  📅 Cita agendada: ${describirHorarioCita(inicio, ZONA)}\x1b[0m`);
      return { contenido: JSON.stringify({ agendada: true, cita_id: id, cuando: `${describirHorarioCita(inicio, ZONA)} con Luis`, direccion: "Av. de las Ciencias 123, Juriquilla" }) };
    }
    case "confirmar_cita":
      return { contenido: lead.citas.some((c) => c.id === d.cita_id) ? "Visita confirmada." : "Esa cita no existe." };
    case "cancelar_cita":
      lead.citas = lead.citas.filter((c) => c.id !== d.cita_id);
      return { contenido: "Cita cancelada." };
    case "registrar_interes_visita":
      lead.interes_visita = d.disponibilidad;
      return { contenido: "Registrado. Dile que su asesor le confirma el horario en breve." };
    case "enviar_fotos_propiedad":
      return { contenido: "Se enviaron 3 fotos." };
    case "escalar_a_asesor":
      console.log(`\x1b[33m  ⚑ Escalado a asesor: ${d.motivo} — ${d.resumen}\x1b[0m`);
      return { contenido: "Listo: un asesor tomará la conversación. Despídete." };
    case "registrar_baja":
      return { contenido: "Registrado. Despídete en una línea." };
  }
};

async function main() {
  const anthropic = new Anthropic();
  const cliente = clienteModeloCon(anthropic, {
    modelo: process.env.ANTHROPIC_MODEL || "claude-opus-5-5",
    esfuerzo: (process.env.ANTHROPIC_EFFORT as never) || "medium",
  });
  const sistema = construirPromptSistema({
    inmobiliaria: "Casas del Bajío",
    nombreAgente: "Sofía",
    instrucciones: process.env.AGENTE_INSTRUCCIONES ?? null,
    zonas: zonas.map((z) => z.nombre),
    horarioVisitas: "lunes a viernes de 09:00 a 19:00; sábado de 10:00 a 14:00",
  });
  const rl = createInterface({ input, output });
  console.log("Escribe como si fueras el prospecto (Ctrl+C para salir).\n");
  for (;;) {
    const texto = (await rl.question("\x1b[36mTú: \x1b[0m")).trim();
    if (!texto) continue;
    historial.push({ direccion: "entrante", autor: "prospecto", contenido: texto, tipo: "texto" });
    const estado = describirEstadoLead(
      {
        nombre: (lead.nombre as string) ?? null, fuente: "WhatsApp", mensajeInicial: null, propiedadInteres: null,
        operacion: (lead.operacion as string) ?? null, tipoPropiedad: (lead.tipo_propiedad as string) ?? null, zona: (lead.zona as string) ?? null,
        presupuestoMin: (lead.presupuesto_min as number) ?? null, presupuestoMax: (lead.presupuesto_max as number) ?? null,
        formaPago: (lead.forma_pago as string) ?? null, creditoPreaprobado: (lead.credito_preaprobado as boolean) ?? null,
        urgencia: (lead.urgencia as string) ?? null, recamarasMin: (lead.recamaras_min as number) ?? null,
        interesVisita: (lead.interes_visita as string) ?? null, score: (lead.score as string) ?? null, faltantes: lead.faltantes,
        citas: lead.citas.map((c) => `${describirHorarioCita(c.inicio, ZONA)} con Luis (cita_id ${c.id})`),
        asesor: "Luis", previos: [],
      },
      new Intl.DateTimeFormat("es-MX", { dateStyle: "full", timeStyle: "short", timeZone: "America/Mexico_City" }).format(new Date()),
    );
    const mensajes = construirHistorial(historial, estado);
    if (!mensajes) continue;
    const r = await ejecutarBucle({ cliente, sistema, herramientas: HERRAMIENTAS, mensajes, ejecutar });
    const respuesta = r.texto || `(sin respuesta: ${r.fin})`;
    historial.push({ direccion: "saliente", autor: "agente", contenido: respuesta, tipo: "texto" });
    console.log(`\x1b[32mSofía:\x1b[0m ${respuesta}\n`);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
