-- =============================================================================
-- 0010 · Fase 6: reportes del dueño
--
-- Una sola función que agrega todo en la base (no se bajan miles de filas a la
-- app). security invoker: corre con los permisos del usuario, así que RLS
-- aplica; además exige rol dueño.
--
-- Definiciones (también en docs/reportes.md):
--   · Leads del periodo: creados en [desde, hasta).
--   · Tiempo de respuesta: primer mensaje saliente − llegada del lead. No
--     cuenta leads capturados a mano (los atiende el asesor por teléfono).
--   · % a cita: leads del periodo con al menos una cita (cualquier estado).
--   · Visitas por asesor: citas cuyo inicio cae en el periodo.
-- =============================================================================

create or replace function public.reporte_dueno(p_desde timestamptz, p_hasta timestamptz)
returns jsonb
language plpgsql
stable
security invoker
set search_path = ''
as $$
declare
  v_inmo uuid := app.inmobiliaria_id();
  v_zona text;
  v_resultado jsonb;
begin
  if v_inmo is null or not app.es_dueno() then
    raise exception 'Sólo el dueño puede ver los reportes' using errcode = '42501';
  end if;
  if p_hasta <= p_desde or p_hasta - p_desde > interval '400 days' then
    raise exception 'Rango de fechas no válido' using errcode = '22023';
  end if;
  select zona_horaria into v_zona from public.inmobiliarias where id = v_inmo;

  with
  l as (
    select
      l.id, l.fuente, l.score, l.asesor_id, l.creado_en, l.primer_contacto_en,
      case when l.fuente <> 'manual' and l.primer_contacto_en is not null
           then greatest(0, extract(epoch from (l.primer_contacto_en - l.creado_en)))
      end as resp_seg,
      exists (select 1 from public.citas c where c.lead_id = l.id) as con_cita,
      exists (select 1 from public.citas c where c.lead_id = l.id and c.estado = 'realizada') as visito,
      exists (select 1 from public.conversaciones cv where cv.lead_id = l.id and cv.ultimo_entrante_en is not null) as respondio
    from public.leads l
    where l.inmobiliaria_id = v_inmo and l.creado_en >= p_desde and l.creado_en < p_hasta
  ),
  c as (
    select c.asesor_id, c.estado, c.origen
    from public.citas c
    where c.inmobiliaria_id = v_inmo and c.inicio >= p_desde and c.inicio < p_hasta
  ),
  dias as (
    select d::date as dia
    from generate_series((p_desde at time zone v_zona)::date, ((p_hasta - interval '1 microsecond') at time zone v_zona)::date, interval '1 day') d
  )
  select jsonb_build_object(
    'leads', (select count(*) from l),
    'respuesta', (
      select jsonb_build_object(
        'medidos', count(resp_seg),
        'promedio_seg', round(avg(resp_seg)),
        'mediana_seg', round(percentile_cont(0.5) within group (order by resp_seg)::numeric),
        'p90_seg', round(percentile_cont(0.9) within group (order by resp_seg)::numeric),
        'menos_1_min', count(*) filter (where resp_seg < 60),
        'sin_contacto', count(*) filter (where fuente <> 'manual' and primer_contacto_en is null)
      ) from l
    ),
    'embudo', (
      select jsonb_build_object(
        'leads', count(*),
        'contactados', count(*) filter (where primer_contacto_en is not null),
        'respondieron', count(*) filter (where respondio),
        'con_cita', count(*) filter (where con_cita),
        'visitaron', count(*) filter (where visito)
      ) from l
    ),
    'por_score', (
      select jsonb_build_object(
        'caliente', count(*) filter (where score = 'caliente'),
        'tibio', count(*) filter (where score = 'tibio'),
        'frio', count(*) filter (where score = 'frio'),
        'sin_score', count(*) filter (where score is null)
      ) from l
    ),
    'por_fuente', coalesce((
      select jsonb_agg(f order by (f->>'leads')::int desc, f->>'fuente')
      from (
        select jsonb_build_object(
          'fuente', fuente,
          'leads', count(*),
          'con_cita', count(*) filter (where con_cita),
          'calientes', count(*) filter (where score = 'caliente'),
          'mediana_resp_seg', round(percentile_cont(0.5) within group (order by resp_seg)::numeric)
        ) as f
        from l group by fuente
      ) x
    ), '[]'::jsonb),
    'por_asesor', coalesce((
      select jsonb_agg(a order by (a->>'visitas_realizadas')::int desc, (a->>'citas')::int desc, a->>'nombre')
      from (
        select jsonb_build_object(
          'asesor_id', u.id,
          'nombre', u.nombre,
          'activo', u.activo,
          'leads_asignados', (select count(*) from l where l.asesor_id = u.id),
          'leads_con_cita', (select count(*) from l where l.asesor_id = u.id and l.con_cita),
          'citas', (select count(*) from c where c.asesor_id = u.id and c.estado <> 'cancelada'),
          'visitas_realizadas', (select count(*) from c where c.asesor_id = u.id and c.estado = 'realizada'),
          'no_asistio', (select count(*) from c where c.asesor_id = u.id and c.estado = 'no_asistio'),
          'canceladas', (select count(*) from c where c.asesor_id = u.id and c.estado = 'cancelada'),
          'pendientes', (select count(*) from c where c.asesor_id = u.id and c.estado in ('programada', 'confirmada')),
          'agendadas_por_agente', (select count(*) from c where c.asesor_id = u.id and c.origen = 'agente')
        ) as a
        from public.usuarios u
        where u.inmobiliaria_id = v_inmo
          and (u.recibe_leads and u.activo
               or exists (select 1 from l where l.asesor_id = u.id)
               or exists (select 1 from c where c.asesor_id = u.id))
      ) y
    ), '[]'::jsonb),
    'sin_asignar', (select count(*) from l where asesor_id is null),
    'por_dia', coalesce((
      select jsonb_agg(jsonb_build_object(
        'dia', d.dia,
        'leads', (select count(*) from l where (l.creado_en at time zone v_zona)::date = d.dia),
        'con_cita', (select count(*) from l where (l.creado_en at time zone v_zona)::date = d.dia and l.con_cita)
      ) order by d.dia)
      from dias d
    ), '[]'::jsonb)
  ) into v_resultado;

  return v_resultado;
end;
$$;

revoke all on function public.reporte_dueno(timestamptz, timestamptz) from public, anon;
grant execute on function public.reporte_dueno(timestamptz, timestamptz) to authenticated;
