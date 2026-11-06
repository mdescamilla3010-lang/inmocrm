import type Anthropic from "@anthropic-ai/sdk";

export type PeticionModelo = {
  sistema: string;
  herramientas: Anthropic.Beta.BetaTool[];
  mensajes: Anthropic.Beta.BetaMessageParam[];
};

/** Abstracción del cliente para poder probar el bucle sin llamar a la API. */
export type ClienteModelo = (p: PeticionModelo) => Promise<Pick<Anthropic.Beta.BetaMessage, "content" | "stop_reason">>;

export type ResultadoHerramienta = { contenido: string; esError?: boolean };
export type EjecutorHerramienta = (nombre: string, entrada: unknown) => Promise<ResultadoHerramienta>;

export type ResultadoBucle = {
  texto: string;
  fin: "respuesta" | "rechazo" | "max_tokens" | "max_iteraciones";
  herramientas: { nombre: string; esError: boolean }[];
};

/**
 * Bucle de tool use: llama al modelo, ejecuta las herramientas que pida (todas
 * las del mismo turno, con sus resultados en UN solo mensaje) y repite hasta
 * que conteste con texto.
 */
export async function ejecutarBucle(args: {
  cliente: ClienteModelo;
  sistema: string;
  herramientas: Anthropic.Beta.BetaTool[];
  mensajes: Anthropic.Beta.BetaMessageParam[];
  ejecutar: EjecutorHerramienta;
  maxIteraciones?: number;
}): Promise<ResultadoBucle> {
  const mensajes = [...args.mensajes];
  const usadas: ResultadoBucle["herramientas"] = [];
  const max = args.maxIteraciones ?? 6;

  for (let i = 0; i < max; i++) {
    const respuesta = await args.cliente({ sistema: args.sistema, herramientas: args.herramientas, mensajes: [...mensajes] });
    const texto = respuesta.content
      .filter((b): b is Anthropic.Beta.BetaTextBlock => b.type === "text")
      .map((b) => b.text)
      .join("\n")
      .trim();

    if (respuesta.stop_reason === "refusal") return { texto: "", fin: "rechazo", herramientas: usadas };
    if (respuesta.stop_reason === "max_tokens") return { texto, fin: "max_tokens", herramientas: usadas };

    // Se agrega el contenido completo (incluidos bloques de thinking) tal cual.
    mensajes.push({ role: "assistant", content: respuesta.content });

    if (respuesta.stop_reason === "pause_turn") continue;

    const llamadas = respuesta.content.filter((b): b is Anthropic.Beta.BetaToolUseBlock => b.type === "tool_use");
    if (respuesta.stop_reason !== "tool_use" || !llamadas.length) {
      return { texto, fin: "respuesta", herramientas: usadas };
    }

    const resultados: Anthropic.Beta.BetaToolResultBlockParam[] = [];
    for (const llamada of llamadas) {
      let r: ResultadoHerramienta;
      try {
        r = await args.ejecutar(llamada.name, llamada.input);
      } catch (e) {
        r = { contenido: `Error al ejecutar ${llamada.name}: ${e instanceof Error ? e.message : String(e)}`, esError: true };
      }
      usadas.push({ nombre: llamada.name, esError: Boolean(r.esError) });
      resultados.push({ type: "tool_result", tool_use_id: llamada.id, content: r.contenido, ...(r.esError ? { is_error: true } : {}) });
    }
    mensajes.push({ role: "user", content: resultados });
  }
  return { texto: "", fin: "max_iteraciones", herramientas: usadas };
}
