import type { NextRequest } from "next/server";
import { actualizarSesion } from "@/lib/supabase/proxy-sesion";

export async function proxy(request: NextRequest) {
  return actualizarSesion(request);
}

export const config = {
  matcher: [
    // Todo excepto estáticos, imágenes y los endpoints /api (webhooks y cron
    // tienen su propia autenticación).
    "/((?!api/|_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp)$).*)",
  ],
};
