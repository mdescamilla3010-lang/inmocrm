-- =============================================================================
-- 0006 · Fase 2: bitácora de capturas y eventos automáticos de leads
-- =============================================================================

-- -----------------------------------------------------------------------------
-- capturas_lead: cada lead que entra por un canal (Meta, landing, correo) deja
-- un registro. Sirve para:
--   · idempotencia: el mismo leadgen_id / Message-ID no se procesa dos veces;
--   · diagnóstico: el dueño ve los correos que no se pudieron interpretar
--     (incluido el código de verificación de reenvío de Gmail).
-- -----------------------------------------------------------------------------
create type public.resultado_captura as enum (
  'procesando', 'creado', 'recapturado', 'descartado', 'error'
);

create table public.capturas_lead (
  id               uuid primary key default gen_random_uuid(),
  inmobiliaria_id  uuid not null references public.inmobiliarias (id) on delete cascade,
  fuente           public.fuente_lead not null,
  id_externo       text,
  resultado        public.resultado_captura not null default 'procesando',
  lead_id          uuid,
  detalle          text,
  payload          jsonb not null default '{}',
  creado_en        timestamptz not null default now(),
  actualizado_en   timestamptz not null default now(),
  foreign key (inmobiliaria_id, lead_id)
    references public.leads (inmobiliaria_id, id) on delete set null (lead_id)
);
create unique index capturas_lead_idempotencia
  on public.capturas_lead (inmobiliaria_id, fuente, id_externo) where id_externo is not null;
create index capturas_lead_recientes on public.capturas_lead (inmobiliaria_id, creado_en desc);
create trigger set_actualizado_en before update on public.capturas_lead
  for each row execute function app.set_actualizado_en();

alter table public.capturas_lead enable row level security;
create policy "capturas: dueño ve la bitácora" on public.capturas_lead
  for select to authenticated
  using (inmobiliaria_id = (select app.inmobiliaria_id()) and (select app.es_dueno()));
-- Escritura sólo desde el servidor (service_role).

-- -----------------------------------------------------------------------------
-- Más tipos de evento
-- -----------------------------------------------------------------------------
alter table public.eventos_lead drop constraint eventos_lead_tipo_check;
alter table public.eventos_lead add constraint eventos_lead_tipo_check check (tipo in (
  'capturado', 'recapturado', 'asignado', 'reasignado',
  'score_cambiado', 'estado_cambiado', 'calificacion_editada', 'contacto_editado',
  'cita_agendada', 'cita_cancelada', 'ia_pausada', 'ia_reanudada', 'opt_out', 'nota'));

-- -----------------------------------------------------------------------------
-- Trigger: la línea de tiempo se llena sola, sin depender de que cada pantalla
-- o proceso se acuerde de registrar el evento.
-- usuario_id = auth.uid(): null cuando el cambio lo hace el sistema/agente.
-- -----------------------------------------------------------------------------
create or replace function app.registrar_eventos_lead()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := auth.uid();
  v_campos  text[];
begin
  if tg_op = 'INSERT' then
    insert into public.eventos_lead (inmobiliaria_id, lead_id, tipo, usuario_id, datos)
    values (new.inmobiliaria_id, new.id, 'capturado', v_usuario,
            jsonb_build_object('fuente', new.fuente));
    if new.asesor_id is not null then
      insert into public.eventos_lead (inmobiliaria_id, lead_id, tipo, usuario_id, datos)
      values (new.inmobiliaria_id, new.id, 'asignado', v_usuario,
              jsonb_build_object('asesor_id', new.asesor_id));
    end if;
    return new;
  end if;

  if new.estado is distinct from old.estado then
    insert into public.eventos_lead (inmobiliaria_id, lead_id, tipo, usuario_id, datos)
    values (new.inmobiliaria_id, new.id, 'estado_cambiado', v_usuario,
            jsonb_build_object('de', old.estado, 'a', new.estado));
  end if;

  if new.asesor_id is distinct from old.asesor_id then
    insert into public.eventos_lead (inmobiliaria_id, lead_id, tipo, usuario_id, datos)
    values (new.inmobiliaria_id, new.id,
            case when old.asesor_id is null then 'asignado' else 'reasignado' end,
            v_usuario, jsonb_build_object('de', old.asesor_id, 'asesor_id', new.asesor_id));
  end if;

  if new.score is distinct from old.score then
    insert into public.eventos_lead (inmobiliaria_id, lead_id, tipo, usuario_id, datos)
    values (new.inmobiliaria_id, new.id, 'score_cambiado', v_usuario,
            jsonb_build_object('de', old.score, 'a', new.score, 'motivo', new.score_motivo));
  end if;

  if new.opt_out and not old.opt_out then
    insert into public.eventos_lead (inmobiliaria_id, lead_id, tipo, usuario_id)
    values (new.inmobiliaria_id, new.id, 'opt_out', v_usuario);
  end if;

  -- Ediciones manuales (las del agente quedan en la conversación y en el score).
  if v_usuario is not null then
    v_campos := array_remove(array[
      case when new.operacion_interes      is distinct from old.operacion_interes      then 'operacion_interes' end,
      case when new.tipo_propiedad_interes is distinct from old.tipo_propiedad_interes then 'tipo_propiedad_interes' end,
      case when new.zona_interes           is distinct from old.zona_interes           then 'zona_interes' end,
      case when new.zona_id                is distinct from old.zona_id                then 'zona_id' end,
      case when new.presupuesto_min        is distinct from old.presupuesto_min        then 'presupuesto_min' end,
      case when new.presupuesto_max        is distinct from old.presupuesto_max        then 'presupuesto_max' end,
      case when new.forma_pago             is distinct from old.forma_pago             then 'forma_pago' end,
      case when new.credito_preaprobado    is distinct from old.credito_preaprobado    then 'credito_preaprobado' end,
      case when new.urgencia               is distinct from old.urgencia               then 'urgencia' end,
      case when new.recamaras_min          is distinct from old.recamaras_min          then 'recamaras_min' end,
      case when new.notas_calificacion     is distinct from old.notas_calificacion     then 'notas_calificacion' end
    ], null);
    if cardinality(v_campos) > 0 then
      insert into public.eventos_lead (inmobiliaria_id, lead_id, tipo, usuario_id, datos)
      values (new.inmobiliaria_id, new.id, 'calificacion_editada', v_usuario,
              jsonb_build_object('campos', to_jsonb(v_campos)));
    end if;

    v_campos := array_remove(array[
      case when new.nombre   is distinct from old.nombre   then 'nombre' end,
      case when new.telefono is distinct from old.telefono then 'telefono' end,
      case when new.email    is distinct from old.email    then 'email' end
    ], null);
    if cardinality(v_campos) > 0 then
      insert into public.eventos_lead (inmobiliaria_id, lead_id, tipo, usuario_id, datos)
      values (new.inmobiliaria_id, new.id, 'contacto_editado', v_usuario,
              jsonb_build_object('campos', to_jsonb(v_campos)));
    end if;
  end if;

  return new;
end;
$$;

create trigger registrar_eventos
  after insert or update on public.leads
  for each row execute function app.registrar_eventos_lead();

-- -----------------------------------------------------------------------------
-- Round robin: se asigna al candidato que lleva MÁS TIEMPO sin recibir un lead.
-- Funciona igual para todo el equipo o para el subconjunto de una zona (un
-- puntero único no sirve con subconjuntos: siempre ganaría el primero).
-- Se bloquea la fila de la inmobiliaria para que dos leads simultáneos no
-- caigan con el mismo asesor.
-- -----------------------------------------------------------------------------
alter table public.usuarios add column ultima_asignacion_en timestamptz;
alter table public.inmobiliarias drop constraint inmobiliarias_ultimo_asesor_fk;
alter table public.inmobiliarias drop column ultimo_asesor_asignado_id;

create or replace function public.siguiente_asesor_round_robin(
  p_inmobiliaria_id uuid,
  p_candidatos uuid[]
)
returns uuid
language plpgsql
set search_path = ''
as $$
declare
  v_elegido uuid;
begin
  if p_candidatos is null or cardinality(p_candidatos) = 0 then
    return null;
  end if;

  perform 1 from public.inmobiliarias where id = p_inmobiliaria_id for update;

  select u.id into v_elegido
  from public.usuarios u
  where u.inmobiliaria_id = p_inmobiliaria_id
    and u.id = any (p_candidatos)
    and u.activo and u.recibe_leads
  order by u.ultima_asignacion_en asc nulls first, u.creado_en, u.id
  limit 1;

  if v_elegido is not null then
    update public.usuarios set ultima_asignacion_en = now() where id = v_elegido;
  end if;
  return v_elegido;
end;
$$;

-- Sólo el servidor asigna leads automáticamente.
revoke all on function public.siguiente_asesor_round_robin(uuid, uuid[]) from public, anon, authenticated;
grant execute on function public.siguiente_asesor_round_robin(uuid, uuid[]) to service_role;
