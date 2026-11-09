import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { z } from "zod";
import { descifrar } from "@/lib/cripto";
import { envServidor, requerirEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";
import { ProveedorGoogleCalendar } from "./google";
import type { ProveedorCalendario } from "./tipos";

type Admin = SupabaseClient<Database>;

const esquemaCredenciales = z.object({ refreshToken: z.string().min(10) });

/** Calendario de Google del asesor, o null si no lo ha conectado (o Google no está configurado). */
export async function cargarCalendarioAsesor(
  admin: Admin,
  inmobiliariaId: string,
  asesorId: string,
): Promise<{ proveedor: ProveedorCalendario; integracionId: string } | null> {
  const env = envServidor();
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return null;

  const [{ data: integracion }, { data: usuario }] = await Promise.all([
    admin
      .from("integraciones")
      .select("id, credenciales_cifradas")
      .eq("inmobiliaria_id", inmobiliariaId)
      .eq("usuario_id", asesorId)
      .eq("proveedor", "google_calendar")
      .eq("activa", true)
      .maybeSingle(),
    admin.from("usuarios").select("google_calendar_id").eq("inmobiliaria_id", inmobiliariaId).eq("id", asesorId).maybeSingle(),
  ]);
  if (!integracion?.credenciales_cifradas) return null;

  const { refreshToken } = esquemaCredenciales.parse(JSON.parse(descifrar(integracion.credenciales_cifradas, requerirEnv("ENCRYPTION_KEY"))));
  return {
    integracionId: integracion.id,
    proveedor: new ProveedorGoogleCalendar({
      clientId: env.GOOGLE_CLIENT_ID,
      clientSecret: env.GOOGLE_CLIENT_SECRET,
      refreshToken,
      calendarId: usuario?.google_calendar_id || "primary",
    }),
  };
}

/** Si Google revocó el acceso, se marca la conexión como inactiva para pedir reconectar. */
export async function marcarCalendarioDesconectado(admin: Admin, inmobiliariaId: string, integracionId: string) {
  await admin.from("integraciones").update({ activa: false }).eq("inmobiliaria_id", inmobiliariaId).eq("id", integracionId);
}
