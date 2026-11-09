"use server";

import { redirect } from "next/navigation";
import { erroresPorCampo, objetoDeFormulario } from "@/lib/auth/esquemas";
import { requerirUsuario } from "@/lib/auth/sesion";
import type { EstadoFormulario } from "@/lib/formularios";
import { capturarLead } from "@/lib/leads/captura";
import { esquemaLeadManual } from "@/lib/leads/esquemas";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { crearClienteServidor } from "@/lib/supabase/server";

export async function crearLeadManual(_: EstadoFormulario, fd: FormData): Promise<EstadoFormulario> {
  const usuario = await requerirUsuario();
  const valores = objetoDeFormulario(fd);
  const r = esquemaLeadManual.safeParse(valores);
  if (!r.success) return { errores: erroresPorCampo(r.error), valores };
  const datos = r.data;

  // Duplicados: se revisa en toda la inmobiliaria (el asesor no ve leads ajenos
  // por RLS, pero no debe crear un duplicado de uno que atiende otro asesor).
  const admin = crearClienteAdmin();
  if (datos.telefono) {
    const { data: duplicado } = await admin
      .from("leads")
      .select("id, asesor_id")
      .eq("inmobiliaria_id", usuario.inmobiliariaId)
      .eq("telefono", datos.telefono)
      .maybeSingle();
    if (duplicado) {
      const puedeVerlo = usuario.rol === "dueno" || duplicado.asesor_id === usuario.id;
      return {
        error: puedeVerlo
          ? "Ya existe un lead con ese teléfono."
          : "Ese prospecto ya existe y lo atiende otro asesor. Pídele al dueño que te lo asigne.",
        valores,
        // Se devuelve el id sólo si el usuario puede abrir ese lead.
        errores: puedeVerlo ? { _duplicado: duplicado.id } : undefined,
      };
    }
  }

  // El asesor siempre se lo queda; el dueño elige asesor o deja la asignación automática.
  const asesorId = usuario.rol === "asesor" ? usuario.id : datos.asesorId;

  let leadId: string;
  if (!asesorId) {
    const resultado = await capturarLead(admin, usuario.inmobiliariaId, {
      fuente: "manual",
      nombre: datos.nombre,
      telefono: datos.telefono,
      email: datos.email,
      mensajeInicial: datos.mensaje,
      textoZona: datos.mensaje,
      clavePropiedad: null,
      fuenteDetalle: { capturado_por: usuario.id },
      datosCrudos: null,
    });
    leadId = resultado.leadId;
  } else {
    const supabase = await crearClienteServidor();
    const { data, error } = await supabase
      .from("leads")
      .insert({
        inmobiliaria_id: usuario.inmobiliariaId,
        nombre: datos.nombre,
        telefono: datos.telefono,
        email: datos.email,
        mensaje_inicial: datos.mensaje,
        fuente: "manual",
        fuente_detalle: { capturado_por: usuario.id },
        asesor_id: asesorId,
        asignado_en: new Date().toISOString(),
      })
      .select("id")
      .single();
    if (error || !data) return { error: "No pudimos guardar el lead. Intenta de nuevo.", valores };
    leadId = data.id;
  }
  redirect(`/leads/${leadId}`);
}
