import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { resolverZona } from "@/lib/asignacion/zonas";
import { agendarCita, cancelarCita, citasProximasDelLead, disponibilidadAsesor } from "@/lib/calendario/agenda";
import { describirHorarioCita, elegirOpciones } from "@/lib/calendario/disponibilidad";
import { asignarAsesorSiFalta } from "@/lib/leads/captura";
import { cancelarSeguimientos, enviarYGuardar } from "@/lib/conversaciones/servicio";
import { envPublico } from "@/lib/env";
import { formatearPesos } from "@/lib/formato";
import {
  ETIQUETA_FORMA_PAGO,
  ETIQUETA_FUENTE,
  ETIQUETA_OPERACION,
  ETIQUETA_SCORE,
  ETIQUETA_TIPO_PROPIEDAD,
  ETIQUETA_URGENCIA,
} from "@/lib/leads/etiquetas";
import { cargarCanal, type Canal } from "@/lib/mensajeria/canal";
import { dentroDeVentana } from "@/lib/mensajeria/tipos";
import { urlPublicaFoto } from "@/lib/propiedades/fotos";
import { calcularScore } from "@/lib/scoring/scoring";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import type { Database } from "@/lib/supabase/database.types";
import { ejecutarBucle, type EjecutorHerramienta } from "./bucle";
import { construirHistorial, describirEstadoLead, mensajesPrevios } from "./contexto";
import { ESQUEMAS, esHerramienta, HERRAMIENTAS } from "./herramientas";
import { crearClienteModelo } from "./modelo";
import { construirPromptSistema, describirHorario } from "./prompt";
import { recomendarPropiedades, type PropiedadCatalogo } from "./recomendador";

type Admin = SupabaseClient<Database>;
type Lead = Database["public"]["Tables"]["leads"]["Row"];

const SEGUNDOS_TURNO = 120;
const MAX_RONDAS = 3;
const RESPUESTA_DE_RESPALDO = "¡Gracias por escribirnos! En un momento uno de nuestros asesores te contesta por aquí.";

/**
 * Responde lo pendiente de una conversación. Sólo un proceso a la vez por
 * conversación (reclamo atómico); al terminar revisa si llegaron mensajes
 * nuevos mientras contestaba.
 */
export async function responderConversacion(inmobiliariaId: string, conversacionId: string): Promise<void> {
  const admin = crearClienteAdmin();
  for (let ronda = 0; ronda < MAX_RONDAS; ronda++) {
    const { data: reclamado } = await admin.rpc("reclamar_turno_agente", {
      p_conversacion_id: conversacionId,
      p_segundos: SEGUNDOS_TURNO,
    });
    if (!reclamado) return; // otro proceso está contestando y revisará al terminar
    try {
      const resultado = await turno(admin, inmobiliariaId, conversacionId);
      if (resultado !== "respondido") return;
    } finally {
      await admin.rpc("liberar_turno_agente", { p_conversacion_id: conversacionId });
    }
  }
}

async function turno(admin: Admin, inmobiliariaId: string, conversacionId: string): Promise<"respondido" | "nada" | "omitido"> {
  const { data: conversacion } = await admin
    .from("conversaciones")
    .select("id, lead_id, ia_activa, ultimo_entrante_en")
    .eq("inmobiliaria_id", inmobiliariaId)
    .eq("id", conversacionId)
    .single();
  if (!conversacion?.ia_activa || !dentroDeVentana(conversacion.ultimo_entrante_en)) return "omitido";

  const [{ data: lead }, { data: inmo }, { data: zonas }, { data: equipo }, { data: filas }, canal] = await Promise.all([
    admin.from("leads").select("*").eq("inmobiliaria_id", inmobiliariaId).eq("id", conversacion.lead_id).single(),
    admin.from("inmobiliarias").select("nombre, agente_nombre, agente_instrucciones, zona_horaria, horario_visitas").eq("id", inmobiliariaId).single(),
    admin.from("zonas").select("id, nombre, alias").eq("inmobiliaria_id", inmobiliariaId).order("nombre"),
    admin.from("usuarios").select("id, nombre, telefono").eq("inmobiliaria_id", inmobiliariaId),
    admin
      .from("mensajes")
      .select("direccion, autor, contenido, tipo, asesor_id, creado_en")
      .eq("inmobiliaria_id", inmobiliariaId)
      .eq("conversacion_id", conversacionId)
      .order("creado_en", { ascending: false })
      .limit(40),
    cargarCanal(admin, { inmobiliariaId }),
  ]);
  if (!lead || !inmo || !canal || lead.opt_out || !lead.telefono) return "omitido";

  const nombres = new Map((equipo ?? []).map((u) => [u.id, u.nombre]));
  const historialDb = (filas ?? []).reverse().map((f) => ({ ...f, nombreAsesor: f.asesor_id ? nombres.get(f.asesor_id) : null }));
  const ctx: Contexto = {
    admin,
    canal,
    inmobiliariaId,
    conversacionId,
    lead,
    zonaHoraria: inmo.zona_horaria,
    zonas: zonas ?? [],
    equipo: equipo ?? [],
    escalado: false,
  };

  const estado = await estadoParaAgente(ctx, historialDb);
  const historial = construirHistorial(historialDb, describirEstadoLead(estado, horaLocal(inmo.zona_horaria)));
  if (!historial) return "nada";

  const resultado = await ejecutarBucle({
    cliente: crearClienteModelo(),
    sistema: construirPromptSistema({
      inmobiliaria: inmo.nombre,
      nombreAgente: inmo.agente_nombre,
      instrucciones: inmo.agente_instrucciones,
      zonas: (zonas ?? []).map((z) => z.nombre),
      horarioVisitas: describirHorario(inmo.horario_visitas),
    }),
    herramientas: HERRAMIENTAS,
    mensajes: historial,
    ejecutar: crearEjecutor(ctx),
  });

  let texto = resultado.texto;
  if (resultado.fin !== "respuesta" || !texto) {
    // Rechazo, bucle sin fin o respuesta vacía: no dejar al prospecto sin contestar.
    if (!ctx.escalado) await escalar(ctx, "otro", `El agente no pudo responder (${resultado.fin}).`);
    texto = texto || RESPUESTA_DE_RESPALDO;
  }

  await enviarYGuardar(admin, canal, {
    conversacionId,
    leadId: lead.id,
    telefono: lead.telefono,
    autor: "agente",
    metadatos: { herramientas: resultado.herramientas, fin: resultado.fin },
    envio: { tipo: "texto", texto },
  });
  return "respondido";
}

type Contexto = {
  admin: Admin;
  canal: Canal;
  inmobiliariaId: string;
  conversacionId: string;
  lead: Lead;
  zonas: { id: string; nombre: string; alias: string[] }[];
  equipo: { id: string; nombre: string; telefono: string | null }[];
  zonaHoraria: string;
  escalado: boolean;
};

function horaLocal(zonaHoraria: string) {
  return new Intl.DateTimeFormat("es-MX", { dateStyle: "full", timeStyle: "short", timeZone: zonaHoraria }).format(new Date());
}

async function estadoParaAgente(ctx: Contexto, historial: Parameters<typeof mensajesPrevios>[0]) {
  const l = ctx.lead;
  let propiedadInteres: string | null = null;
  if (l.propiedad_interes_id) {
    const { data } = await ctx.admin
      .from("propiedades")
      .select("id, titulo, precio, moneda")
      .eq("inmobiliaria_id", ctx.inmobiliariaId)
      .eq("id", l.propiedad_interes_id)
      .maybeSingle();
    if (data) propiedadInteres = `${data.titulo} (${formatearPesos(data.precio, data.moneda)}, id ${data.id})`;
  }
  const score = puntuar(l, 0);
  return {
    nombre: l.nombre,
    fuente: ETIQUETA_FUENTE[l.fuente],
    mensajeInicial: l.mensaje_inicial,
    propiedadInteres,
    operacion: l.operacion_interes ? ETIQUETA_OPERACION[l.operacion_interes] : null,
    tipoPropiedad: l.tipo_propiedad_interes ? ETIQUETA_TIPO_PROPIEDAD[l.tipo_propiedad_interes] : null,
    zona: ctx.zonas.find((z) => z.id === l.zona_id)?.nombre ?? l.zona_interes,
    presupuestoMin: l.presupuesto_min,
    presupuestoMax: l.presupuesto_max,
    formaPago: l.forma_pago ? ETIQUETA_FORMA_PAGO[l.forma_pago] : null,
    creditoPreaprobado: l.credito_preaprobado,
    urgencia: l.urgencia ? ETIQUETA_URGENCIA[l.urgencia] : null,
    recamarasMin: l.recamaras_min,
    interesVisita: l.interes_visita,
    citas: await citasProximasDelLead(ctx.admin, ctx.inmobiliariaId, l.id, ctx.zonaHoraria),
    score: l.score ? ETIQUETA_SCORE[l.score] : null,
    faltantes: score.faltantes,
    asesor: ctx.equipo.find((u) => u.id === l.asesor_id)?.nombre ?? null,
    previos: mensajesPrevios(historial),
  };
}

function puntuar(l: Lead, coincidencias: number) {
  return calcularScore({
    operacion: l.operacion_interes,
    tipoPropiedad: l.tipo_propiedad_interes,
    zonaConocida: Boolean(l.zona_id || l.zona_interes),
    presupuestoMin: l.presupuesto_min,
    presupuestoMax: l.presupuesto_max,
    formaPago: l.forma_pago,
    creditoPreaprobado: l.credito_preaprobado,
    urgencia: l.urgencia,
    coincidencias,
    quiereVisitar: Boolean(l.interes_visita) || l.estado === "cita_agendada" || l.estado === "visita_realizada",
    respondio: true,
  });
}

async function cargarCatalogo(ctx: Contexto): Promise<PropiedadCatalogo[]> {
  const { data } = await ctx.admin
    .from("propiedades")
    .select(
      "id, titulo, clave, tipo, operacion, estado, precio, moneda, zona_id, colonia, recamaras, banos, m2_construccion, acepta_credito_bancario, acepta_infonavit, acepta_fovissste, zona:zonas(nombre), fotos:propiedad_fotos(id)",
    )
    .eq("inmobiliaria_id", ctx.inmobiliariaId)
    .eq("estado", "disponible")
    .limit(500);
  return (data ?? []).map((p) => ({
    id: p.id,
    titulo: p.titulo,
    clave: p.clave,
    tipo: p.tipo,
    operacion: p.operacion,
    estado: p.estado,
    precio: p.precio,
    moneda: p.moneda,
    zonaId: p.zona_id,
    zonaNombre: p.zona?.nombre ?? null,
    colonia: p.colonia,
    recamaras: p.recamaras,
    banos: p.banos,
    m2Construccion: p.m2_construccion,
    aceptaCreditoBancario: p.acepta_credito_bancario,
    aceptaInfonavit: p.acepta_infonavit,
    aceptaFovissste: p.acepta_fovissste,
    fotos: p.fotos.length,
  }));
}

/** Recalcula y guarda el score con los datos actuales del lead. */
async function actualizarScore(ctx: Contexto) {
  const l = ctx.lead;
  const catalogo = await cargarCatalogo(ctx);
  const coincidencias = recomendarPropiedades(
    catalogo,
    {
      operacion: l.operacion_interes,
      tipo: l.tipo_propiedad_interes,
      zonaId: l.zona_id,
      presupuestoMin: l.presupuesto_min,
      presupuestoMax: l.presupuesto_max,
      recamarasMin: l.recamaras_min,
      formaPago: l.forma_pago,
    },
    50,
  ).length;
  const r = puntuar(l, coincidencias);
  const cambios: Database["public"]["Tables"]["leads"]["Update"] = {
    score: r.score,
    score_puntos: r.puntos,
    score_motivo: r.motivo,
    score_actualizado_en: new Date().toISOString(),
  };
  if (r.faltantes.length <= 1 && (l.estado === "nuevo" || l.estado === "en_conversacion")) cambios.estado = "calificado";
  await guardarLead(ctx, cambios);
  return r;
}

async function guardarLead(ctx: Contexto, cambios: Database["public"]["Tables"]["leads"]["Update"]) {
  const { data } = await ctx.admin
    .from("leads")
    .update(cambios)
    .eq("inmobiliaria_id", ctx.inmobiliariaId)
    .eq("id", ctx.lead.id)
    .select("*")
    .single();
  if (data) ctx.lead = data;
}

async function escalar(ctx: Contexto, motivo: string, resumen: string) {
  ctx.escalado = true;
  await ctx.admin
    .from("conversaciones")
    .update({ ia_activa: false, requiere_atencion: true, motivo_escalamiento: motivo, escalada_en: new Date().toISOString(), resumen })
    .eq("inmobiliaria_id", ctx.inmobiliariaId)
    .eq("id", ctx.conversacionId);
  await avisarAsesor(ctx, motivo);
}

const TEXTO_MOTIVO: Record<string, string> = {
  pide_humano: "pidió hablar con una persona",
  negociacion: "quiere negociar",
  queja: "tiene una queja",
  no_entiende: "el agente no logró entenderle",
  pregunta_especializada: "tiene una pregunta especializada",
  visita: "quiere agendar una visita",
  otro: "necesita atención",
};

/** Aviso por WhatsApp al asesor (plantilla aprobada; él no nos escribe primero). */
async function avisarAsesor(ctx: Contexto, motivo: string) {
  const plantilla = ctx.canal.config.plantilla_aviso_asesor;
  const asesor = ctx.equipo.find((u) => u.id === ctx.lead.asesor_id);
  if (!plantilla || !asesor?.telefono) return;
  try {
    await ctx.canal.proveedor.enviarPlantilla(asesor.telefono, {
      nombre: plantilla,
      idioma: ctx.canal.config.idioma,
      parametros: [ctx.lead.nombre ?? ctx.lead.telefono ?? "Un prospecto", TEXTO_MOTIVO[motivo] ?? motivo],
    });
  } catch (e) {
    console.error("[agente] no se pudo avisar al asesor", e);
  }
}

function crearEjecutor(ctx: Contexto): EjecutorHerramienta {
  return async (nombre, entrada) => {
    if (!esHerramienta(nombre)) return { contenido: `Herramienta desconocida: ${nombre}`, esError: true };
    const v = ESQUEMAS[nombre].safeParse(entrada);
    if (!v.success) return { contenido: `Entrada inválida: ${v.error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ")}`, esError: true };

    switch (nombre) {
      case "guardar_calificacion": {
        const d = ESQUEMAS.guardar_calificacion.parse(entrada);
        const cambios: Database["public"]["Tables"]["leads"]["Update"] = {};
        if (d.nombre) cambios.nombre = d.nombre;
        if (d.operacion) cambios.operacion_interes = d.operacion;
        if (d.tipo_propiedad) cambios.tipo_propiedad_interes = d.tipo_propiedad;
        if (d.zona) {
          cambios.zona_interes = d.zona;
          cambios.zona_id = resolverZona(d.zona, ctx.zonas) ?? ctx.lead.zona_id;
        }
        if (d.presupuesto_min !== null) cambios.presupuesto_min = d.presupuesto_min;
        if (d.presupuesto_max !== null) cambios.presupuesto_max = d.presupuesto_max;
        if (d.forma_pago) cambios.forma_pago = d.forma_pago;
        if (d.credito_preaprobado !== null) cambios.credito_preaprobado = d.credito_preaprobado;
        if (d.urgencia) cambios.urgencia = d.urgencia;
        if (d.recamaras_min !== null) cambios.recamaras_min = d.recamaras_min;
        if (d.notas) cambios.notas_calificacion = [ctx.lead.notas_calificacion, d.notas].filter(Boolean).join("\n");
        // Si dio un mínimo mayor al máximo guardado, el mínimo manda.
        const min = cambios.presupuesto_min ?? ctx.lead.presupuesto_min;
        const max = cambios.presupuesto_max ?? ctx.lead.presupuesto_max;
        if (min !== null && max !== null && min > max) cambios.presupuesto_max = null;

        await guardarLead(ctx, cambios);
        const r = await actualizarScore(ctx);
        return {
          contenido: JSON.stringify({
            guardado: true,
            score: r.score,
            faltan: r.faltantes,
            zona_reconocida: ctx.zonas.find((z) => z.id === ctx.lead.zona_id)?.nombre ?? null,
          }),
        };
      }

      case "buscar_propiedades": {
        const d = ESQUEMAS.buscar_propiedades.parse(entrada);
        const catalogo = await cargarCatalogo(ctx);
        const recomendaciones = recomendarPropiedades(catalogo, {
          operacion: d.operacion,
          tipo: d.tipo_propiedad,
          zonaId: d.zona ? resolverZona(d.zona, ctx.zonas) : ctx.lead.zona_id,
          presupuestoMin: d.presupuesto_min,
          presupuestoMax: d.presupuesto_max,
          recamarasMin: d.recamaras_min,
          formaPago: d.forma_pago,
        });
        return {
          contenido: JSON.stringify({
            total: recomendaciones.length,
            propiedades: recomendaciones.map(({ propiedad: p, razones }) => ({
              id: p.id,
              titulo: p.titulo,
              precio: `${formatearPesos(p.precio, p.moneda)}${p.operacion === "renta" ? " al mes" : ""}`,
              tipo: ETIQUETA_TIPO_PROPIEDAD[p.tipo],
              zona: p.zonaNombre ?? p.colonia,
              recamaras: p.recamaras,
              banos: p.banos,
              m2_construccion: p.m2Construccion,
              acepta: [p.aceptaCreditoBancario && "crédito bancario", p.aceptaInfonavit && "Infonavit", p.aceptaFovissste && "Fovissste"].filter(Boolean),
              fotos: p.fotos,
              por_que: razones,
            })),
          }),
        };
      }

      case "enviar_fotos_propiedad": {
        const { propiedad_id } = ESQUEMAS.enviar_fotos_propiedad.parse(entrada);
        const [{ data: propiedad }, { data: fotos }] = await Promise.all([
          ctx.admin.from("propiedades").select("id, titulo").eq("inmobiliaria_id", ctx.inmobiliariaId).eq("id", propiedad_id).maybeSingle(),
          ctx.admin
            .from("propiedad_fotos")
            .select("ruta_storage, es_portada, orden")
            .eq("inmobiliaria_id", ctx.inmobiliariaId)
            .eq("propiedad_id", propiedad_id)
            .order("es_portada", { ascending: false })
            .order("orden")
            .limit(3),
        ]);
        if (!propiedad) return { contenido: "Esa propiedad no existe en el catálogo.", esError: true };
        if (!fotos?.length) return { contenido: "Esa propiedad no tiene fotos cargadas." };
        const base = envPublico().NEXT_PUBLIC_SUPABASE_URL;
        let enviadas = 0;
        for (const [i, f] of fotos.entries()) {
          enviadas += await enviarYGuardar(ctx.admin, ctx.canal, {
            conversacionId: ctx.conversacionId,
            leadId: ctx.lead.id,
            telefono: ctx.lead.telefono!,
            autor: "agente",
            metadatos: { propiedad_id },
            envio: { tipo: "imagen", url: urlPublicaFoto(base, f.ruta_storage), pie: i === 0 ? propiedad.titulo : undefined },
          });
        }
        return { contenido: `Se enviaron ${enviadas} de ${fotos.length} fotos de ${propiedad.titulo}.` };
      }

      case "ofrecer_horarios": {
        const d = ESQUEMAS.ofrecer_horarios.parse(entrada);
        const asesorId = await asignarAsesorSiFalta(ctx.admin, ctx.inmobiliariaId, ctx.lead.id);
        if (!asesorId) return { contenido: "No hay asesores disponibles para agendar. Usa registrar_interes_visita.", esError: true };
        let disp;
        try {
          disp = await disponibilidadAsesor(ctx.admin, ctx.inmobiliariaId, asesorId);
        } catch (e) {
          console.error("[agente] no se pudo leer la agenda", e);
          return { contenido: "No pude consultar la agenda en este momento. Usa registrar_interes_visita.", esError: true };
        }
        const zh = disp.config.zonaHoraria;
        const formatear = (o: { inicio: Date }) => ({ inicio: o.inicio.toISOString(), texto: describirHorarioCita(o.inicio, zh) });
        const pedidas = elegirOpciones(disp.libres, { zonaHoraria: zh, fecha: d.fecha, franja: d.franja });
        const alternativas = pedidas.length ? [] : elegirOpciones(disp.libres, { zonaHoraria: zh, max: 3 });
        return {
          contenido: JSON.stringify({
            asesor: ctx.equipo.find((u) => u.id === asesorId)?.nombre ?? null,
            duracion_min: disp.config.duracionMin,
            opciones: pedidas.map(formatear),
            ...(pedidas.length ? {} : { nota: "No hay horarios con esa fecha o franja; estas son las más próximas.", alternativas: alternativas.map(formatear) }),
          }),
        };
      }

      case "agendar_cita": {
        const d = ESQUEMAS.agendar_cita.parse(entrada);
        const asesorId = await asignarAsesorSiFalta(ctx.admin, ctx.inmobiliariaId, ctx.lead.id);
        if (!asesorId) return { contenido: "No hay asesores disponibles para agendar.", esError: true };
        let r;
        try {
          r = await agendarCita(ctx.admin, {
            inmobiliariaId: ctx.inmobiliariaId,
            leadId: ctx.lead.id,
            asesorId,
            inicio: new Date(d.inicio),
            propiedadId: d.propiedad_id,
            origen: "agente",
            validarDisponibilidad: true,
          });
        } catch (e) {
          console.error("[agente] error al agendar", e);
          return { contenido: "No pude agendar en este momento. Usa registrar_interes_visita.", esError: true };
        }
        if (!r.ok) return { contenido: `${r.mensaje} Ofrécele otros horarios con ofrecer_horarios.`, esError: true };
        const { data: lead } = await ctx.admin.from("leads").select("*").eq("inmobiliaria_id", ctx.inmobiliariaId).eq("id", ctx.lead.id).single();
        if (lead) ctx.lead = lead;
        await actualizarScore(ctx);
        return {
          contenido: JSON.stringify({
            agendada: true,
            cita_id: r.citaId,
            cuando: r.texto,
            direccion: r.direccion,
            nota: r.direccion ? undefined : "No hay dirección registrada; dile que su asesor se la confirma.",
          }),
        };
      }

      case "confirmar_cita": {
        const d = ESQUEMAS.confirmar_cita.parse(entrada);
        const { data: cita } = await ctx.admin
          .from("citas")
          .update({ estado: "confirmada" })
          .eq("inmobiliaria_id", ctx.inmobiliariaId)
          .eq("lead_id", ctx.lead.id)
          .eq("id", d.cita_id)
          .in("estado", ["programada", "confirmada"])
          .select("id")
          .maybeSingle();
        return cita ? { contenido: "Visita confirmada." } : { contenido: "Esa cita no está activa para este prospecto.", esError: true };
      }

      case "cancelar_cita": {
        const d = ESQUEMAS.cancelar_cita.parse(entrada);
        // Sólo citas de este lead.
        const { data: cita } = await ctx.admin
          .from("citas")
          .select("id")
          .eq("inmobiliaria_id", ctx.inmobiliariaId)
          .eq("lead_id", ctx.lead.id)
          .eq("id", d.cita_id)
          .maybeSingle();
        if (!cita) return { contenido: "Esa cita no existe para este prospecto.", esError: true };
        const cancelada = await cancelarCita(ctx.admin, { inmobiliariaId: ctx.inmobiliariaId, citaId: cita.id, motivo: d.motivo });
        return { contenido: cancelada ? "Cita cancelada." : "Esa cita ya no estaba activa." };
      }

      case "registrar_interes_visita": {
        const d = ESQUEMAS.registrar_interes_visita.parse(entrada);
        const cambios: Database["public"]["Tables"]["leads"]["Update"] = { interes_visita: d.disponibilidad };
        if (d.propiedad_id) {
          const { data: p } = await ctx.admin
            .from("propiedades")
            .select("id")
            .eq("inmobiliaria_id", ctx.inmobiliariaId)
            .eq("id", d.propiedad_id)
            .maybeSingle();
          if (p) cambios.propiedad_interes_id = p.id;
        }
        await guardarLead(ctx, cambios);
        await actualizarScore(ctx);
        // La IA sigue atendiendo; el asesor sólo debe confirmar la cita (fase 4: agenda automática).
        await ctx.admin
          .from("conversaciones")
          .update({ requiere_atencion: true, motivo_escalamiento: "visita", escalada_en: new Date().toISOString() })
          .eq("inmobiliaria_id", ctx.inmobiliariaId)
          .eq("id", ctx.conversacionId);
        await avisarAsesor(ctx, "visita");
        return { contenido: "Registrado. Dile que su asesor le confirma el horario en breve." };
      }

      case "escalar_a_asesor": {
        const d = ESQUEMAS.escalar_a_asesor.parse(entrada);
        await escalar(ctx, d.motivo, d.resumen);
        return { contenido: "Listo: un asesor tomará la conversación. Despídete diciendo que un asesor le escribe en breve." };
      }

      case "registrar_baja": {
        await guardarLead(ctx, { opt_out: true });
        await cancelarSeguimientos(ctx.admin, ctx.inmobiliariaId, ctx.lead.id);
        return { contenido: "Registrado. Despídete en una línea; no le volveremos a escribir." };
      }
    }
  };
}
