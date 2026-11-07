"use server";

import { revalidatePath } from "next/cache";
import { requerirUsuario } from "@/lib/auth/sesion";
import { cancelarCita } from "@/lib/calendario/agenda";
import type { Database } from "@/lib/supabase/database.types";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { crearClienteServidor } from "@/lib/supabase/server";

type EstadoCita = Database["public"]["Enums"]["estado_cita"];

function refrescar(leadId: string) {
  revalidatePath("/citas");
  revalidatePath(`/leads/${leadId}`);
}

const ESTADOS_DESDE_PANEL = new Set<EstadoCita>(["confirmada", "realizada", "no_asistio"]);

/** Confirmar / realizada / no asistió. RLS: dueño cualquiera, asesor las suyas. */
export async function cambiarEstadoCita(citaId: string, estado: Exclude<EstadoCita, "programada" | "cancelada">) {
  await requerirUsuario();
  // Los argumentos ligados con .bind llegan del navegador: se validan aquí.
  // (Cancelar va por cancelarCitaPanel para borrar también el evento de Google.)
  if (!ESTADOS_DESDE_PANEL.has(estado)) return;
  const supabase = await crearClienteServidor();
  const { data: cita } = await supabase
    .from("citas")
    .update({ estado })
    .eq("id", citaId)
    .in("estado", ["programada", "confirmada"])
    .select("lead_id")
    .maybeSingle();
  if (!cita) return;
  if (estado === "realizada") {
    await supabase.from("leads").update({ estado: "visita_realizada" }).eq("id", cita.lead_id).in("estado", ["cita_agendada", "calificado"]);
  }
  refrescar(cita.lead_id);
}

export async function cancelarCitaPanel(citaId: string) {
  const usuario = await requerirUsuario();
  // Primero se confirma con RLS que el usuario puede ver esa cita…
  const supabase = await crearClienteServidor();
  const { data: cita } = await supabase.from("citas").select("id, lead_id").eq("id", citaId).maybeSingle();
  if (!cita) return;
  // …y se cancela con el servicio (borra también el evento de Google del asesor).
  await cancelarCita(crearClienteAdmin(), {
    inmobiliariaId: usuario.inmobiliariaId,
    citaId: cita.id,
    motivo: `Cancelada desde el panel por ${usuario.nombre}`,
  });
  refrescar(cita.lead_id);
}
