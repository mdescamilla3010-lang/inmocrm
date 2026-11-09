import { z } from "zod";
import { PATRON_SLUG, generarSlug } from "@/lib/slug";
import { normalizarTelefono } from "@/lib/telefono";

const email = z
  .string({ error: "Escribe tu correo" })
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "Correo no válido" }));

const contrasena = z
  .string({ error: "Escribe una contraseña" })
  .min(8, { error: "La contraseña debe tener al menos 8 caracteres" })
  .max(72, { error: "La contraseña es demasiado larga" });

const nombrePersona = z
  .string({ error: "Escribe el nombre" })
  .trim()
  .min(2, { error: "El nombre es muy corto" })
  .max(80, { error: "El nombre es muy largo" });

const nombreInmobiliaria = z
  .string({ error: "Escribe el nombre de la inmobiliaria" })
  .trim()
  .min(2, { error: "El nombre es muy corto" })
  .max(120, { error: "El nombre es muy largo" });

const checkbox = z.preprocess((v) => v === "on" || v === "true" || v === true, z.boolean());

export const rolSchema = z.enum(["dueno", "asesor"], { error: "Rol no válido" });

export const esquemaLogin = z.object({
  email,
  password: z.string().min(1, { error: "Escribe tu contraseña" }),
  next: z.string().optional(),
});

export const esquemaRegistro = z.object({
  nombre: nombrePersona,
  email,
  password: contrasena,
  nombreInmobiliaria,
});

/** Si no mandan slug se genera del nombre de la inmobiliaria. */
export const esquemaCrearInmobiliaria = z
  .object({
    nombreInmobiliaria,
    nombreDueno: nombrePersona,
    slug: z.string().trim().toLowerCase().optional(),
  })
  .transform((d) => ({ ...d, slug: d.slug ? d.slug : generarSlug(d.nombreInmobiliaria) }))
  .refine((d) => PATRON_SLUG.test(d.slug), {
    path: ["slug"],
    error: "Usa de 3 a 40 letras minúsculas, números o guiones (sin acentos ni espacios)",
  });

export const esquemaRecuperar = z.object({ email });

export const esquemaNuevaContrasena = z
  .object({ password: contrasena, confirmacion: z.string() })
  .refine((d) => d.password === d.confirmacion, {
    path: ["confirmacion"],
    error: "Las contraseñas no coinciden",
  });

const telefonoOpcional = z
  .string()
  .trim()
  .optional()
  .transform((v, ctx) => {
    if (!v) return null;
    const n = normalizarTelefono(v);
    if (!n) {
      ctx.addIssue({ code: "custom", message: "Teléfono no válido" });
      return z.NEVER;
    }
    return n;
  });

export const esquemaInvitacion = z.object({
  nombre: nombrePersona,
  email,
  rol: rolSchema,
  telefono: telefonoOpcional,
});

export const esquemaMiembro = z.object({
  id: z.uuid({ error: "Usuario no válido" }),
  rol: rolSchema,
  activo: checkbox,
  recibeLeads: checkbox,
});

/** Errores por campo listos para mostrar debajo de cada input. */
export function erroresPorCampo(error: z.ZodError): Record<string, string> {
  const salida: Record<string, string> = {};
  for (const issue of error.issues) {
    const campo = String(issue.path[0] ?? "_");
    salida[campo] ??= issue.message;
  }
  return salida;
}

export function objetoDeFormulario(fd: FormData): Record<string, string> {
  const salida: Record<string, string> = {};
  fd.forEach((valor, clave) => {
    if (typeof valor === "string") salida[clave] = valor;
  });
  return salida;
}

export const esquemaPerfil = z.object({
  nombre: nombrePersona,
  telefono: telefonoOpcional,
  googleCalendarId: z
    .string()
    .trim()
    .max(200)
    .optional()
    .transform((v) => v || "primary"),
});
