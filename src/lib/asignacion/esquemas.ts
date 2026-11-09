import { z } from "zod";

export const esquemaEstrategia = z.object({
  estrategia: z.enum(["round_robin", "zona"], { error: "Elige una estrategia" }),
});

export const esquemaZona = z.object({
  nombre: z.string({ error: "Escribe el nombre" }).trim().min(2, { error: "Nombre muy corto" }).max(80, { error: "Nombre muy largo" }),
  alias: z
    .string()
    .optional()
    .transform((v) => [...new Set((v ?? "").split(/[,\n]/).map((a) => a.trim()).filter(Boolean))].slice(0, 30)),
  asesores: z.array(z.uuid()).default([]),
});
