import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { capturarLead } from "@/lib/leads/captura";
import { cargarCanal, type Canal } from "@/lib/mensajeria/canal";
import { rellenarPlantilla } from "@/lib/mensajeria/config";
import { dividirMensaje, esSolicitudDeBaja } from "@/lib/mensajeria/texto";
import type { ActualizacionEstado, MensajeEntrante, Plantilla } from "@/lib/mensajeria/tipos";
import type { Database, Json } from "@/lib/supabase/database.types";

type Admin = SupabaseClient<Database>;
type Autor = Database["public"]["Enums"]["autor_mensaje"];

// Cliente admin en todo el módulo: cada consulta filtra por inmobiliaria_id.

export async function asegurarConversacion(admin: Admin, inmobiliariaId: string, leadId: string) {
  await admin
    .from("conversaciones")
    .upsert({ inmobiliaria_id: inmobiliariaId, lead_id: leadId, canal: "whatsapp" }, { onConflict: "inmobiliaria_id,lead_id,canal", ignoreDuplicates: true });
  const { data, error } = await admin
    .from("conversaciones")
    .select("id, ia_activa, ultimo_entrante_en")
    .eq("inmobiliaria_id", inmobiliariaId)
    .eq("lead_id", leadId)
    .eq("canal", "whatsapp")
    .single();
  if (error || !data) throw new Error(`No se pudo abrir la conversación: ${error?.message}`);
  return data;
}

export type Envio =
  | { tipo: "texto"; texto: string }
  | { tipo: "imagen"; url: string; pie?: string }
  | { tipo: "plantilla"; plantilla: Plantilla; textoVisible: string };

/**
 * Envía por el canal y guarda el mensaje (también si falla, con su error, para
 * que el asesor lo vea). Devuelve cuántos envíos salieron bien.
 */
export async function enviarYGuardar(
  admin: Admin,
  canal: Canal,
  args: {
    conversacionId: string;
    leadId: string;
    telefono: string;
    autor: Exclude<Autor, "prospecto">;
    asesorId?: string;
    metadatos?: Json;
    envio: Envio;
  },
): Promise<number> {
  const partes =
    args.envio.tipo === "texto"
      ? dividirMensaje(args.envio.texto).map((t) => ({ tipo: "texto" as const, texto: t }))
      : [args.envio];
  let exitosos = 0;

  for (const parte of partes) {
    let idProveedor: string | null = null;
    let error: string | null = null;
    try {
      const r =
        parte.tipo === "texto"
          ? await canal.proveedor.enviarTexto(args.telefono, parte.texto)
          : parte.tipo === "imagen"
            ? await canal.proveedor.enviarImagen(args.telefono, parte.url, parte.pie)
            : await canal.proveedor.enviarPlantilla(args.telefono, parte.plantilla);
      idProveedor = r.idProveedor;
      exitosos++;
    } catch (e) {
      error = e instanceof Error ? e.message : String(e);
    }

    await admin.from("mensajes").insert({
      inmobiliaria_id: canal.inmobiliariaId,
      conversacion_id: args.conversacionId,
      direccion: "saliente",
      autor: args.autor,
      asesor_id: args.autor === "asesor" ? (args.asesorId ?? null) : null,
      tipo: parte.tipo,
      contenido: parte.tipo === "texto" ? parte.texto : parte.tipo === "imagen" ? (parte.pie ?? null) : parte.textoVisible,
      metadatos: parte.tipo === "imagen" ? { url: parte.url, ...(objeto(args.metadatos)) } : (args.metadatos ?? {}),
      proveedor_mensaje_id: idProveedor,
      estado: idProveedor ? "enviado" : "fallido",
      error,
    });
  }

  if (exitosos > 0) {
    const ahora = new Date().toISOString();
    await admin.from("leads").update({ ultimo_mensaje_en: ahora }).eq("inmobiliaria_id", canal.inmobiliariaId).eq("id", args.leadId);
    // Tiempo de respuesta: se marca sólo la primera vez.
    await admin
      .from("leads")
      .update({ primer_contacto_en: ahora })
      .eq("inmobiliaria_id", canal.inmobiliariaId)
      .eq("id", args.leadId)
      .is("primer_contacto_en", null);
  }
  return exitosos;
}

function objeto(j: Json | undefined): Record<string, Json | undefined> {
  return j && typeof j === "object" && !Array.isArray(j) ? j : {};
}

export type ResultadoEntrante = { conversacionId: string; leadId: string; responder: boolean } | null;

/**
 * Guarda un mensaje del prospecto. Crea el lead si es la primera vez que
 * escribe. Devuelve null si el mensaje ya se había procesado (reintento).
 */
export async function registrarEntrante(admin: Admin, canal: Canal, m: MensajeEntrante): Promise<ResultadoEntrante> {
  const inmobiliariaId = canal.inmobiliariaId;

  const { data: existente } = await admin
    .from("leads")
    .select("id, estado, opt_out")
    .eq("inmobiliaria_id", inmobiliariaId)
    .eq("telefono", m.telefono)
    .maybeSingle();

  let lead = existente;
  if (!lead) {
    const r = await capturarLead(admin, inmobiliariaId, {
      fuente: "whatsapp",
      nombre: m.nombrePerfil,
      telefono: m.telefono,
      email: null,
      mensajeInicial: m.texto,
      textoZona: m.texto,
      clavePropiedad: null,
      fuenteDetalle: {},
      datosCrudos: null,
    });
    lead = { id: r.leadId, estado: "nuevo", opt_out: false };
  }

  const conversacion = await asegurarConversacion(admin, inmobiliariaId, lead.id);
  const { error } = await admin.from("mensajes").insert({
    inmobiliaria_id: inmobiliariaId,
    conversacion_id: conversacion.id,
    direccion: "entrante",
    autor: "prospecto",
    tipo: m.tipo,
    contenido: m.texto,
    proveedor_mensaje_id: m.idProveedor,
    estado: "recibido",
    creado_en: m.recibidoEn.toISOString(),
  });
  if (error?.code === "23505") return null; // reintento del proveedor
  if (error) throw new Error(`No se pudo guardar el mensaje: ${error.message}`);

  const recibido = m.recibidoEn.toISOString();
  await admin.from("conversaciones").update({ ultimo_entrante_en: recibido }).eq("id", conversacion.id).eq("inmobiliaria_id", inmobiliariaId);

  const baja = esSolicitudDeBaja(m.texto);
  const cambios: Database["public"]["Tables"]["leads"]["Update"] = { ultimo_mensaje_en: recibido };
  if (lead.estado === "nuevo") cambios.estado = "en_conversacion";
  if (baja) cambios.opt_out = true;
  // Si alguien que pidió la baja vuelve a escribir por su cuenta, retoma la conversación.
  else if (lead.opt_out) cambios.opt_out = false;
  await admin.from("leads").update(cambios).eq("inmobiliaria_id", inmobiliariaId).eq("id", lead.id);

  if (baja) {
    await cancelarSeguimientos(admin, inmobiliariaId, lead.id);
    await enviarYGuardar(admin, canal, {
      conversacionId: conversacion.id,
      leadId: lead.id,
      telefono: m.telefono,
      autor: "sistema",
      envio: { tipo: "texto", texto: "Listo, no te volveremos a escribir. Si más adelante buscas propiedad, aquí estamos. 🙂" },
    });
    return { conversacionId: conversacion.id, leadId: lead.id, responder: false };
  }
  return { conversacionId: conversacion.id, leadId: lead.id, responder: conversacion.ia_activa };
}

export async function cancelarSeguimientos(admin: Admin, inmobiliariaId: string, leadId: string) {
  await admin
    .from("seguimientos")
    .update({ estado: "cancelado" })
    .eq("inmobiliaria_id", inmobiliariaId)
    .eq("lead_id", leadId)
    .eq("estado", "pendiente");
}

export async function actualizarEstados(admin: Admin, inmobiliariaId: string, estados: ActualizacionEstado[]) {
  for (const e of estados) {
    await admin
      .from("mensajes")
      .update({ estado: e.estado, ...(e.error ? { error: e.error } : {}) })
      .eq("inmobiliaria_id", inmobiliariaId)
      .eq("proveedor_mensaje_id", e.idProveedor)
      .eq("direccion", "saliente");
  }
}

/**
 * Primer mensaje a un lead que llegó por anuncio, landing o portal: como él no
 * nos ha escrito, sólo se puede usar una plantilla aprobada.
 */
export async function enviarPrimerContacto(admin: Admin, inmobiliariaId: string, leadId: string): Promise<"enviado" | "omitido"> {
  const canal = await cargarCanal(admin, { inmobiliariaId });
  if (!canal?.config.plantilla_bienvenida) return "omitido";

  const [{ data: lead }, { data: inmo }] = await Promise.all([
    admin.from("leads").select("id, nombre, telefono, opt_out, primer_contacto_en").eq("inmobiliaria_id", inmobiliariaId).eq("id", leadId).single(),
    admin.from("inmobiliarias").select("nombre").eq("id", inmobiliariaId).single(),
  ]);
  if (!lead?.telefono || lead.opt_out || lead.primer_contacto_en) return "omitido";

  const parametros = [lead.nombre?.split(" ")[0] ?? "hola", inmo?.nombre ?? ""];
  const conversacion = await asegurarConversacion(admin, inmobiliariaId, leadId);
  const enviados = await enviarYGuardar(admin, canal, {
    conversacionId: conversacion.id,
    leadId,
    telefono: lead.telefono,
    autor: "sistema",
    metadatos: { plantilla: canal.config.plantilla_bienvenida },
    envio: {
      tipo: "plantilla",
      plantilla: { nombre: canal.config.plantilla_bienvenida, idioma: canal.config.idioma, parametros },
      textoVisible: canal.config.texto_bienvenida
        ? rellenarPlantilla(canal.config.texto_bienvenida, parametros)
        : `Plantilla "${canal.config.plantilla_bienvenida}" (${parametros.join(", ")})`,
    },
  });
  return enviados ? "enviado" : "omitido";
}
