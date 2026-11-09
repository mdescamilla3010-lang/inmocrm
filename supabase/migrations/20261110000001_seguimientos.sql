-- =============================================================================
-- 0009 · Fase 5: recordatorios de visita y reactivación de leads fríos
--
-- La base PROGRAMA los seguimientos (triggers), así no importa si la cita la
-- agendó el agente, un asesor o alguien a mano. El servidor decide al
-- momento de ENVIAR si todavía aplica (lib/seguimiento/reglas.ts).
-- =============================================================================

alter table public.inmobiliarias
  add column recordatorios_activos boolean not null default true,
  add column reactivacion_activa  boolean not null default true;

alter table public.seguimientos add column actualizado_en timestamptz not null default now();
create trigger set_actualizado_en before update on public.seguimientos
  for each row execute function app.set_actualizado_en();

alter table public.eventos_lead drop constraint eventos_lead_tipo_check;
alter table public.eventos_lead add constraint eventos_lead_tipo_check check (tipo in (
  'capturado', 'recapturado', 'asignado', 'reasignado',
  'score_cambiado', 'estado_cambiado', 'calificacion_editada', 'contacto_editado',
  'cita_agendada', 'cita_cancelada', 'cita_realizada', 'cita_no_asistio',
  'seguimiento_enviado', 'ia_pausada', 'ia_reanudada', 'opt_out', 'nota'));

-- -----------------------------------------------------------------------------
-- Recordatorios: 24 h y 2 h antes de cada visita activa.
-- -----------------------------------------------------------------------------
create or replace function app.programar_recordatorios()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tipo   public.tipo_seguimiento;
  v_cuando timestamptz;
begin
  if new.estado not in ('programada', 'confirmada') then
    update public.seguimientos set estado = 'cancelado', ultimo_error = 'La cita ya no está activa'
    where cita_id = new.id and estado = 'pendiente';
    return new;
  end if;

  if tg_op = 'UPDATE' and new.inicio = old.inicio and old.estado in ('programada', 'confirmada') then
    return new; -- nada que reprogramar (p. ej. programada → confirmada)
  end if;

  foreach v_tipo in array array['recordatorio_24h', 'recordatorio_2h']::public.tipo_seguimiento[] loop
    v_cuando := new.inicio - case v_tipo when 'recordatorio_24h' then interval '24 hours' else interval '2 hours' end;
    if v_cuando > now() then
      insert into public.seguimientos (inmobiliaria_id, lead_id, cita_id, tipo, programado_para)
      values (new.inmobiliaria_id, new.lead_id, new.id, v_tipo, v_cuando)
      on conflict (cita_id, tipo) where cita_id is not null
      do update set programado_para = excluded.programado_para, estado = 'pendiente', intentos = 0, ultimo_error = null, ejecutado_en = null;
    else
      -- Si se reprogramó y este recordatorio ya no tiene sentido, se cancela.
      update public.seguimientos set estado = 'cancelado', ultimo_error = 'Muy cerca de la visita'
      where cita_id = new.id and tipo = v_tipo and estado = 'pendiente';
    end if;
  end loop;
  return new;
end;
$$;

create trigger programar_recordatorios
  after insert or update of inicio, estado on public.citas
  for each row execute function app.programar_recordatorios();

-- -----------------------------------------------------------------------------
-- Reactivación: 3, 7 y 15 días después de la última señal del prospecto.
-- Si vuelve a escribir, se reinicia el conteo desde ese mensaje.
-- -----------------------------------------------------------------------------
create or replace function app.programar_reactivacion(p_inmobiliaria_id uuid, p_lead_id uuid, p_desde timestamptz)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  update public.seguimientos set estado = 'cancelado', ultimo_error = 'Hubo actividad nueva del prospecto'
  where lead_id = p_lead_id and estado = 'pendiente' and cita_id is null;

  insert into public.seguimientos (inmobiliaria_id, lead_id, tipo, programado_para)
  select p_inmobiliaria_id, p_lead_id, t.tipo, p_desde + t.dias * interval '1 day'
  from (values ('reactivacion_3d'::public.tipo_seguimiento, 3),
               ('reactivacion_7d'::public.tipo_seguimiento, 7),
               ('reactivacion_15d'::public.tipo_seguimiento, 15)) as t(tipo, dias)
  where p_desde + t.dias * interval '1 day' > now();
end;
$$;

create or replace function app.reactivacion_al_capturar()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Los leads capturados a mano los atiende directamente el asesor.
  if new.telefono is not null and not new.opt_out and new.fuente <> 'manual' then
    perform app.programar_reactivacion(new.inmobiliaria_id, new.id, new.creado_en);
  end if;
  return new;
end;
$$;

create trigger reactivacion_al_capturar
  after insert on public.leads
  for each row execute function app.reactivacion_al_capturar();

create or replace function app.reactivacion_al_escribir()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.ultimo_entrante_en is not null and new.ultimo_entrante_en is distinct from old.ultimo_entrante_en then
    perform app.programar_reactivacion(new.inmobiliaria_id, new.lead_id, new.ultimo_entrante_en);
  end if;
  return new;
end;
$$;

create trigger reactivacion_al_escribir
  after update of ultimo_entrante_en on public.conversaciones
  for each row execute function app.reactivacion_al_escribir();

-- Baja: se cancela todo lo pendiente.
create or replace function app.cancelar_seguimientos_baja()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.opt_out and not old.opt_out then
    update public.seguimientos set estado = 'cancelado', ultimo_error = 'El prospecto pidió no ser contactado'
    where lead_id = new.id and estado = 'pendiente';
  end if;
  return new;
end;
$$;

create trigger cancelar_seguimientos_baja
  after update of opt_out on public.leads
  for each row execute function app.cancelar_seguimientos_baja();

-- -----------------------------------------------------------------------------
-- Reclamo atómico de seguimientos vencidos (varios procesos del cron a la vez
-- no toman el mismo). Recupera los que se quedaron "procesando" > 10 min.
-- -----------------------------------------------------------------------------
create or replace function public.reclamar_seguimientos(p_limite int)
returns setof public.seguimientos
language plpgsql
set search_path = ''
as $$
begin
  update public.seguimientos set estado = 'pendiente'
  where estado = 'procesando' and actualizado_en < now() - interval '10 minutes';

  return query
  update public.seguimientos s
  set estado = 'procesando', intentos = s.intentos + 1
  where s.id in (
    select id from public.seguimientos
    where estado = 'pendiente' and programado_para <= now()
    order by programado_para
    limit p_limite
    for update skip locked
  )
  returning s.*;
end;
$$;

revoke all on function public.reclamar_seguimientos(int) from public, anon, authenticated;
grant execute on function public.reclamar_seguimientos(int) to service_role;

-- -----------------------------------------------------------------------------
-- Cron: cada minuto llama a /api/cron/seguimientos. La URL y el secreto se
-- guardan en Vault (ver docs/seguimientos.md); sin ellos la llamada no sale.
-- Se omite donde no existen pg_cron/pg_net (p. ej. Postgres sin Supabase).
-- -----------------------------------------------------------------------------
do $$
begin
  if exists (select 1 from pg_available_extensions where name = 'pg_cron')
     and exists (select 1 from pg_available_extensions where name = 'pg_net') then
    create extension if not exists pg_cron;
    create extension if not exists pg_net;
    perform cron.schedule(
      'inmocrm-seguimientos',
      '* * * * *',
      $cron$
        select net.http_post(
          url := (select decrypted_secret from vault.decrypted_secrets where name = 'inmocrm_app_url') || '/api/cron/seguimientos',
          headers := jsonb_build_object(
            'Content-Type', 'application/json',
            'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'inmocrm_cron_secret')
          ),
          body := '{}'::jsonb,
          timeout_milliseconds := 55000
        )
        where exists (select 1 from vault.decrypted_secrets where name = 'inmocrm_app_url');
      $cron$
    );
  else
    raise notice 'pg_cron/pg_net no disponibles: el cron de seguimientos no se programó';
  end if;
end;
$$;
