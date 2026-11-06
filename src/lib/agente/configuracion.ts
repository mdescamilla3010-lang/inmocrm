import { z } from "zod";

export const esquemaConfigAgente = z.object({
  agenteNombre: z.string({ error: "Escribe un nombre" }).trim().min(2, { error: "Nombre muy corto" }).max(40, { error: "Nombre muy largo" }),
  agenteInstrucciones: z
    .string()
    .trim()
    .max(4000, { error: "Máximo 4,000 caracteres" })
    .optional()
    .transform((v) => v || null),
});

export const esquemaMensajeAsesor = z.object({
  texto: z.string().trim().min(1, { error: "Escribe el mensaje" }).max(4000, { error: "El mensaje es muy largo" }),
});
