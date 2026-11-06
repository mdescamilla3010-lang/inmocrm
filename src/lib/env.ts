import { z } from "zod";

// Las variables NEXT_PUBLIC_* se referencian de forma literal para que Next.js
// las incruste en el bundle del navegador. Se validan de forma perezosa para
// que `next build` no truene si una variable de una fase futura no existe.

const esquemaPublico = z.object({
  NEXT_PUBLIC_APP_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
});

const opcional = z
  .string()
  .optional()
  .transform((v) => (v && v.trim() ? v.trim() : undefined));

const esquemaServidor = esquemaPublico.extend({
  SUPABASE_SECRET_KEY: z.string().min(1),
  // Opcionales al arrancar: cada integración las exige al usarse (requerirEnv).
  ENCRYPTION_KEY: opcional,
  META_APP_SECRET: opcional,
  META_VERIFY_TOKEN: opcional,
  META_GRAPH_VERSION: opcional.transform((v) => v ?? "v23.0"),
  CORREO_ENTRANTE_DOMINIO: opcional,
  CORREO_ENTRANTE_SECRETO: opcional,
  ANTHROPIC_API_KEY: opcional,
  ANTHROPIC_MODEL: opcional.transform((v) => v ?? "claude-opus-5-5"),
  ANTHROPIC_EFFORT: z.enum(["low", "medium", "high", "xhigh", "max"]).default("medium"),
  WHATSAPP_APP_SECRET: opcional,
  WHATSAPP_VERIFY_TOKEN: opcional,
  AGENTE_ESPERA_MS: z.coerce.number().int().min(0).max(30_000).default(3000),
  GOOGLE_CLIENT_ID: opcional,
  GOOGLE_CLIENT_SECRET: opcional,
  CRON_SECRET: opcional,
});

export type EnvPublico = z.infer<typeof esquemaPublico>;
export type EnvServidor = z.infer<typeof esquemaServidor>;

let cachePublico: EnvPublico | undefined;
let cacheServidor: EnvServidor | undefined;

function valoresPublicos() {
  return {
    NEXT_PUBLIC_APP_URL: process.env.NEXT_PUBLIC_APP_URL,
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
  };
}

function formatearError(error: z.ZodError): string {
  return error.issues.map((i) => `${i.path.join(".")}: ${i.message}`).join("; ");
}

export function envPublico(): EnvPublico {
  if (cachePublico) return cachePublico;
  const r = esquemaPublico.safeParse(valoresPublicos());
  if (!r.success) {
    throw new Error(`Variables de entorno inválidas (revisa .env.local): ${formatearError(r.error)}`);
  }
  cachePublico = r.data;
  return cachePublico;
}

export function envServidor(): EnvServidor {
  if (typeof window !== "undefined") {
    throw new Error("envServidor() no se puede usar en el navegador");
  }
  if (cacheServidor) return cacheServidor;
  const r = esquemaServidor.safeParse({
    ...valoresPublicos(),
    SUPABASE_SECRET_KEY: process.env.SUPABASE_SECRET_KEY,
    ENCRYPTION_KEY: process.env.ENCRYPTION_KEY,
    META_APP_SECRET: process.env.META_APP_SECRET,
    META_VERIFY_TOKEN: process.env.META_VERIFY_TOKEN,
    META_GRAPH_VERSION: process.env.META_GRAPH_VERSION,
    CORREO_ENTRANTE_DOMINIO: process.env.CORREO_ENTRANTE_DOMINIO,
    CORREO_ENTRANTE_SECRETO: process.env.CORREO_ENTRANTE_SECRETO,
    ANTHROPIC_API_KEY: process.env.ANTHROPIC_API_KEY,
    ANTHROPIC_MODEL: process.env.ANTHROPIC_MODEL,
    ANTHROPIC_EFFORT: process.env.ANTHROPIC_EFFORT || undefined,
    WHATSAPP_APP_SECRET: process.env.WHATSAPP_APP_SECRET,
    WHATSAPP_VERIFY_TOKEN: process.env.WHATSAPP_VERIFY_TOKEN,
    AGENTE_ESPERA_MS: process.env.AGENTE_ESPERA_MS || undefined,
    GOOGLE_CLIENT_ID: process.env.GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET: process.env.GOOGLE_CLIENT_SECRET,
    CRON_SECRET: process.env.CRON_SECRET,
  });
  if (!r.success) {
    throw new Error(`Variables de entorno inválidas (revisa .env.local): ${formatearError(r.error)}`);
  }
  cacheServidor = r.data;
  return cacheServidor;
}

type ClaveOpcional = {
  [K in keyof EnvServidor]: undefined extends EnvServidor[K] ? K : never;
}[keyof EnvServidor];

/** Lee una variable opcional que una integración necesita; truena con un mensaje claro si falta. */
export function requerirEnv<K extends ClaveOpcional>(clave: K): NonNullable<EnvServidor[K]> {
  const valor = envServidor()[clave];
  if (valor === undefined || valor === null) {
    throw new Error(`Falta la variable de entorno ${String(clave)} (ver .env.example)`);
  }
  return valor as NonNullable<EnvServidor[K]>;
}
