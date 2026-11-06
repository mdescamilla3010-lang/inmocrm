/** Tipos de la capa de mensajería: el resto del código no conoce al proveedor. */

export type TipoMensaje = "texto" | "imagen" | "audio" | "documento" | "ubicacion" | "interactivo" | "otro";

export type MensajeEntrante = {
  /** Id del proveedor (wamid de WhatsApp / MessageSid de Twilio): llave de idempotencia. */
  idProveedor: string;
  /** Teléfono del prospecto en E.164. */
  telefono: string;
  nombrePerfil: string | null;
  tipo: TipoMensaje;
  /** Texto legible: cuerpo, pie de foto, botón elegido o descripción de lo que mandó. */
  texto: string | null;
  recibidoEn: Date;
};

export type EstadoEntrega = "enviado" | "entregado" | "leido" | "fallido";

export type ActualizacionEstado = { idProveedor: string; estado: EstadoEntrega; error: string | null };

export type EventoMensajeria = {
  /** Identifica el número del negocio (phone_number_id / número de Twilio) → la inmobiliaria. */
  numeroNegocio: string;
  mensajes: MensajeEntrante[];
  estados: ActualizacionEstado[];
};

export type Plantilla = {
  /** Nombre de la plantilla aprobada (Cloud API) o ContentSid (Twilio). */
  nombre: string;
  idioma: string;
  parametros: string[];
};

export type ResultadoEnvio = { idProveedor: string };

export interface ProveedorMensajeria {
  readonly nombre: "whatsapp_cloud" | "twilio";
  enviarTexto(para: string, texto: string): Promise<ResultadoEnvio>;
  /** Fuera de la ventana de 24 h sólo se pueden mandar plantillas aprobadas. */
  enviarPlantilla(para: string, plantilla: Plantilla): Promise<ResultadoEnvio>;
  enviarImagen(para: string, url: string, pie?: string): Promise<ResultadoEnvio>;
}

export class ErrorMensajeria extends Error {
  constructor(
    mensaje: string,
    readonly detalle?: unknown,
  ) {
    super(mensaje);
    this.name = "ErrorMensajeria";
  }
}

/** Ventana de servicio de WhatsApp: se puede escribir libre hasta 24 h después del último mensaje del cliente. */
export const VENTANA_MS = 24 * 60 * 60 * 1000;

export function dentroDeVentana(ultimoEntrante: Date | string | null, ahora: Date = new Date()): boolean {
  if (!ultimoEntrante) return false;
  return ahora.getTime() - new Date(ultimoEntrante).getTime() < VENTANA_MS;
}
