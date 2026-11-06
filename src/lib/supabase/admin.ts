import "server-only";
import { createClient } from "@supabase/supabase-js";
import { envServidor } from "@/lib/env";
import type { Database } from "./database.types";

/**
 * Cliente con la llave secreta: SALTA RLS.
 *
 * Sólo para webhooks, cron, el agente y operaciones administrativas
 * (invitaciones). Toda consulta hecha con este cliente debe filtrar
 * explícitamente por `inmobiliaria_id`, resuelto en el servidor.
 */
export function crearClienteAdmin() {
  const env = envServidor();
  return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SECRET_KEY, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}
