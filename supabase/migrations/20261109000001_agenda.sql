-- =============================================================================
-- 0008 · Fase 4: agenda con Google Calendar
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Configuración de la agenda por inmobiliaria
-- -----------------------------------------------------------------------------
alter table public.inmobiliarias
  -- Tiempo libre entre una visita y la siguiente (traslados).
  add column margen_traslado_min  smallint not null default 30 check (margen_traslado_min between 0 and 180),
  -- No ofrecer horarios que empiecen antes de este tiempo.
  add column anticipacion_min     smallint not null default 120 check (anticipacion_min between 0 and 2880);

-- -----------------------------------------------------------------------------
-- Más tipos de evento para la línea de tiempo
-- -----------------------------------------------------------------------------
alter table public.eventos_lead drop constraint eventos_lead_tipo_check;
alter table public.eventos_lead add constraint eventos_lead_tipo_check check (tipo in (
  'capturado', 'recapturado', 'asignado', 'reasignado',
  'score_cambiado', 'estado_cambiado', 'calificacion_editada', 'contacto_editado',
  'cita_agendada', 'cita_cancelada', 'cita_realizada', 'cita_no_asistio',
  'ia_pausada', 'ia_reanudada', 'opt_out', 'nota'));

-- -----------------------------------------------------------------------------
-- Trigger: cada cita agendada o con cambio de estado queda en la línea de tiempo.
-- -----------------------------------------------------------------------------
create or replace function app.registrar_eventos_cita()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tipo text;
begin
  if tg_op = 'INSERT' then
    v_tipo := 'cita_agendada';
  elsif new.estado is distinct from old.estado then
    v_tipo := case new.estado
      when 'cancelada' then 'cita_cancelada'
      when 'realizada' then 'cita_realizada'
      when 'no_asistio' then 'cita_no_asistio'
      else null
    end;
  end if;

  if v_tipo is not null then
    insert into public.eventos_lead (inmobiliaria_id, lead_id, tipo, usuario_id, datos)
    values (new.inmobiliaria_id, new.lead_id, v_tipo, auth.uid(),
            jsonb_strip_nulls(jsonb_build_object(
              'cita_id', new.id,
              'inicio', new.inicio,
              'asesor_id', new.asesor_id,
              'propiedad_id', new.propiedad_id,
              'origen', new.origen,
              'motivo', new.motivo_cancelacion)));
  end if;
  return new;
end;
$$;

create trigger registrar_eventos
  after insert or update on public.citas
  for each row execute function app.registrar_eventos_cita();

-- Índice para revisar choques de horario por asesor en un rango de fechas.
create index citas_activas_idx on public.citas (asesor_id, inicio)
  where estado in ('programada', 'confirmada');
