import { NextResponse, type NextRequest } from "next/server";
import { requerirUsuario } from "@/lib/auth/sesion";
import { verificarEstadoOAuth } from "@/lib/calendario/estado-oauth";
import { intercambiarCodigoGoogle } from "@/lib/calendario/google";
import { ErrorCalendario } from "@/lib/calendario/tipos";
import { cifrar } from "@/lib/cripto";
import { envPublico, requerirEnv } from "@/lib/env";
import { crearClienteAdmin } from "@/lib/supabase/admin";

/** Google regresa aquí con el código de autorización. */
export async function GET(request: NextRequest) {
  const usuario = await requerirUsuario();
  const p = request.nextUrl.searchParams;
  const volver = (resultado: string) => NextResponse.redirect(new URL(`/perfil?google=${resultado}`, request.url));

  if (p.get("error")) return volver("cancelado");
  // El state debe ser nuestro, vigente y del mismo usuario con sesión.
  const llave = requerirEnv("ENCRYPTION_KEY");
  if (verificarEstadoOAuth(p.get("state"), llave) !== usuario.id) return volver("invalido");
  const code = p.get("code");
  if (!code) return volver("invalido");

  let datos: Awaited<ReturnType<typeof intercambiarCodigoGoogle>>;
  try {
    datos = await intercambiarCodigoGoogle({
      clientId: requerirEnv("GOOGLE_CLIENT_ID"),
      clientSecret: requerirEnv("GOOGLE_CLIENT_SECRET"),
      code,
      redirectUri: `${envPublico().NEXT_PUBLIC_APP_URL}/api/integraciones/google/callback`,
    });
  } catch (e) {
    console.error("[google] error al canjear el código", e instanceof ErrorCalendario ? e.message : e);
    return volver("error");
  }
  if (!datos.scopes.some((s) => s.endsWith("/calendar.events")) || !datos.scopes.some((s) => s.endsWith("/calendar.freebusy"))) {
    return volver("permisos");
  }

  // Credenciales sólo por servidor; el tenant y el usuario salen de la sesión.
  const admin = crearClienteAdmin();
  const { data: otra } = await admin
    .from("integraciones")
    .select("id, usuario_id")
    .eq("proveedor", "google_calendar")
    .eq("identificador_externo", datos.email)
    .maybeSingle();
  if (otra && otra.usuario_id !== usuario.id) return volver("en_uso");

  await admin
    .from("integraciones")
    .delete()
    .eq("inmobiliaria_id", usuario.inmobiliariaId)
    .eq("usuario_id", usuario.id)
    .eq("proveedor", "google_calendar")
    .neq("identificador_externo", datos.email);

  const fila = {
    inmobiliaria_id: usuario.inmobiliariaId,
    usuario_id: usuario.id,
    proveedor: "google_calendar" as const,
    identificador_externo: datos.email,
    credenciales_cifradas: cifrar(JSON.stringify({ refreshToken: datos.refreshToken }), llave),
    config: { email: datos.email },
    activa: true,
  };
  const { error } = otra
    ? await admin.from("integraciones").update(fila).eq("id", otra.id).eq("inmobiliaria_id", usuario.inmobiliariaId)
    : await admin.from("integraciones").insert(fila);
  if (error) {
    console.error("[google] no se pudo guardar la integración", error.message);
    return volver("error");
  }
  return volver("conectado");
}
