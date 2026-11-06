import { z } from "zod";
import { Constants } from "@/lib/supabase/database.types";

const E = Constants.public.Enums;
const opcional = <T extends z.ZodType>(s: T) => s.optional().catch(undefined);

/** Filtros de la bandeja desde la URL; valores inválidos se ignoran. */
export const esquemaFiltros = z.object({
  estado: opcional(z.enum(E.estado_lead)),
  fuente: opcional(z.enum(E.fuente_lead)),
  score: opcional(z.enum([...E.score_lead, "sin_score"])),
  asesor: opcional(z.union([z.uuid(), z.literal("sin_asignar")])),
  q: opcional(z.string().trim().max(80)),
  atencion: opcional(z.literal("1")),
  pagina: z.coerce.number().int().min(1).max(1000).catch(1),
});

export type Filtros = z.infer<typeof esquemaFiltros>;
