"use server";

import { revalidatePath } from "next/cache";
import { erroresPorCampo, objetoDeFormulario } from "@/lib/auth/esquemas";
import { requerirDueno, requerirUsuario } from "@/lib/auth/sesion";
import type { EstadoFormulario } from "@/lib/formularios";
import { esquemaCalificacion, esquemaContacto, esquemaEstado, esquemaNota, esquemaReasignar } from "@/lib/leads/esquemas";
import type { Database } from "@/lib/supabase/database.types";
import { crearClienteServidor } from "@/lib/supabase/server";
import { esquemaMensajeAsesor } from "@/lib/agente/configuracion";
import { agendarCita } from "@/lib/calendario/agenda";
import { esquemaAgendarPanel } from "@/lib/calendario/configuracion";
import { localAUtc } from "@/lib/calendario/zona-horaria";
import { enviarYGuardar } from "@/lib/conversaciones/servicio";
import { cargarCanal } from "@/lib/mensajeria/canal";
import { dentroDeVentana } from "@/lib/mensajeria/tipos";
import { crearClienteAdmin } from "@/lib/supabase/admin";

// Todas usan el cliente con sesión: RLS decide si el usuario puede tocar el
// lead (dueño: cualquiera de su inmobiliaria; asesor: sólo los suyos).

type CambiosLead = Database["public"]["Tables"]["leads"]["Update"];

async function actualizarLead(leadId: string, cambios: CambiosLead, ok: string): Promise<EstadoFormulario> {
  const supabase = await crearClienteServidor();
  const { data, error } = await supabase.from("leads").update(cambios).eq("id", leadId).select("id");
  if (error?.code === "23505") return { error: "Ya existe otro lead con ese teléfono." };
  if (error || !data?.length) return { error: "No se pudo guardar. Puede que ya no tengas acceso a este lead." };
  revalidatePath(`/leads/${leadId}`);
  return { ok };
}

export async function cambiarEstado(leadId: string, _: EstadoFormulario, fd: FormData): Promise<EstadoFormulario> {
  await requerirUsuario();
  const r = esquemaEstado.safeParse(objetoDeFormulario(fd));
  if (!r.success) return { error: "Estado no válido." };
  return actualizarLead(leadId, { estado: r.data.estado }, "Estado actualizado.");
}

export async function reasignarLead(leadId: string, _: EstadoFormulario, fd: FormData): Promise<EstadoFormulario> {
  await requerirDueno();
  const r = esquemaReasignar.safeParse(objetoDeFormulario(fd));
  if (!r.success) return { error: "Elige un asesor." };

  const supabase = await crearClienteServidor();
  const { data: asesor } = await supabase.from("usuarios").select("id, activo").eq("id", r.data.asesorId).maybeSingle();
  if (!asesor?.activo) return { error: "Ese asesor no está activo." };

  return actualizarLead(leadId, { asesor_id: asesor.id, asignado_en: new Date().toISOString() }, "Lead reasignado.");
}

export async function guardarCalificacion(leadId: string, _: EstadoFormulario, fd: FormData): Promise<EstadoFormulario> {
  await requerirUsuario();
  const valores = objetoDeFormulario(fd);
  const r = esquemaCalificacion.safeParse(valores);
  if (!r.success) return { errores: erroresPorCampo(r.error), valores };
  const resultado = await actualizarLead(leadId, r.data, "Calificación guardada.");
  return resultado.error ? { ...resultado, valores } : resultado;
}

export async function guardarContacto(leadId: string, _: EstadoFormulario, fd: FormData): Promise<EstadoFormulario> {
  await requerirUsuario();
  const valores = objetoDeFormulario(fd);
  const r = esquemaContacto.safeParse(valores);
  if (!r.success) return { errores: erroresPorCampo(r.error), valores };
  const resultado = await actualizarLead(leadId, r.data, "Contacto guardado.");
  return resultado.error ? { ...resultado, valores } : resultado;
}

export async function agregarNota(leadId: string, _: EstadoFormulario, fd: FormData): Promise<EstadoFormulario> {
  const usuario = await requerirUsuario();
  const valores = objetoDeFormulario(fd);
  const r = esquemaNota.safeParse(valores);
  if (!r.success) return { errores: erroresPorCampo(r.error), valores };

  const supabase = await crearClienteServidor();
  const { error } = await supabase.from("eventos_lead").insert({
    inmobiliaria_id: usuario.inmobiliariaId,
    lead_id: leadId,
    tipo: "nota",
    usuario_id: usuario.id,
    datos: { texto: r.data.texto },
  });
  if (error) return { error: "No se pudo guardar la nota.", valores };
  revalidatePath(`/leads/${leadId}`);
  return { ok: "Nota agregada." };
}

// ---------------------------------------------------------------------------
// Conversación de WhatsApp
// ---------------------------------------------------------------------------

async function conversacionDelLead(leadId: string) {
  // Con el cliente de sesión: si el usuario no puede ver el lead, no la encuentra.
  const supabase = await crearClienteServidor();
  const { data } = await supabase
    .from("conversaciones")
    .select("id, lead_id, ultimo_entrante_en, ia_activa, lead:leads(telefono)")
    .eq("lead_id", leadId)
    .maybeSingle();
  return { supabase, conversacion: data };
}

export async function cambiarControlIA(leadId: string, iaActiva: boolean) {
  await requerirUsuario();
  if (typeof iaActiva !== "boolean") return;
  const { supabase, conversacion } = await conversacionDelLead(leadId);
  if (!conversacion) return;
  await supabase.from("conversaciones").update({ ia_activa: iaActiva, requiere_atencion: false }).eq("id", conversacion.id);
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
}

export async function marcarAtendido(leadId: string) {
  await requerirUsuario();
  const { supabase, conversacion } = await conversacionDelLead(leadId);
  if (!conversacion) return;
  await supabase.from("conversaciones").update({ requiere_atencion: false }).eq("id", conversacion.id);
  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/leads");
}

export async function enviarMensajeAsesor(leadId: string, _: EstadoFormulario, fd: FormData): Promise<EstadoFormulario> {
  const usuario = await requerirUsuario();
  const valores = objetoDeFormulario(fd);
  const r = esquemaMensajeAsesor.safeParse(valores);
  if (!r.success) return { errores: erroresPorCampo(r.error), valores };

  const { supabase, conversacion } = await conversacionDelLead(leadId);
  const telefono = conversacion?.lead?.telefono;
  if (!conversacion || !telefono) return { error: "Este lead no tiene conversación de WhatsApp.", valores };
  if (!dentroDeVentana(conversacion.ultimo_entrante_en)) {
    return { error: "Pasaron más de 24 h desde su último mensaje: WhatsApp sólo permite plantillas aprobadas.", valores };
  }

  // Enviar requiere las credenciales del número (sólo servidor). El tenant sale de la sesión.
  const admin = crearClienteAdmin();
  const canal = await cargarCanal(admin, { inmobiliariaId: usuario.inmobiliariaId });
  if (!canal) return { error: "WhatsApp no está conectado. Pídele al dueño que lo configure en Integraciones.", valores };

  // Si el asesor escribe, la IA deja de contestar en esta conversación.
  if (conversacion.ia_activa) await supabase.from("conversaciones").update({ ia_activa: false, requiere_atencion: false }).eq("id", conversacion.id);

  const enviados = await enviarYGuardar(admin, canal, {
    conversacionId: conversacion.id,
    leadId,
    telefono,
    autor: "asesor",
    asesorId: usuario.id,
    envio: { tipo: "texto", texto: r.data.texto },
  });
  revalidatePath(`/leads/${leadId}`);
  return enviados ? { ok: `Enviado ${new Date().toISOString()}` } : { error: "WhatsApp rechazó el mensaje. Revisa el detalle en la conversación.", valores };
}

// ---------------------------------------------------------------------------
// Agendar visita desde el panel
// ---------------------------------------------------------------------------

export async function agendarDesdePanel(leadId: string, _: EstadoFormulario, fd: FormData): Promise<EstadoFormulario> {
  const usuario = await requerirUsuario();
  const valores = objetoDeFormulario(fd);
  const r = esquemaAgendarPanel.safeParse(valores);
  if (!r.success) return { errores: erroresPorCampo(r.error), valores };

  // RLS: sólo si el usuario puede ver este lead.
  const supabase = await crearClienteServidor();
  const { data: lead } = await supabase.from("leads").select("id, asesor_id, telefono").eq("id", leadId).maybeSingle();
  if (!lead) return { error: "No tienes acceso a este lead.", valores };
  if (!lead.asesor_id) return { error: "Asigna un asesor al lead antes de agendar.", valores };

  const inicio = r.data.tipo === "manual" ? localAUtc(usuario.inmobiliaria.zonaHoraria, r.data.local) : r.data.inicio;
  if (inicio.getTime() < Date.now()) return { error: "Ese horario ya pasó.", valores };

  const admin = crearClienteAdmin();
  let resultado;
  try {
    resultado = await agendarCita(admin, {
      inmobiliariaId: usuario.inmobiliariaId,
      leadId,
      asesorId: lead.asesor_id,
      inicio,
      propiedadId: r.data.propiedadId,
      origen: "asesor",
      notas: r.data.notas,
      // Un horario de la lista se revalida; uno manual sólo se cuida de empalmes (lo hace la base).
      validarDisponibilidad: r.data.tipo === "libre",
    });
  } catch {
    return { error: "No se pudo consultar el calendario del asesor. Intenta de nuevo.", valores };
  }
  if (!resultado.ok) return { error: resultado.mensaje, valores };

  // Si la ventana de WhatsApp está abierta, se le confirma al prospecto.
  let avisado = false;
  const { data: conversacion } = await admin
    .from("conversaciones")
    .select("id, ultimo_entrante_en")
    .eq("inmobiliaria_id", usuario.inmobiliariaId)
    .eq("lead_id", leadId)
    .maybeSingle();
  if (lead.telefono && conversacion && dentroDeVentana(conversacion.ultimo_entrante_en)) {
    const canal = await cargarCanal(admin, { inmobiliariaId: usuario.inmobiliariaId });
    if (canal) {
      avisado =
        (await enviarYGuardar(admin, canal, {
          conversacionId: conversacion.id,
          leadId,
          telefono: lead.telefono,
          autor: "asesor",
          asesorId: usuario.id,
          envio: {
            tipo: "texto",
            texto: `¡Listo! Tu visita quedó agendada para el ${resultado.texto}.${resultado.direccion ? ` Dirección: ${resultado.direccion}.` : ""} Te escribimos antes para confirmar.`,
          },
        })) > 0;
    }
  }

  revalidatePath(`/leads/${leadId}`);
  revalidatePath("/citas");
  return {
    ok: `Visita agendada: ${resultado.texto}.${resultado.enGoogle ? " Quedó en Google Calendar." : ""}${avisado ? " Se le avisó por WhatsApp." : ""}`,
  };
}

export async function cancelarSeguimiento(leadId: string, seguimientoId: string) {
  const usuario = await requerirUsuario();
  // RLS: sólo si el usuario puede ver los seguimientos de ese lead.
  const supabase = await crearClienteServidor();
  const { data } = await supabase.from("seguimientos").select("id").eq("id", seguimientoId).eq("lead_id", leadId).eq("estado", "pendiente").maybeSingle();
  if (!data) return;
  // Los usuarios no escriben en la cola; se cancela con la llave de servidor.
  await crearClienteAdmin()
    .from("seguimientos")
    .update({ estado: "cancelado", ultimo_error: `Cancelado por ${usuario.nombre}` })
    .eq("inmobiliaria_id", usuario.inmobiliariaId)
    .eq("id", data.id);
  revalidatePath(`/leads/${leadId}`);
}
