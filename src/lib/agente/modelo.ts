import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { envServidor, requerirEnv } from "@/lib/env";
import type { ClienteModelo } from "./bucle";
import { clienteModeloCon } from "./modelo-config";

let cliente: Anthropic | undefined;

/** Cliente real de Claude para el agente; modelo y esfuerzo por variables de entorno. */
export function crearClienteModelo(): ClienteModelo {
  const env = envServidor();
  cliente ??= new Anthropic({ apiKey: requerirEnv("ANTHROPIC_API_KEY"), maxRetries: 2, timeout: 45_000 });
  return clienteModeloCon(cliente, { modelo: env.ANTHROPIC_MODEL, esfuerzo: env.ANTHROPIC_EFFORT });
}
