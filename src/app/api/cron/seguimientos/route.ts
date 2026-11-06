import { NextResponse, type NextRequest } from "next/server";
import { requerirEnv } from "@/lib/env";
import { secretosIguales } from "@/lib/seguridad";
import { procesarSeguimientosPendientes } from "@/lib/seguimiento/ejecutor";

export const maxDuration = 60;

/**
 * Lo invoca cada minuto pg_cron (POST) o Vercel Cron (GET), siempre con
 * `Authorization: Bearer <CRON_SECRET>`.
 */
async function ejecutar(request: NextRequest) {
  const header = request.headers.get("authorization") ?? "";
  const token = header.startsWith("Bearer ") ? header.slice(7) : "";
  if (!token || !secretosIguales(token, requerirEnv("CRON_SECRET"))) {
    return new NextResponse("No autorizado", { status: 401 });
  }
  try {
    const resumen = await procesarSeguimientosPendientes();
    return NextResponse.json({ ok: true, ...resumen });
  } catch (e) {
    console.error("[cron] error procesando seguimientos", e);
    return NextResponse.json({ ok: false }, { status: 500 });
  }
}

export const GET = ejecutar;
export const POST = ejecutar;
