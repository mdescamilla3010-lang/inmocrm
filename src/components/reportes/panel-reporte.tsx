import { formatearDuracion, formatearPorcentaje, proporcion, variacion, type Reporte } from "@/lib/reportes/formato";
import { ETIQUETA_FUENTE } from "@/lib/leads/etiquetas";
import { BarrasHorizontales, ColumnasPorDia, TarjetaIndicador } from "./graficas";

type Props = { actual: Reporte; anterior: Reporte | null; zonaHoraria: string; etiquetaPeriodo: string };

const fmtNum = new Intl.NumberFormat("es-MX");

function Seccion({ titulo, descripcion, children }: { titulo: string; descripcion?: string; children: React.ReactNode }) {
  return (
    <section className="rounded-xl border border-slate-200 bg-white p-5">
      <h2 className="text-base font-semibold">{titulo}</h2>
      {descripcion ? <p className="mt-1 text-sm text-slate-600">{descripcion}</p> : null}
      <div className="mt-4">{children}</div>
    </section>
  );
}

/** Vista del reporte del dueño; recibe los datos ya calculados (no consulta nada). */
export function PanelReporte({ actual: r, anterior: a, zonaHoraria, etiquetaPeriodo }: Props) {
  const contra = "vs. periodo anterior";
  const aCita = proporcion(r.embudo.con_cita, r.leads);
  const visitas = r.por_asesor.reduce((s, x) => s + x.visitas_realizadas, 0);
  const visitasAnt = a ? a.por_asesor.reduce((s, x) => s + x.visitas_realizadas, 0) : null;
  const menos1 = proporcion(r.respuesta.menos_1_min, r.respuesta.medidos);

  if (r.leads === 0 && visitas === 0 && r.por_asesor.every((x) => x.citas === 0)) {
    return (
      <div className="rounded-xl border border-dashed border-slate-300 bg-white p-10 text-center">
        <p className="font-medium text-slate-900">Sin actividad en {etiquetaPeriodo.toLowerCase()}</p>
        <p className="mt-1 text-sm text-slate-600">Cuando lleguen leads y se agenden visitas, verás aquí cómo va tu inmobiliaria.</p>
      </div>
    );
  }

  const fmtDiaCorto = new Intl.DateTimeFormat("es-MX", { day: "numeric", month: "short", timeZone: "UTC" });
  const fmtDiaLargo = new Intl.DateTimeFormat("es-MX", { weekday: "short", day: "numeric", month: "short", timeZone: "UTC" });
  const embudo = [
    { clave: "leads", etiqueta: "Llegaron", valor: r.embudo.leads },
    { clave: "contactados", etiqueta: "Les escribimos", valor: r.embudo.contactados },
    { clave: "respondieron", etiqueta: "Respondieron", valor: r.embudo.respondieron },
    { clave: "con_cita", etiqueta: "Agendaron visita", valor: r.embudo.con_cita },
    { clave: "visitaron", etiqueta: "Visitaron", valor: r.embudo.visitaron },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 gap-4 lg:grid-cols-5">
        <TarjetaIndicador
          destacado
          etiqueta="Leads que llegan a cita"
          valor={formatearPorcentaje(aCita)}
          detalle={`${fmtNum.format(r.embudo.con_cita)} de ${fmtNum.format(r.leads)} leads agendaron visita`}
          variacion={variacion(aCita, a ? proporcion(a.embudo.con_cita, a.leads) : null, { esProporcion: true })}
          contra={contra}
        />
        <TarjetaIndicador etiqueta="Leads nuevos" valor={fmtNum.format(r.leads)} variacion={variacion(r.leads, a?.leads ?? null)} contra={contra} />
        <TarjetaIndicador
          etiqueta="Tiempo promedio de respuesta"
          valor={formatearDuracion(r.respuesta.promedio_seg)}
          detalle={r.respuesta.medidos ? `Mediana ${formatearDuracion(r.respuesta.mediana_seg)} · ${formatearPorcentaje(menos1)} en menos de 1 min` : "Sin leads contactados"}
          variacion={variacion(r.respuesta.promedio_seg, a?.respuesta.promedio_seg ?? null, { mejorSiBaja: true })}
          contra={contra}
        />
        <TarjetaIndicador etiqueta="Visitas realizadas" valor={fmtNum.format(visitas)} variacion={variacion(visitas, visitasAnt)} contra={contra} />
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <Seccion titulo="Del anuncio a la visita" descripcion="Cuántos leads del periodo avanzaron en cada paso.">
          <BarrasHorizontales
            titulo="Embudo de leads"
            filas={embudo.map((e) => {
              const p = proporcion(e.valor, r.embudo.leads);
              return {
                clave: e.clave,
                etiqueta: e.etiqueta,
                valor: e.valor,
                textoValor: e.clave === "leads" ? fmtNum.format(e.valor) : `${fmtNum.format(e.valor)} · ${formatearPorcentaje(p)}`,
                tooltip: `${e.etiqueta}: ${fmtNum.format(e.valor)} (${formatearPorcentaje(p)} de los leads)`,
              };
            })}
          />
          {r.respuesta.sin_contacto ? (
            <p className="mt-4 text-sm text-amber-800">
              {fmtNum.format(r.respuesta.sin_contacto)} {r.respuesta.sin_contacto === 1 ? "lead no ha recibido" : "leads no han recibido"} ningún mensaje (revisa
              la plantilla de bienvenida en Integraciones).
            </p>
          ) : null}
        </Seccion>

        <Seccion titulo="Leads por día" descripcion={`Leads nuevos cada día (hora local), ${etiquetaPeriodo.toLowerCase()}.`}>
          <ColumnasPorDia
            titulo="Leads nuevos por día"
            columnas={r.por_dia.map((d) => {
              const fecha = new Date(`${d.dia}T12:00:00Z`);
              return {
                clave: d.dia,
                etiquetaCorta: fmtDiaCorto.format(fecha),
                valor: d.leads,
                tooltip: `${fmtDiaLargo.format(fecha)}: ${d.leads} ${d.leads === 1 ? "lead" : "leads"}, ${d.con_cita} ${d.con_cita === 1 ? "llegó" : "llegaron"} a cita`,
              };
            })}
          />
        </Seccion>
      </div>

      <Seccion titulo="Leads por fuente" descripcion="De dónde llegan y cuáles terminan en visita.">
        {r.por_fuente.length ? (
          <>
            <BarrasHorizontales
              titulo="Leads por fuente"
              filas={r.por_fuente.map((f) => ({
                clave: f.fuente,
                etiqueta: ETIQUETA_FUENTE[f.fuente as keyof typeof ETIQUETA_FUENTE] ?? f.fuente,
                valor: f.leads,
                textoValor: fmtNum.format(f.leads),
                tooltip: `${ETIQUETA_FUENTE[f.fuente as keyof typeof ETIQUETA_FUENTE] ?? f.fuente}: ${f.leads} leads, ${formatearPorcentaje(proporcion(f.con_cita, f.leads))} a cita`,
              }))}
            />
            <div className="mt-5 overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="py-2 pr-4">Fuente</th>
                    <th className="py-2 pr-4 text-right">Leads</th>
                    <th className="py-2 pr-4 text-right">% a cita</th>
                    <th className="py-2 pr-4 text-right">Calientes</th>
                    <th className="py-2 text-right">Respuesta (mediana)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 tabular-nums">
                  {r.por_fuente.map((f) => (
                    <tr key={f.fuente}>
                      <td className="py-2 pr-4">{ETIQUETA_FUENTE[f.fuente as keyof typeof ETIQUETA_FUENTE] ?? f.fuente}</td>
                      <td className="py-2 pr-4 text-right">{fmtNum.format(f.leads)}</td>
                      <td className="py-2 pr-4 text-right">{formatearPorcentaje(proporcion(f.con_cita, f.leads))}</td>
                      <td className="py-2 pr-4 text-right">{fmtNum.format(f.calientes)}</td>
                      <td className="py-2 text-right">{f.fuente === "manual" ? "—" : formatearDuracion(f.mediana_resp_seg)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        ) : (
          <p className="text-sm text-slate-600">Sin leads en el periodo.</p>
        )}
      </Seccion>

      <Seccion titulo="Visitas por asesor" descripcion="Visitas con fecha dentro del periodo y leads que se le asignaron.">
        <div className="overflow-x-auto">
          <table className="min-w-full text-sm">
            <thead className="text-left text-xs font-semibold uppercase tracking-wide text-slate-500">
              <tr>
                <th className="py-2 pr-4">Asesor</th>
                <th className="py-2 pr-4">Visitas realizadas</th>
                <th className="py-2 pr-4 text-right">No asistió</th>
                <th className="py-2 pr-4 text-right">Canceladas</th>
                <th className="py-2 pr-4 text-right">Por venir</th>
                <th className="py-2 pr-4 text-right">Leads asignados</th>
                <th className="py-2 text-right">% a cita</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 tabular-nums">
              {r.por_asesor.map((x) => {
                const maxVisitas = Math.max(1, ...r.por_asesor.map((y) => y.visitas_realizadas));
                return (
                  <tr key={x.asesor_id}>
                    <td className="min-w-40 py-2 pr-4">
                      {x.nombre}
                      {!x.activo ? <span className="text-xs text-slate-400"> (inactivo)</span> : null}
                      {x.agendadas_por_agente ? <span className="block text-xs text-slate-500">{x.agendadas_por_agente} agendadas por el agente</span> : null}
                    </td>
                    <td className="py-2 pr-4">
                      <span className="flex min-w-32 items-center gap-2">
                        <span
                          className="block h-3 rounded-r bg-[var(--viz-serie)]"
                          style={{ width: `${(x.visitas_realizadas / maxVisitas) * 6}rem`, minWidth: x.visitas_realizadas ? "2px" : 0 }}
                          aria-hidden="true"
                        />
                        {fmtNum.format(x.visitas_realizadas)}
                      </span>
                    </td>
                    <td className="py-2 pr-4 text-right">{fmtNum.format(x.no_asistio)}</td>
                    <td className="py-2 pr-4 text-right">{fmtNum.format(x.canceladas)}</td>
                    <td className="py-2 pr-4 text-right">{fmtNum.format(x.pendientes)}</td>
                    <td className="py-2 pr-4 text-right">{fmtNum.format(x.leads_asignados)}</td>
                    <td className="py-2 text-right">{formatearPorcentaje(proporcion(x.leads_con_cita, x.leads_asignados))}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {r.sin_asignar ? (
          <p className="mt-3 text-sm text-amber-800">
            {fmtNum.format(r.sin_asignar)} {r.sin_asignar === 1 ? "lead quedó" : "leads quedaron"} sin asesor (nadie recibía leads cuando llegó).
          </p>
        ) : null}
      </Seccion>

      <p className="text-xs text-slate-500">
        Score de los leads del periodo: {fmtNum.format(r.por_score.caliente)} calientes · {fmtNum.format(r.por_score.tibio)} tibios ·{" "}
        {fmtNum.format(r.por_score.frio)} fríos · {fmtNum.format(r.por_score.sin_score)} sin calificar. Zona horaria: {zonaHoraria}.
      </p>
    </div>
  );
}
