import { NextResponse, type NextRequest } from "next/server";
import { requerirUsuario } from "@/lib/auth/sesion";
import { crearEstadoOAuth } from "@/lib/calendario/estado-oauth";
import { urlAutorizacionGoogle } from "@/lib/calendario/google";
import { envPublico, envServidor, requerirEnv } from "@/lib/env";

/** Manda al asesor a Google para que autorice su calendario. */
export async function GET(request: NextRequest) {
  const usuario = await requerirUsuario();
  const clientId = envServidor().GOOGLE_CLIENT_ID;
  if (!clientId) return NextResponse.redirect(new URL("/perfil?google=no_configurado", request.url));

  return NextResponse.redirect(
    urlAutorizacionGoogle({
      clientId,
      redirectUri: `${envPublico().NEXT_PUBLIC_APP_URL}/api/integraciones/google/callback`,
      state: crearEstadoOAuth(usuario.id, requerirEnv("ENCRYPTION_KEY")),
    }),
  );
}
