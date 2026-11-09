import type Anthropic from "@anthropic-ai/sdk";
import type { ClienteModelo } from "./bucle";

export type OpcionesModelo = {
  modelo: string;
  esfuerzo: "low" | "medium" | "high" | "xhigh" | "max";
};

/**
 * Arma el ClienteModelo sobre un cliente de Anthropic. Separado de modelo.ts
 * (server-only) para poder usarlo también en scripts de prueba.
 * - `fallbacks: "default"`: si el modelo declina por política, otro modelo
 *   contesta en la misma llamada.
 * - Herramientas + prompt de sistema quedan en la caché (breakpoint en el sistema).
 */
export function clienteModeloCon(anthropic: Anthropic, opciones: OpcionesModelo): ClienteModelo {
  return async ({ sistema, herramientas, mensajes }) =>
    anthropic.beta.messages.create({
      model: opciones.modelo,
      max_tokens: 4096,
      output_config: { effort: opciones.esfuerzo },
      betas: ["server-side-fallback-2026-07-01"],
      fallbacks: "default",
      system: [{ type: "text", text: sistema, cache_control: { type: "ephemeral" } }],
      tools: herramientas,
      messages: mensajes,
    });
}
