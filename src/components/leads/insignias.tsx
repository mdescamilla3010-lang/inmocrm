import { Insignia, type Tono } from "@/components/ui/insignia";
import { ETIQUETA_ESTADO, ETIQUETA_SCORE } from "@/lib/leads/etiquetas";
import type { Database } from "@/lib/supabase/database.types";

type E = Database["public"]["Enums"];

const TONO_SCORE: Record<E["score_lead"], Tono> = { caliente: "rojo", tibio: "ambar", frio: "azul" };

const TONO_ESTADO: Record<E["estado_lead"], Tono> = {
  nuevo: "violeta",
  en_conversacion: "azul",
  calificado: "ambar",
  cita_agendada: "verde",
  visita_realizada: "verde",
  ganado: "verde",
  perdido: "gris",
  descartado: "gris",
};

export function InsigniaScore({ score }: { score: E["score_lead"] | null }) {
  if (!score) return <Insignia>Sin score</Insignia>;
  return <Insignia tono={TONO_SCORE[score]}>{ETIQUETA_SCORE[score]}</Insignia>;
}

export function InsigniaEstado({ estado }: { estado: E["estado_lead"] }) {
  return <Insignia tono={TONO_ESTADO[estado]}>{ETIQUETA_ESTADO[estado]}</Insignia>;
}
