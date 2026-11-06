import { esquemaLeadGraph, type LeadGraph } from "./meta";

/**
 * Pide a la Graph API los datos de un lead. El token va en el header (no en
 * la URL) para que no quede en logs de proxies.
 */
export async function obtenerLeadMeta(args: {
  leadgenId: string;
  tokenPagina: string;
  version: string;
  fetchFn?: typeof fetch;
}): Promise<LeadGraph> {
  const f = args.fetchFn ?? fetch;
  const url = new URL(`https://graph.facebook.com/${args.version}/${encodeURIComponent(args.leadgenId)}`);
  url.searchParams.set("fields", "id,created_time,ad_id,form_id,campaign_id,field_data");
  const respuesta = await f(url, {
    headers: { Authorization: `Bearer ${args.tokenPagina}` },
    signal: AbortSignal.timeout(10_000),
  });
  const cuerpo: unknown = await respuesta.json().catch(() => null);
  if (!respuesta.ok) {
    const mensaje = (cuerpo as { error?: { message?: string } } | null)?.error?.message ?? `HTTP ${respuesta.status}`;
    throw new Error(`Graph API: ${mensaje}`);
  }
  const r = esquemaLeadGraph.safeParse(cuerpo);
  if (!r.success) throw new Error("Graph API: respuesta con formato inesperado");
  return r.data;
}
