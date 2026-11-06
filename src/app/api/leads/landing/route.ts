import { NextResponse, type NextRequest } from "next/server";
import { esquemaLanding } from "@/lib/leads/landing";
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
    const error = r.error.issues.find((i) => i.path[0] !== "clave")?.message ?? "Datos incompletos";
    return json({ ok: false, error }, 422);
  }
  const envio = r.data;

  const admin = crearClienteAdmin();
  const { data: inmo } = await admin.from("inmobiliarias").select("id").eq("clave_landing", envio.clave).maybeSingle();
  if (!inmo) return json({ ok: false, error: "Clave de inmobiliaria no válida" }, 404);

  // Al bot se le responde como si todo hubiera salido bien.
  if (envio.esSpam) return respuestaExito(cuerpo, esFormulario);

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
  } catch (e) {
    if (capturaId) {
      await cerrarCaptura(admin, { inmobiliariaId: inmo.id, capturaId, resultado: "error", detalle: String(e) });
    }
    console.error("[landing] error al capturar lead", e);
    return json({ ok: false, error: "No pudimos registrar tus datos. Intenta de nuevo." }, 500);
  }
  return respuestaExito(cuerpo, esFormulario);
}

function json(cuerpo: unknown, status = 200) {
  return NextResponse.json(cuerpo, { status, headers: CORS });
}

/** Un <form> HTML sin JavaScript puede mandar `gracias` para regresar a su página. */
function respuestaExito(cuerpo: Record<string, unknown>, esFormulario: boolean) {
  const gracias = typeof cuerpo.gracias === "string" ? cuerpo.gracias : null;
  if (esFormulario && gracias && /^https?:\/\//i.test(gracias)) {
    return NextResponse.redirect(gracias, { status: 303, headers: CORS });
  }
  return json({ ok: true, mensaje: "¡Gracias! En un momento te contactamos por WhatsApp." });
}
