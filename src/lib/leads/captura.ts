import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { candidatosParaLead, DESCRIPCION_MOTIVO, type MotivoAsignacion } from "@/lib/asignacion/asignacion";
import { resolverZona } from "@/lib/asignacion/zonas";
import type { Database, Json } from "@/lib/supabase/database.types";
import { camposParaCompletar } from "./recaptura";

type Admin = SupabaseClient<Database>;
type Fuente = Database["public"]["Enums"]["fuente_lead"];
type Canal = "meta" | "landing" | "correo";
type Resultado = Database["public"]["Enums"]["resultado_captura"];

// Todas las funciones de este módulo usan el cliente admin (salta RLS):
// cada consulta filtra por inmobiliaria_id de forma explícita.

/**
 * Abre el registro de la captura en la bitácora. Si el mismo id externo ya se
 * procesó (Meta y los proveedores de correo reintentan), devuelve null.
 */
export async function abrirCaptura(
  admin: Admin,
  args: { inmobiliariaId: string; canal: Canal; fuente: Fuente | null; idExterno: string | null; payload: NonNullable<Json> },
): Promise<string | null> {
  const { data, error } = await admin
    .from("capturas_lead")
    .insert({
      inmobiliaria_id: args.inmobiliariaId,
      canal: args.canal,
      fuente: args.fuente,
      id_externo: args.idExterno,
      payload: args.payload,
    })
    .select("id")
    .single();
  if (error?.code === "23505") return null;
  if (error) throw new Error(`No se pudo registrar la captura: ${error.message}`);
  return data.id;
}

export async function cerrarCaptura(
  admin: Admin,
  args: {
    inmobiliariaId: string;
    capturaId: string;
    resultado: Exclude<Resultado, "procesando">;
    leadId?: string | null;
    fuente?: Fuente | null;
    detalle?: string | null;
  },
) {
  const cambios: Database["public"]["Tables"]["capturas_lead"]["Update"] = {
    resultado: args.resultado,
    lead_id: args.leadId ?? null,
    detalle: args.detalle?.slice(0, 1000) ?? null,
  };
  if (args.fuente !== undefined) cambios.fuente = args.fuente;
  await admin.from("capturas_lead").update(cambios).eq("id", args.capturaId).eq("inmobiliaria_id", args.inmobiliariaId);
}

export type LeadEntrante = {
  fuente: Fuente;
  nombre: string | null;
  telefono: string | null;
  email: string | null;
  mensajeInicial: string | null;
  /** Texto donde buscar la zona (respuesta del formulario, mensaje…). */
  textoZona: string | null;
  /** Clave/folio de la propiedad del catálogo (correos de portal, landing). */
  clavePropiedad: string | null;
  fuenteDetalle: Record<string, Json | undefined>;
  datosCrudos: Json;
};

export type ResultadoCaptura =
  | { tipo: "creado"; leadId: string; asesorId: string | null; motivo: MotivoAsignacion }
  | { tipo: "recapturado"; leadId: string };

// Un lead perdido o descartado que vuelve a escribir merece otra oportunidad.
const ESTADOS_REABRIBLES = new Set(["perdido", "descartado"]);

export async function capturarLead(admin: Admin, inmobiliariaId: string, entrada: LeadEntrante): Promise<ResultadoCaptura> {
  if (!entrada.telefono && !entrada.email) throw new Error("El lead no tiene teléfono ni correo");

  const propiedad = entrada.clavePropiedad ? await buscarPropiedadPorClave(admin, inmobiliariaId, entrada.clavePropiedad) : null;

  const existente = await buscarExistente(admin, inmobiliariaId, entrada.telefono, entrada.email);
  if (existente) return recapturar(admin, inmobiliariaId, existente, entrada, propiedad?.id ?? null);

  const zonaId = propiedad?.zona_id ?? (await resolverZonaDeTexto(admin, inmobiliariaId, entrada.textoZona ?? entrada.mensajeInicial));
  const { asesorId, motivo } = await elegirAsesor(admin, inmobiliariaId, zonaId);

  const { data, error } = await admin
    .from("leads")
    .insert({
      inmobiliaria_id: inmobiliariaId,
      nombre: entrada.nombre,
      telefono: entrada.telefono,
      email: entrada.email,
      fuente: entrada.fuente,
      fuente_detalle: limpiarJson(entrada.fuenteDetalle),
      mensaje_inicial: entrada.mensajeInicial,
      propiedad_interes_id: propiedad?.id ?? null,
      zona_interes: entrada.textoZona,
      zona_id: zonaId,
      asesor_id: asesorId,
      asignado_en: asesorId ? new Date().toISOString() : null,
      datos_crudos: entrada.datosCrudos,
    })
    .select("id")
    .single();

  if (error?.code === "23505") {
    // Otra petición creó el mismo teléfono al mismo tiempo: se trata como recaptura.
    const ganador = await buscarExistente(admin, inmobiliariaId, entrada.telefono, entrada.email);
    if (ganador) return recapturar(admin, inmobiliariaId, ganador, entrada, propiedad?.id ?? null);
  }
  if (error || !data) throw new Error(`No se pudo crear el lead: ${error?.message}`);

  // El trigger ya registró "capturado" y "asignado"; se agrega el porqué de la asignación.
  if (asesorId) {
    await admin
      .from("eventos_lead")
      .update({ datos: { asesor_id: asesorId, motivo, descripcion: DESCRIPCION_MOTIVO[motivo] } })
      .eq("inmobiliaria_id", inmobiliariaId)
      .eq("lead_id", data.id)
      .eq("tipo", "asignado");
  }

  return { tipo: "creado", leadId: data.id, asesorId, motivo };
}

type Existente = Pick<
  Database["public"]["Tables"]["leads"]["Row"],
  "id" | "nombre" | "telefono" | "email" | "propiedad_interes_id" | "zona_interes" | "estado" | "opt_out"
>;

async function buscarExistente(admin: Admin, inmobiliariaId: string, telefono: string | null, email: string | null) {
  const columnas = "id, nombre, telefono, email, propiedad_interes_id, zona_interes, estado, opt_out";
  if (telefono) {
    const { data } = await admin
      .from("leads")
      .select(columnas)
      .eq("inmobiliaria_id", inmobiliariaId)
      .eq("telefono", telefono)
      .maybeSingle();
    if (data) return data as Existente;
  }
  if (email) {
    const { data } = await admin
      .from("leads")
      .select(columnas)
      .eq("inmobiliaria_id", inmobiliariaId)
      .ilike("email", escaparLike(email))
      .order("creado_en")
      .limit(1);
    if (data?.[0]) return data[0] as Existente;
  }
  return null;
}

async function recapturar(
  admin: Admin,
  inmobiliariaId: string,
  existente: Existente,
  entrada: LeadEntrante,
  propiedadId: string | null,
): Promise<ResultadoCaptura> {
  const cambios: Database["public"]["Tables"]["leads"]["Update"] = camposParaCompletar(existente, {
    nombre: entrada.nombre,
    telefono: entrada.telefono,
    email: entrada.email,
    propiedad_interes_id: propiedadId,
    zona_interes: entrada.textoZona,
  });
  const reabierto = ESTADOS_REABRIBLES.has(existente.estado) && !existente.opt_out;
  if (reabierto) cambios.estado = "nuevo";

  if (Object.keys(cambios).length) {
    await admin.from("leads").update(cambios).eq("inmobiliaria_id", inmobiliariaId).eq("id", existente.id);
  }
  await admin.from("eventos_lead").insert({
    inmobiliaria_id: inmobiliariaId,
    lead_id: existente.id,
    tipo: "recapturado",
    datos: limpiarJson({
      fuente: entrada.fuente,
      mensaje: entrada.mensajeInicial,
      ...entrada.fuenteDetalle,
      reabierto,
    }),
  });
  return { tipo: "recapturado", leadId: existente.id };
}

async function buscarPropiedadPorClave(admin: Admin, inmobiliariaId: string, clave: string) {
  const { data } = await admin
    .from("propiedades")
    .select("id, zona_id")
    .eq("inmobiliaria_id", inmobiliariaId)
    .ilike("clave", escaparLike(clave.trim()))
    .limit(1);
  return data?.[0] ?? null;
}

async function resolverZonaDeTexto(admin: Admin, inmobiliariaId: string, texto: string | null) {
  if (!texto) return null;
  const { data } = await admin.from("zonas").select("id, nombre, alias").eq("inmobiliaria_id", inmobiliariaId);
  return resolverZona(texto, data ?? []);
}

async function elegirAsesor(
  admin: Admin,
  inmobiliariaId: string,
  zonaId: string | null,
): Promise<{ asesorId: string | null; motivo: MotivoAsignacion }> {
  const [{ data: inmo }, { data: usuarios }, { data: coberturas }] = await Promise.all([
    admin.from("inmobiliarias").select("estrategia_asignacion").eq("id", inmobiliariaId).single(),
    admin.from("usuarios").select("id, activo, recibe_leads").eq("inmobiliaria_id", inmobiliariaId),
    admin.from("asesor_zonas").select("asesor_id, zona_id").eq("inmobiliaria_id", inmobiliariaId),
  ]);

  const { candidatos, motivo } = candidatosParaLead({
    estrategia: inmo?.estrategia_asignacion ?? "round_robin",
    zonaId,
    asesores: (usuarios ?? []).map((u) => ({
      id: u.id,
      activo: u.activo,
      recibeLeads: u.recibe_leads,
      zonaIds: (coberturas ?? []).filter((c) => c.asesor_id === u.id).map((c) => c.zona_id),
    })),
  });
  if (!candidatos.length) return { asesorId: null, motivo };

  const { data: asesorId, error } = await admin.rpc("siguiente_asesor_round_robin", {
    p_inmobiliaria_id: inmobiliariaId,
    p_candidatos: candidatos,
  });
  if (error) throw new Error(`No se pudo asignar el lead: ${error.message}`);
  return { asesorId: asesorId ?? null, motivo: asesorId ? motivo : "sin_asesores" };
}

function escaparLike(texto: string) {
  return texto.replace(/[\\%_]/g, (c) => `\\${c}`);
}

function limpiarJson(obj: Record<string, Json | undefined>): { [clave: string]: Json } {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined && v !== null && v !== "")) as { [clave: string]: Json };
}
