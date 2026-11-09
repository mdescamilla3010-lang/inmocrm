"use server";

import { revalidatePath } from "next/cache";
import { envPublico } from "@/lib/env";
import { crearClienteAdmin } from "@/lib/supabase/admin";
import { crearClienteServidor } from "@/lib/supabase/server";
import { erroresPorCampo, esquemaInvitacion, esquemaMiembro, objetoDeFormulario } from "@/lib/auth/esquemas";
import { dejariaSinDueno } from "@/lib/auth/permisos";
import { requerirDueno } from "@/lib/auth/sesion";
import type { EstadoFormulario } from "@/lib/formularios";

const RUTA = "/configuracion/equipo";

export async function invitarMiembro(_: EstadoFormulario, fd: FormData): Promise<EstadoFormulario> {
  const dueno = await requerirDueno();
  const valores = objetoDeFormulario(fd);
  const r = esquemaInvitacion.safeParse(valores);
  if (!r.success) return { errores: erroresPorCampo(r.error), valores };

  // La invitación crea el usuario en Auth: requiere la llave secreta. El
  // tenant sale de la sesión del dueño, nunca del formulario.
  const admin = crearClienteAdmin();
  const { data, error } = await admin.auth.admin.inviteUserByEmail(r.data.email, {
    redirectTo: `${envPublico().NEXT_PUBLIC_APP_URL}/auth/confirmar?next=/nueva-contrasena`,
    data: { nombre: r.data.nombre },
  });
  if (error || !data.user) {
    const yaExiste = error?.code === "email_exists" || error?.status === 422;
    return {
      error: yaExiste ? "Ese correo ya tiene una cuenta en InmoCRM." : "No pudimos enviar la invitación. Intenta de nuevo.",
      valores,
    };
  }

  const { error: errorInsert } = await admin.from("usuarios").insert({
    id: data.user.id,
    inmobiliaria_id: dueno.inmobiliariaId,
    rol: r.data.rol,
    nombre: r.data.nombre,
    email: r.data.email,
    telefono: r.data.telefono,
  });
  if (errorInsert) {
    // Revertir para no dejar una cuenta de Auth huérfana.
    await admin.auth.admin.deleteUser(data.user.id);
    return { error: "No pudimos agregar a la persona al equipo. Intenta de nuevo.", valores };
  }

  revalidatePath(RUTA);
  return { ok: `Invitación enviada a ${r.data.email}.` };
}

export async function actualizarMiembro(_: EstadoFormulario, fd: FormData): Promise<EstadoFormulario> {
  await requerirDueno();
  const r = esquemaMiembro.safeParse(objetoDeFormulario(fd));
  if (!r.success) return { error: "Datos no válidos." };

  // Cliente con sesión: RLS y el trigger proteger_usuarios validan de nuevo.
  const supabase = await crearClienteServidor();
  const { data: equipo, error: errorEquipo } = await supabase.from("usuarios").select("id, rol, activo");
  if (errorEquipo || !equipo) return { error: "No pudimos leer el equipo." };

  if (dejariaSinDueno(equipo, r.data)) {
    return { error: "La inmobiliaria debe tener al menos un dueño activo." };
  }

  const { data, error } = await supabase
    .from("usuarios")
    .update({ rol: r.data.rol, activo: r.data.activo, recibe_leads: r.data.recibeLeads })
    .eq("id", r.data.id)
    .select("id");
  if (error || !data?.length) return { error: "No pudimos guardar los cambios." };

  revalidatePath(RUTA);
  return { ok: "Cambios guardados." };
}
