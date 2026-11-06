import type { Intervalo } from "./disponibilidad";

export type EventoCalendario = {
  inicio: Date;
  fin: Date;
  titulo: string;
  descripcion: string;
  ubicacion: string | null;
  zonaHoraria: string;
  /** Para encontrar el evento desde InmoCRM. */
  citaId: string;
};

/** Calendario de un asesor. El resto del código no conoce a Google. */
export interface ProveedorCalendario {
  ocupados(desde: Date, hasta: Date): Promise<Intervalo[]>;
  crearEvento(evento: EventoCalendario): Promise<{ id: string; enlace: string | null }>;
  cancelarEvento(id: string): Promise<void>;
}

export class ErrorCalendario extends Error {
  constructor(
    mensaje: string,
    /** true si el asesor debe volver a conectar su calendario (token revocado). */
    readonly requiereReconectar = false,
  ) {
    super(mensaje);
    this.name = "ErrorCalendario";
  }
}
