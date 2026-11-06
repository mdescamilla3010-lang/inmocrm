import type { Metadata } from "next";
import { describirHorario } from "@/lib/agente/prompt";
import { requerirDueno } from "@/lib/auth/sesion";
import { crearClienteServidor } from "@/lib/supabase/server";
import { FormularioAgente } from "./formulario";

export const metadata: Metadata = { title: "Agente IA" };

export default async function PaginaAgente() {
  const dueno = await requerirDueno();
  const supabase = await crearClienteServidor();
  const { data: inmo } = await supabase
    .from("inmobiliarias")
    .select("agente_nombre, agente_instrucciones, horario_visitas")
    .eq("id", dueno.inmobiliariaId)
    .single();

  return (
    <section className="space-y-6">
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <h2 className="text-base font-semibold">Tu agente de WhatsApp</h2>
        <p className="mb-4 mt-1 text-sm text-slate-600">
          Contesta las 24 horas, en español de México. Pregunta presupuesto, zona, tipo de propiedad, forma de pago y
          urgencia; recomienda propiedades de tu catálogo y califica cada lead como caliente, tibio o frío. Pasa la
          conversación a un asesor cuando el prospecto lo pide, quiere negociar, tiene una queja o no logra entenderle.
        </p>
        <FormularioAgente inicial={{ agenteNombre: inmo?.agente_nombre ?? "", agenteInstrucciones: inmo?.agente_instrucciones ?? "" }} />
      </div>
      <div className="rounded-xl border border-slate-200 bg-white p-5 text-sm">
        <h2 className="text-base font-semibold">Horario de visitas</h2>
        <p className="mt-1 text-slate-600">
          El agente sólo propone visitas en este horario: <span className="font-medium text-slate-900">{describirHorario(inmo?.horario_visitas)}</span>.
          Se podrá editar junto con la agenda (fase 4).
        </p>
      </div>
    </section>
  );
}
