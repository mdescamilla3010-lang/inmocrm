import { z } from "zod";
import { normalizarTelefono } from "@/lib/telefono";

const texto = (max: number) =>
  z
    .string()
    .trim()
    .max(max)
    .optional()
    .transform((v) => (v ? v : null));

/**
 * Cuerpo que aceptan los formularios de landing (JSON o form-urlencoded).
 * `sitio_web` es un honeypot: un humano no lo ve ni lo llena.
 */
export const esquemaLanding = z
  .object({
    clave: z.string().trim().min(16).max(64),
    nombre: texto(120),
    telefono: texto(40),
    email: texto(200),
    mensaje: texto(2000),
    propiedad: texto(60),
    zona: texto(120),
    pagina: texto(500),
    utm_source: texto(120),
    utm_medium: texto(120),
    utm_campaign: texto(200),
    utm_content: texto(200),
    sitio_web: texto(200),
  })
  .transform((d, ctx) => {
    const telefono = normalizarTelefono(d.telefono);
    const email = d.email && z.email().safeParse(d.email.toLowerCase()).success ? d.email.toLowerCase() : null;
    if (d.telefono && !telefono && !email) {
      ctx.addIssue({ code: "custom", path: ["telefono"], message: "Teléfono no válido" });
      return z.NEVER;
    }
    if (!telefono && !email) {
      ctx.addIssue({ code: "custom", path: ["telefono"], message: "Deja un teléfono o un correo" });
      return z.NEVER;
    }
    const utm = Object.fromEntries(
      (["utm_source", "utm_medium", "utm_campaign", "utm_content"] as const)
        .filter((k) => d[k])
        .map((k) => [k, d[k]]),
    );
    return {
      clave: d.clave,
      nombre: d.nombre,
      telefono,
      email,
      mensaje: d.mensaje,
      propiedad: d.propiedad,
      zona: d.zona,
      pagina: d.pagina,
      utm,
      esSpam: Boolean(d.sitio_web),
    };
  });

export type EnvioLanding = z.output<typeof esquemaLanding>;
