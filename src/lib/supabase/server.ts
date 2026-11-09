import "server-only";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { envPublico } from "@/lib/env";
import type { Database } from "./database.types";

/**
 * Cliente con la sesión del usuario. Respeta RLS: es el default en páginas,
 * layouts y server actions.
 */
export async function crearClienteServidor() {
  const cookieStore = await cookies();
  const env = envPublico();

  return createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll();
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options),
            );
          } catch {
            // Desde un Server Component no se pueden escribir cookies; el
            // proxy ya refrescó la sesión en esta misma petición.
          }
        },
      },
    },
  );
}
