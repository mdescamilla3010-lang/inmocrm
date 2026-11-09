import { Insignia } from "@/components/ui/insignia";
import { formatearFechaHora } from "@/lib/formato";
import { dentroDeVentana } from "@/lib/mensajeria/tipos";
import type { Database } from "@/lib/supabase/database.types";
import { BotonesControlIA, FormMensajeAsesor } from "./conversacion-acciones";

type Mensaje = Pick<
  Database["public"]["Tables"]["mensajes"]["Row"],
  "id" | "direccion" | "autor" | "asesor_id" | "tipo" | "contenido" | "estado" | "error" | "creado_en" | "metadatos"
>;
type Conversacion = Pick<
  Database["public"]["Tables"]["conversaciones"]["Row"],
  "ia_activa" | "requiere_atencion" | "motivo_escalamiento" | "resumen" | "ultimo_entrante_en"
>;

const MOTIVO: Record<string, string> = {
  pide_humano: "Pidió hablar con una persona",
  negociacion: "Quiere negociar",
  queja: "Tiene una queja",
  no_entiende: "El agente no logró entenderle",
  pregunta_especializada: "Pregunta especializada",
  visita: "Quiere agendar una visita: confirma el horario",
  otro: "Necesita atención",
};

const ESTADO_ENTREGA: Record<string, string> = { enviado: "✓", entregado: "✓✓", leido: "✓✓ leído", fallido: "no se entregó" };

type Accion = () => Promise<void>;
type AccionForm = Parameters<typeof FormMensajeAsesor>[0]["accion"];

export function Conversacion(props: {
  conversacion: Conversacion | null;
  mensajes: Mensaje[];
  nombres: Record<string, string>;
  zonaHoraria: string;
  nombreAgente: string;
  acciones: { tomar: Accion; devolver: Accion; atendido: Accion; enviar: AccionForm };
}) {
  const { conversacion: c, mensajes } = props;
  if (!c) {
    return <p className="text-sm text-slate-600">Todavía no hay conversación de WhatsApp con este prospecto.</p>;
  }
  const ventanaAbierta = dentroDeVentana(c.ultimo_entrante_en);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        {c.ia_activa ? <Insignia tono="verde">{props.nombreAgente} (IA) atiende</Insignia> : <Insignia tono="ambar">Atiende un asesor</Insignia>}
        {c.requiere_atencion ? <Insignia tono="rojo">Requiere atención</Insignia> : null}
        <div className="ml-auto">
          <BotonesControlIA iaActiva={c.ia_activa} requiereAtencion={c.requiere_atencion} {...props.acciones} />
        </div>
      </div>

      {c.requiere_atencion ? (
        <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-900">
          <p className="font-medium">{MOTIVO[c.motivo_escalamiento ?? "otro"] ?? c.motivo_escalamiento}</p>
          {c.resumen ? <p className="mt-1">{c.resumen}</p> : null}
        </div>
      ) : null}

      <ol className="max-h-[32rem] space-y-2 overflow-y-auto rounded-lg bg-slate-50 p-3">
        {mensajes.map((m) => {
          const nuestro = m.direccion === "saliente";
          const quien =
            m.autor === "prospecto" ? null : m.autor === "agente" ? props.nombreAgente : m.autor === "asesor" ? (props.nombres[m.asesor_id ?? ""] ?? "Asesor") : "Sistema";
          const url = m.tipo === "imagen" ? ((m.metadatos as { url?: string } | null)?.url ?? null) : null;
          return (
            <li key={m.id} className={`flex ${nuestro ? "justify-end" : "justify-start"}`}>
              <div
                className={`max-w-[85%] rounded-2xl px-3 py-2 text-sm shadow-sm ${
                  nuestro ? (m.autor === "asesor" ? "bg-sky-100" : "bg-emerald-100") : "bg-white"
                } ${m.estado === "fallido" ? "ring-1 ring-red-300" : ""}`}
              >
                {quien ? <p className="mb-0.5 text-xs font-medium text-slate-500">{quien}{m.tipo === "plantilla" ? " · plantilla" : ""}</p> : null}
                {url ? (
                  // eslint-disable-next-line @next/next/no-img-element -- URL pública de Storage
                  <img src={url} alt="" className="mb-1 max-h-48 rounded-lg" loading="lazy" />
                ) : null}
                {m.contenido ? <p className="whitespace-pre-line text-slate-900">{m.contenido}</p> : null}
                <p className="mt-1 text-right text-[11px] text-slate-500">
                  {formatearFechaHora(m.creado_en, props.zonaHoraria)}
                  {nuestro ? ` · ${ESTADO_ENTREGA[m.estado] ?? m.estado}` : ""}
                </p>
                {m.error ? <p className="text-xs text-red-700">{m.error}</p> : null}
              </div>
            </li>
          );
        })}
      </ol>

      {ventanaAbierta ? (
        <FormMensajeAsesor accion={props.acciones.enviar} iaActiva={c.ia_activa} />
      ) : (
        <p className="text-sm text-slate-600">
          Pasaron más de 24 h desde su último mensaje: WhatsApp sólo permite escribirle con una plantilla aprobada. Cuando
          vuelva a escribir podrás contestarle aquí.
        </p>
      )}
    </div>
  );
}
