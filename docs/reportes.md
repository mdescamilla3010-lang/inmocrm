# Reportes del dueño

**Reportes** (sólo dueño) responde: ¿cuántos leads llegan, qué tan rápido les
contestamos, cuántos terminan en visita y cómo le va a cada asesor?

## Periodos

Últimos 7, 30 o 90 días (días completos en la hora local de la inmobiliaria,
incluido hoy), este mes (del día 1 a hoy) o el mes anterior. Cada indicador se
compara contra el periodo inmediato anterior de la misma duración; "este mes" se
compara contra los mismos días del mes anterior.

## Definiciones

| Indicador | Cómo se calcula |
|---|---|
| **Leads que llegan a cita** | Leads creados en el periodo con al menos una cita (cualquier estado) ÷ leads del periodo. Variación en puntos porcentuales. |
| **Leads nuevos** | Leads creados en el periodo. |
| **Tiempo promedio de respuesta** | Primer mensaje que les enviamos − llegada del lead. Se muestran promedio, mediana y % en menos de 1 minuto (la meta del producto). No incluye leads capturados a mano. |
| **Visitas realizadas** | Citas con fecha dentro del periodo marcadas como realizadas. |
| **Embudo** | De los leads del periodo: les escribimos → respondieron por WhatsApp → agendaron visita → visitaron. |
| **Leads por fuente** | Por fuente: leads, % a cita, calientes y mediana de respuesta. |
| **Leads por día** | Leads creados cada día, agrupados por fecha local. |
| **Visitas por asesor** | Por asesor: visitas realizadas, no asistió, canceladas y por venir (por fecha de la cita), leads asignados en el periodo y su % a cita. |

Para que "Visitas realizadas" sea confiable, el equipo debe marcar cada visita
como *realizada* o *no asistió* en **Citas** (la página avisa cuando hay
visitas pasadas sin cerrar).

## Implementación

- Todo se agrega en Postgres con `public.reporte_dueno(desde, hasta)`
  (`security invoker`: aplica RLS y exige rol dueño). La app no descarga filas.
- Probado con pgTAP en `supabase/tests/reportes.test.sql`, con valores
  calculados a mano.
- Gráficas en HTML/CSS sin librería: todas son de una sola serie, así que usan
  un solo color; cada barra tiene tooltip con mouse y teclado, y los datos
  también están en tablas.
