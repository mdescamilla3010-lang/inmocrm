"use server";

import { randomBytes } from "node:crypto";
import { revalidatePath } from "next/cache";
import { erroresPorCampo, objetoDeFormulario } from "@/lib/auth/esquemas";
import { requerirDueno } from "@/lib/auth/sesion";
import { cifrar } from "@/lib/cripto";
import { envServidor } from "@/lib/env";
import type { EstadoFormulario } from "@/lib/formularios";
import { esquemaPaginaMeta } from "@/lib/leads/integraciones";
import { esquemaFormWhatsApp } from "@/lib/mensajeria/config";
import { normalizarTelefono } from "@/lib/telefono";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { crearClienteServidor } from "@/lib/supabase/server";

const RUTA = "/configuracion/integraciones";

export async function regenerarClaveLanding() {
  const dueno = await requerirDueno();
  const supabase = await crearClienteServidor();
  await supabase
    .from("inmobiliarias")
    .update({ clave_landing: randomBytes(16).toString("hex") })
    .eq("id", dueno.inmobiliariaId);
  revalidatePath(RUTA);
}

export async function conectarPaginaMeta(_: EstadoFormulario, fd: FormData): Promise<EstadoFormulario> {
  const dueno = await requerirDueno();
  const valores = objetoDeFormulario(fd);
  const r = esquemaPaginaMeta.safeParse(valores);
  if (!r.success) return { errores: erroresPorCampo(r.error), valores: { ...valores, token: "" } };

  const llave = envServidor().ENCRYPTION_KEY;
  if (!llave) return { error: "Falta configurar ENCRYPTION_KEY en el servidor." };

  // Escritura con service role: los usuarios no pueden escribir credenciales.
  // El tenant sale de la sesión del dueño.
  const admin = crearClienteAdmin();
  const { data: existente } = await admin
    .from("integraciones")
    .select("id, inmobiliaria_id")
    .eq("proveedor", "meta_leads")
    .eq("identificador_externo", r.data.pageId)
    .maybeSingle();
  if (existente && existente.inmobiliaria_id !== dueno.inmobiliariaId) {
    return { errores: { pageId: "Esa página ya está conectada a otra cuenta de InmoCRM." }, valores: { ...valores, token: "" } };
  }

  const fila = {
    inmobiliaria_id: dueno.inmobiliariaId,
    proveedor: "meta_leads" as const,
    identificador_externo: r.data.pageId,
    credenciales_cifradas: cifrar(r.data.token, llave),
    config: { nombre: r.data.nombre },
    activa: true,
  };
  const { error } = existente
    ? await admin.from("integraciones").update(fila).eq("id", existente.id).eq("inmobiliaria_id", dueno.inmobiliariaId)
    : await admin.from("integraciones").insert(fila);
  if (error) return { error: "No se pudo guardar la conexión.", valores: { ...valores, token: "" } };

  revalidatePath(RUTA);
  return { ok: "Página conectada. Los leads nuevos de sus formularios llegarán solos." };
}

export async function desconectarIntegracion(integracionId: string) {
  const dueno = await requerirDueno();
  const admin = crearClienteAdmin();
  await admin.from("integraciones").delete().eq("id", integracionId).eq("inmobiliaria_id", dueno.inmobiliariaId);
  revalidatePath(RUTA);
}

export async function conectarWhatsApp(_: EstadoFormulario, fd: FormData): Promise<EstadoFormulario> {
  const dueno = await requerirDueno();
  const valores = objetoDeFormulario(fd);
  const sinToken = { ...valores, token: "" };
  const r = esquemaFormWhatsApp.safeParse(valores);
  if (!r.success) return { errores: erroresPorCampo(r.error), valores: sinToken };
  const numero = normalizarTelefono(r.data.numero);
  if (!numero) return { errores: { numero: "Número no válido" }, valores: sinToken };

  const llave = envServidor().ENCRYPTION_KEY;
  if (!llave) return { error: "Falta configurar ENCRYPTION_KEY en el servidor.", valores: sinToken };

  const admin = crearClienteAdmin();
  const { data: otro } = await admin
    .from("integraciones")
    .select("id, inmobiliaria_id")
    .eq("proveedor", "whatsapp_cloud")
    .eq("identificador_externo", r.data.phoneNumberId)
    .maybeSingle();
  if (otro && otro.inmobiliaria_id !== dueno.inmobiliariaId) {
    return { errores: { phoneNumberId: "Ese número ya está conectado a otra cuenta de InmoCRM." }, valores: sinToken };
  }

  // Un número por inmobiliaria: se reemplaza el anterior si lo hay.
  await admin
    .from("integraciones")
    .delete()
    .eq("inmobiliaria_id", dueno.inmobiliariaId)
    .in("proveedor", ["whatsapp_cloud", "twilio"])
    .neq("identificador_externo", r.data.phoneNumberId);

  const fila = {
    inmobiliaria_id: dueno.inmobiliariaId,
    proveedor: "whatsapp_cloud" as const,
    identificador_externo: r.data.phoneNumberId,
    credenciales_cifradas: cifrar(JSON.stringify({ token: r.data.token }), llave),
    config: {
      numero,
      waba_id: r.data.wabaId,
      plantilla_bienvenida: r.data.plantillaBienvenida,
      idioma: r.data.idioma,
      texto_bienvenida: r.data.textoBienvenida,
      plantilla_aviso_asesor: r.data.plantillaAvisoAsesor,
      plantilla_recordatorio: r.data.plantillaRecordatorio,
      texto_recordatorio: r.data.textoRecordatorio,
      plantilla_reactivacion: r.data.plantillaReactivacion,
      texto_reactivacion: r.data.textoReactivacion,
    },
    activa: true,
  };
  const { error } = otro
    ? await admin.from("integraciones").update(fila).eq("id", otro.id).eq("inmobiliaria_id", dueno.inmobiliariaId)
    : await admin.from("integraciones").insert(fila);
  if (error) return { error: "No se pudo guardar la conexión.", valores: sinToken };

  revalidatePath(RUTA);
  return { ok: "WhatsApp conectado. El agente empezará a contestar los mensajes nuevos." };
}
