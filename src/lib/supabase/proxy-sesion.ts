import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { envPublico } from "@/lib/env";
import { esRutaPublica } from "@/lib/auth/rutas";
import type { Database } from "./database.types";

/**
 * Refresca la sesión de Supabase en cada petición y redirige según el estado
 * de autenticación. No consulta la base: la verificación de inmobiliaria y rol
 * se hace en los layouts (lib/auth/sesion.ts).
 */
export async function actualizarSesion(request: NextRequest) {
  let response = NextResponse.next({ request });
  const env = envPublico();

  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          cookiesToSet.forEach(({ name, value }) => request.cookies.set(name, value));
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
          Object.entries(headers).forEach(([k, v]) => response.headers.set(k, v));
        },
      },
    },
  );

  // getClaims valida el JWT; no confiar en getSession() del lado servidor.
  const { data } = await supabase.auth.getClaims();
  const autenticado = Boolean(data?.claims);
  const { pathname, search } = request.nextUrl;

  if (!autenticado && !esRutaPublica(pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.search = "";
    if (pathname !== "/") url.searchParams.set("next", pathname + search);
    return conCookies(NextResponse.redirect(url), response);
  }

  if (autenticado && (pathname === "/login" || pathname === "/registro")) {
    const url = request.nextUrl.clone();
    url.pathname = "/leads";
    url.search = "";
    return conCookies(NextResponse.redirect(url), response);
  }

  return response;
}

function conCookies(destino: NextResponse, origen: NextResponse) {
  origen.cookies.getAll().forEach((c) => destino.cookies.set(c));
  return destino;
}
