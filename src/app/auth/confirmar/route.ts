import type { EmailOtpType } from "@supabase/supabase-js";
import { NextResponse, type NextRequest } from "next/server";
import { rutaSegura } from "@/lib/auth/rutas";
import { crearClienteServidor } from "@/lib/supabase/server";

const TIPOS_VALIDOS: readonly EmailOtpType[] = ["email", "signup", "invite", "recovery", "magiclink", "email_change"];

/**
 * Destino de los enlaces de los correos de Supabase (confirmación, invitación,
 * recuperación). Canjea el token_hash por una sesión y redirige a `next`.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const tipo = searchParams.get("type") as EmailOtpType | null;
  const destino = rutaSegura(searchParams.get("next"));

  if (tokenHash && tipo && TIPOS_VALIDOS.includes(tipo)) {
    const supabase = await crearClienteServidor();
    const { error } = await supabase.auth.verifyOtp({ type: tipo, token_hash: tokenHash });
    if (!error) return NextResponse.redirect(new URL(destino, request.url));
  }
  return NextResponse.redirect(new URL("/login?error=enlace", request.url));
}
