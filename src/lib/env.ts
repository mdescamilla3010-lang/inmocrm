import { z } from "zod";

// Las variables NEXT_PUBLIC_* se referencian de forma literal para que Next.js
// las incruste en el bundle del navegador. Se validan de forma perezosa para
// que `next build` no truene si una variable de una fase futura no existe.

const esquemaPublico = z.object({
  NEXT_PUBLIC_APP_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_URL: z.url(),
  NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY: z.string().min(1),
});

const esquemaServidor = esquemaPublico.extend({
  SUPABASE_SECRET_KEY: z.string().min(1),
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
  });
  if (!r.success) {
    throw new Error(`Variables de entorno inválidas (revisa .env.local): ${formatearError(r.error)}`);
  }
  cacheServidor = r.data;
  return cacheServidor;
}
