-- =============================================================================
-- 0007 · Fase 3: agente de WhatsApp
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Conversaciones: escalamiento a humano y control del turno del agente
-- -----------------------------------------------------------------------------
alter table public.conversaciones
  add column requiere_atencion   boolean not null default false,
  add column motivo_escalamiento text,
  add column escalada_en         timestamptz,
  -- Mientras un proceso del agente responde, otros no deben responder a la vez.
  add column agente_ocupado_hasta timestamptz;

create index conversaciones_atencion_idx
  on public.conversaciones (inmobiliaria_id) where requiere_atencion;

-- Disponibilidad que dio el prospecto para visitar (la fase 4 la convierte en cita).
alter table public.leads add column interes_visita text;

-- -----------------------------------------------------------------------------
-- Reclamo atómico del turno del agente. Devuelve true si este proceso puede
-- responder; el reclamo caduca solo (por si el proceso muere a medias).
-- -----------------------------------------------------------------------------
create or replace function public.reclamar_turno_agente(p_conversacion_id uuid, p_segundos int)
returns boolean
language sql
set search_path = ''
as $$
  with reclamo as (
    update public.conversaciones
    set agente_ocupado_hasta = now() + make_interval(secs => p_segundos)
    where id = p_conversacion_id
      and (agente_ocupado_hasta is null or agente_ocupado_hasta < now())
    returning 1
  )
  select exists (select 1 from reclamo);
$$;

create or replace function public.liberar_turno_agente(p_conversacion_id uuid)
returns void
language sql
set search_path = ''
as $$
  update public.conversaciones set agente_ocupado_hasta = null where id = p_conversacion_id;
$$;

revoke all on function public.reclamar_turno_agente(uuid, int) from public, anon, authenticated;
revoke all on function public.liberar_turno_agente(uuid) from public, anon, authenticated;
grant execute on function public.reclamar_turno_agente(uuid, int) to service_role;
grant execute on function public.liberar_turno_agente(uuid) to service_role;

-- -----------------------------------------------------------------------------
-- Línea de tiempo: pausar / reanudar la IA queda registrado con quién lo hizo.
-- -----------------------------------------------------------------------------
create or replace function app.registrar_eventos_conversacion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.ia_activa is distinct from old.ia_activa then
    insert into public.eventos_lead (inmobiliaria_id, lead_id, tipo, usuario_id, datos)
    values (new.inmobiliaria_id, new.lead_id,
            case when new.ia_activa then 'ia_reanudada' else 'ia_pausada' end,
            auth.uid(),
            case when new.ia_activa then '{}'::jsonb
                 else jsonb_strip_nulls(jsonb_build_object('motivo', new.motivo_escalamiento)) end);
  end if;
  return new;
end;
$$;

create trigger registrar_eventos
  after update on public.conversaciones
  for each row execute function app.registrar_eventos_conversacion();

-- Un asesor sólo puede tocar el control de la IA, no los campos del sistema.
revoke update on public.conversaciones from authenticated;
grant update (ia_activa, requiere_atencion) on public.conversaciones to authenticated;
