-- =============================================================================
-- 0003 · Row Level Security, roles y alta de inmobiliarias
--
-- Reglas:
--   · Nadie ve datos de otra inmobiliaria.
--   · Dueño: ve y administra todo lo de su inmobiliaria.
--   · Asesor: ve el catálogo y el equipo; de leads/conversaciones/citas sólo
--     lo que tiene asignado.
--   · Webhooks, cron y agente usan service_role (salta RLS) y filtran por
--     inmobiliaria_id en código.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Helpers (security definer para no recursar en las políticas de usuarios)
-- -----------------------------------------------------------------------------
create or replace function app.inmobiliaria_id()
returns uuid
language sql stable security definer
set search_path = ''
as $$
  select u.inmobiliaria_id from public.usuarios u
  where u.id = auth.uid() and u.activo
$$;

create or replace function app.rol()
returns public.rol_usuario
language sql stable security definer
set search_path = ''
as $$
  select u.rol from public.usuarios u
  where u.id = auth.uid() and u.activo
$$;

create or replace function app.es_dueno()
returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce(app.rol() = 'dueno', false)
$$;

revoke all on function app.inmobiliaria_id(), app.rol(), app.es_dueno() from public, anon;
grant execute on function app.inmobiliaria_id(), app.rol(), app.es_dueno() to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Habilitar RLS en todo
-- -----------------------------------------------------------------------------
alter table public.inmobiliarias   enable row level security;
alter table public.usuarios        enable row level security;
alter table public.zonas           enable row level security;
alter table public.asesor_zonas    enable row level security;
alter table public.propiedades     enable row level security;
alter table public.propiedad_fotos enable row level security;
alter table public.leads           enable row level security;
alter table public.conversaciones  enable row level security;
alter table public.mensajes        enable row level security;
alter table public.citas           enable row level security;
alter table public.seguimientos    enable row level security;
alter table public.eventos_lead    enable row level security;
alter table public.integraciones   enable row level security;

-- anon no tiene nada que hacer contra las tablas (los endpoints públicos van por el servidor).
revoke all on all tables in schema public from anon;

-- -----------------------------------------------------------------------------
-- inmobiliarias
-- -----------------------------------------------------------------------------
create policy "inmobiliarias: ver la propia" on public.inmobiliarias
  for select to authenticated
  using (id = (select app.inmobiliaria_id()));

create policy "inmobiliarias: dueño edita" on public.inmobiliarias
  for update to authenticated
  using (id = (select app.inmobiliaria_id()) and (select app.es_dueno()))
  with check (id = (select app.inmobiliaria_id()));
-- insert: sólo vía public.crear_inmobiliaria(). delete: sólo service_role.

-- -----------------------------------------------------------------------------
-- usuarios
-- -----------------------------------------------------------------------------
create policy "usuarios: ver el equipo" on public.usuarios
  for select to authenticated
  using (inmobiliaria_id = (select app.inmobiliaria_id()));

create policy "usuarios: dueño edita al equipo, asesor a sí mismo" on public.usuarios
  for update to authenticated
  using (
    inmobiliaria_id = (select app.inmobiliaria_id())
    and ((select app.es_dueno()) or id = (select auth.uid()))
  )
  with check (inmobiliaria_id = (select app.inmobiliaria_id()));
-- insert: invitaciones vía server action con service_role.

-- Un asesor no puede auto-promoverse ni cambiar su estado de asignación.
create or replace function app.proteger_usuarios()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is null then  -- service_role / sistema
    return new;
  end if;
  if new.inmobiliaria_id <> old.inmobiliaria_id or new.id <> old.id then
    raise exception 'No se puede cambiar la inmobiliaria de un usuario';
  end if;
  if not app.es_dueno() and (
       new.rol <> old.rol or new.activo <> old.activo or new.recibe_leads <> old.recibe_leads
     ) then
    raise exception 'Sólo el dueño puede cambiar rol, estado o asignación de un usuario';
  end if;
  return new;
end;
$$;
create trigger proteger_usuarios before update on public.usuarios
  for each row execute function app.proteger_usuarios();

-- -----------------------------------------------------------------------------
-- zonas / asesor_zonas: todos ven, el dueño administra
-- -----------------------------------------------------------------------------
create policy "zonas: ver" on public.zonas
  for select to authenticated using (inmobiliaria_id = (select app.inmobiliaria_id()));
create policy "zonas: dueño administra" on public.zonas
  for all to authenticated
  using (inmobiliaria_id = (select app.inmobiliaria_id()) and (select app.es_dueno()))
  with check (inmobiliaria_id = (select app.inmobiliaria_id()) and (select app.es_dueno()));

create policy "asesor_zonas: ver" on public.asesor_zonas
  for select to authenticated using (inmobiliaria_id = (select app.inmobiliaria_id()));
create policy "asesor_zonas: dueño administra" on public.asesor_zonas
  for all to authenticated
  using (inmobiliaria_id = (select app.inmobiliaria_id()) and (select app.es_dueno()))
  with check (inmobiliaria_id = (select app.inmobiliaria_id()) and (select app.es_dueno()));

-- -----------------------------------------------------------------------------
-- propiedades / fotos: todos ven y editan; sólo el dueño borra
-- -----------------------------------------------------------------------------
create policy "propiedades: ver" on public.propiedades
  for select to authenticated using (inmobiliaria_id = (select app.inmobiliaria_id()));
create policy "propiedades: crear" on public.propiedades
  for insert to authenticated with check (inmobiliaria_id = (select app.inmobiliaria_id()));
create policy "propiedades: editar" on public.propiedades
  for update to authenticated
  using (inmobiliaria_id = (select app.inmobiliaria_id()))
  with check (inmobiliaria_id = (select app.inmobiliaria_id()));
create policy "propiedades: dueño borra" on public.propiedades
  for delete to authenticated
  using (inmobiliaria_id = (select app.inmobiliaria_id()) and (select app.es_dueno()));

create policy "fotos: ver" on public.propiedad_fotos
  for select to authenticated using (inmobiliaria_id = (select app.inmobiliaria_id()));
create policy "fotos: administrar" on public.propiedad_fotos
  for all to authenticated
  using (inmobiliaria_id = (select app.inmobiliaria_id()))
  with check (inmobiliaria_id = (select app.inmobiliaria_id()));

-- -----------------------------------------------------------------------------
-- leads: dueño todo; asesor sólo los suyos
-- -----------------------------------------------------------------------------
create policy "leads: ver" on public.leads
  for select to authenticated
  using (
    inmobiliaria_id = (select app.inmobiliaria_id())
    and ((select app.es_dueno()) or asesor_id = (select auth.uid()))
  );

create policy "leads: captura manual" on public.leads
  for insert to authenticated
  with check (
    inmobiliaria_id = (select app.inmobiliaria_id())
    and ((select app.es_dueno()) or asesor_id = (select auth.uid()))
  );

create policy "leads: editar" on public.leads
  for update to authenticated
  using (
    inmobiliaria_id = (select app.inmobiliaria_id())
    and ((select app.es_dueno()) or asesor_id = (select auth.uid()))
  )
  -- El asesor no puede pasarle el lead a otro (with check falla si cambia asesor_id).
  with check (
    inmobiliaria_id = (select app.inmobiliaria_id())
    and ((select app.es_dueno()) or asesor_id = (select auth.uid()))
  );

create policy "leads: dueño borra" on public.leads
  for delete to authenticated
  using (inmobiliaria_id = (select app.inmobiliaria_id()) and (select app.es_dueno()));

-- -----------------------------------------------------------------------------
-- conversaciones / mensajes / eventos / seguimientos: visibles si el lead lo es.
-- (La subconsulta a leads aplica a su vez la RLS de leads.)
-- Los mensajes salientes se envían por server action → proveedor → service_role.
-- -----------------------------------------------------------------------------
create policy "conversaciones: ver" on public.conversaciones
  for select to authenticated
  using (exists (select 1 from public.leads l where l.id = lead_id));
create policy "conversaciones: pausar/reanudar IA" on public.conversaciones
  for update to authenticated
  using (exists (select 1 from public.leads l where l.id = lead_id))
  with check (exists (select 1 from public.leads l where l.id = lead_id));

create policy "mensajes: ver" on public.mensajes
  for select to authenticated
  using (exists (
    select 1 from public.conversaciones c where c.id = conversacion_id
  ));

create policy "eventos: ver" on public.eventos_lead
  for select to authenticated
  using (exists (select 1 from public.leads l where l.id = lead_id));
create policy "eventos: agregar nota" on public.eventos_lead
  for insert to authenticated
  with check (
    tipo = 'nota'
    and usuario_id = (select auth.uid())
    and exists (select 1 from public.leads l where l.id = lead_id)
  );

create policy "seguimientos: ver" on public.seguimientos
  for select to authenticated
  using (exists (select 1 from public.leads l where l.id = lead_id));

-- -----------------------------------------------------------------------------
-- citas: dueño todo; asesor las suyas
-- -----------------------------------------------------------------------------
create policy "citas: ver" on public.citas
  for select to authenticated
  using (
    inmobiliaria_id = (select app.inmobiliaria_id())
    and ((select app.es_dueno()) or asesor_id = (select auth.uid()))
  );
create policy "citas: crear/editar" on public.citas
  for all to authenticated
  using (
    inmobiliaria_id = (select app.inmobiliaria_id())
    and ((select app.es_dueno()) or asesor_id = (select auth.uid()))
  )
  with check (
    inmobiliaria_id = (select app.inmobiliaria_id())
    and ((select app.es_dueno()) or asesor_id = (select auth.uid()))
  );

-- -----------------------------------------------------------------------------
-- integraciones: se puede ver el estado (no los secretos); escribir sólo servidor
-- -----------------------------------------------------------------------------
revoke select on public.integraciones from authenticated;
grant select (id, inmobiliaria_id, usuario_id, proveedor, identificador_externo,
              config, activa, creado_en, actualizado_en)
  on public.integraciones to authenticated;
revoke insert, update, delete on public.integraciones from authenticated;

create policy "integraciones: ver" on public.integraciones
  for select to authenticated
  using (
    inmobiliaria_id = (select app.inmobiliaria_id())
    and ((select app.es_dueno()) or usuario_id = (select auth.uid()))
  );

-- -----------------------------------------------------------------------------
-- Alta self-service: el usuario recién registrado crea su inmobiliaria y queda
-- como dueño. Falla si ya pertenece a una.
-- -----------------------------------------------------------------------------
create or replace function public.crear_inmobiliaria(
  p_nombre text,
  p_slug text,
  p_nombre_dueno text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := auth.uid();
  v_email text;
  v_id    uuid;
begin
  if v_uid is null then
    raise exception 'Requiere sesión';
  end if;
  if exists (select 1 from public.usuarios where id = v_uid) then
    raise exception 'El usuario ya pertenece a una inmobiliaria';
  end if;

  select email into v_email from auth.users where id = v_uid;

  insert into public.inmobiliarias (nombre, slug)
  values (trim(p_nombre), lower(trim(p_slug)))
  returning id into v_id;

  insert into public.usuarios (id, inmobiliaria_id, rol, nombre, email)
  values (v_uid, v_id, 'dueno', trim(p_nombre_dueno), v_email);

  return v_id;
end;
$$;

revoke all on function public.crear_inmobiliaria(text, text, text) from public, anon;
grant execute on function public.crear_inmobiliaria(text, text, text) to authenticated;
