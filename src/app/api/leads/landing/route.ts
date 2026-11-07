import { after, NextResponse, type NextRequest } from "next/server";
import { enviarPrimerContacto } from "@/lib/conversaciones/servicio";
import { destinoGracias, esquemaLanding, LIMITE_LANDING_POR_MINUTO } from "@/lib/leads/landing";
import { abrirCaptura, capturarLead, cerrarCaptura } from "@/lib/leads/captura";
import { crearClienteAdmin } from "@/lib/supabase/admin";

/**
 * Endpoint público para formularios de landing (HTML, Webflow, WordPress,
 * Zapier/Make…). Acepta JSON o form-urlencoded. El tenant se identifica por
 * `clave` (inmobiliarias.clave_landing).
 */

// Los formularios viven en dominios de los clientes.
const CORS = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers": "Content-Type",
  "Access-Control-Max-Age": "86400",
};

export function OPTIONS() {
  return new NextResponse(null, { status: 204, headers: CORS });
}

export async function POST(request: NextRequest) {
  const esFormulario = !(request.headers.get("content-type") ?? "").includes("application/json");
  let cuerpo: Record<string, unknown>;
  try {
    cuerpo = esFormulario
      ? Object.fromEntries((await request.formData()).entries())
      : ((await request.json()) as Record<string, unknown>);
  } catch {
    return json({ ok: false, error: "Cuerpo inválido" }, 400);
  }

  const r = esquemaLanding.safeParse(cuerpo);
  if (!r.success) {
    if (r.error.issues.some((i) => i.path[0] === "clave")) {
      return json({ ok: false, error: "Falta la clave de la inmobiliaria o no es válida" }, 401);
    }
    return json({ ok: false, error: r.error.issues[0]?.message ?? "Datos incompletos" }, 422);
  }
  const envio = r.data;

  const admin = crearClienteAdmin();
  const { data: inmo } = await admin.from("inmobiliarias").select("id").eq("clave_landing", envio.clave).maybeSingle();
  if (!inmo) return json({ ok: false, error: "Clave de inmobiliaria no válida" }, 404);

  // Al bot se le responde como si todo hubiera salido bien.
  if (envio.esSpam) return respuestaExito(request, cuerpo, esFormulario);

  const { count: recientes } = await admin
    .from("capturas_lead")
    .select("id", { count: "exact", head: true })
    .eq("inmobiliaria_id", inmo.id)
    .eq("canal", "landing")
    .gte("creado_en", new Date(Date.now() - 60_000).toISOString());
  if ((recientes ?? 0) >= LIMITE_LANDING_POR_MINUTO) {
    return json({ ok: false, error: "Demasiados envíos. Intenta de nuevo en un minuto." }, 429);
  }

  const capturaId = await abrirCaptura(admin, {
    inmobiliariaId: inmo.id,
    canal: "landing",
    fuente: "landing",
    idExterno: null,
    payload: { ...envio, clave: undefined },
  });
  try {
    const resultado = await capturarLead(admin, inmo.id, {
      fuente: "landing",
      nombre: envio.nombre,
      telefono: envio.telefono,
      email: envio.email,
      mensajeInicial: envio.mensaje,
      textoZona: envio.zona,
      clavePropiedad: envio.propiedad,
      fuenteDetalle: { pagina: envio.pagina ?? undefined, ...envio.utm },
      datosCrudos: { ...envio, clave: undefined },
    });
    if (capturaId) {
      await cerrarCaptura(admin, {
        inmobiliariaId: inmo.id,
        capturaId,
        resultado: resultado.tipo,
        leadId: resultado.leadId,
      });
    }
    if (resultado.tipo === "creado") {
      after(() => enviarPrimerContacto(admin, inmo.id, resultado.leadId).catch((e) => console.error("[landing] primer contacto", e)));
    }
  } catch (e) {
    if (capturaId) {
      await cerrarCaptura(admin, { inmobiliariaId: inmo.id, capturaId, resultado: "error", detalle: String(e) });
    }
    console.error("[landing] error al capturar lead", e);
    return json({ ok: false, error: "No pudimos registrar tus datos. Intenta de nuevo." }, 500);
  }
  return respuestaExito(request, cuerpo, esFormulario);
}

function json(cuerpo: unknown, status = 200) {
  return NextResponse.json(cuerpo, { status, headers: CORS });
}

/** Un <form> HTML sin JavaScript puede mandar `gracias` para regresar a su página (del mismo sitio). */
function respuestaExito(request: NextRequest, cuerpo: Record<string, unknown>, esFormulario: boolean) {
  const destino = esFormulario ? destinoGracias(cuerpo.gracias, request.headers.get("origin"), request.headers.get("referer")) : null;
  if (destino) {
    return NextResponse.redirect(destino, { status: 303, headers: CORS });
  }
  return json({ ok: true, mensaje: "¡Gracias! En un momento te contactamos por WhatsApp." });
}
