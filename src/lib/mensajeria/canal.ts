import "server-only";
import type { SupabaseClient } from "@supabase/supabase-js";
import { descifrar } from "@/lib/cripto";
import { envServidor, requerirEnv } from "@/lib/env";
import type { Database } from "@/lib/supabase/database.types";
import { esquemaConfigWhatsApp, esquemaCredencialesCloud, esquemaCredencialesTwilio, type ConfigWhatsApp } from "./config";
import type { ProveedorMensajeria } from "./tipos";
import { ProveedorTwilio } from "./twilio";
import { ProveedorWhatsAppCloud } from "./whatsapp-cloud";

type Admin = SupabaseClient<Database>;

export type Canal = {
  inmobiliariaId: string;
  proveedor: ProveedorMensajeria;
  config: ConfigWhatsApp;
};

/**
 * Carga el número de WhatsApp de una inmobiliaria (por id) o identifica la
 * inmobiliaria por el número del negocio que recibió un webhook.
 */
export async function cargarCanal(admin: Admin, por: { inmobiliariaId: string } | { numeroNegocio: string }): Promise<Canal | null> {
  let consulta = admin
    .from("integraciones")
    .select("inmobiliaria_id, proveedor, identificador_externo, credenciales_cifradas, config")
    .in("proveedor", ["whatsapp_cloud", "twilio"])
    .eq("activa", true)
    .limit(1);
  consulta = "inmobiliariaId" in por ? consulta.eq("inmobiliaria_id", por.inmobiliariaId) : consulta.eq("identificador_externo", por.numeroNegocio);
  const { data } = await consulta;
  const fila = data?.[0];
  if (!fila?.credenciales_cifradas) return null;

  const secreto = JSON.parse(descifrar(fila.credenciales_cifradas, requerirEnv("ENCRYPTION_KEY"))) as unknown;
  const config = esquemaConfigWhatsApp.parse(fila.config ?? {});

  if (fila.proveedor === "whatsapp_cloud") {
    const { token } = esquemaCredencialesCloud.parse(secreto);
    return {
      inmobiliariaId: fila.inmobiliaria_id,
      config,
      proveedor: new ProveedorWhatsAppCloud({ phoneNumberId: fila.identificador_externo, token, version: envServidor().META_GRAPH_VERSION }),
    };
  }
  const t = esquemaCredencialesTwilio.parse(secreto);
  return { inmobiliariaId: fila.inmobiliaria_id, config, proveedor: new ProveedorTwilio(t) };
}
