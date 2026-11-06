import "server-only";
import Anthropic from "@anthropic-ai/sdk";
import { envServidor, requerirEnv } from "@/lib/env";
import type { ClienteModelo } from "./bucle";

let cliente: Anthropic | undefined;

/**
 * Cliente real de Claude para el bucle del agente.
 * - Modelo y esfuerzo por variable de entorno (por defecto claude-opus-5-5, effort medium).
 * - Respaldo del lado del servidor (`fallbacks: "default"`): si el modelo
 *   declina por política, otro modelo contesta en la misma llamada.
 * - Caché: herramientas + prompt de sistema (estables por inmobiliaria) quedan
 *   cacheados con el breakpoint del sistema; el historial va después.
 */
export function crearClienteModelo(): ClienteModelo {
  const env = envServidor();
  cliente ??= new Anthropic({ apiKey: requerirEnv("ANTHROPIC_API_KEY"), maxRetries: 2, timeout: 45_000 });
  const anthropic = cliente;

  return async ({ sistema, herramientas, mensajes }) =>
    anthropic.beta.messages.create({
      model: env.ANTHROPIC_MODEL,
      max_tokens: 4096,
      output_config: { effort: env.ANTHROPIC_EFFORT },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: [{ type: "text", text: sistema, cache_control: { type: "ephemeral" } }],
      tools: herramientas,
      messages: mensajes,
    });
}
