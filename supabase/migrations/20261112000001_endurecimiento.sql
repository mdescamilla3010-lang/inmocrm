-- =============================================================================
-- 0011 · Endurecimiento tras la revisión previa al despliegue
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Mensajes de WhatsApp de tipos no previstos (stickers, video, contactos…)
--    fallaban al guardarse y el prospecto se quedaba sin respuesta.
-- -----------------------------------------------------------------------------
alter table public.mensajes drop constraint mensajes_tipo_check;
alter table public.mensajes add constraint mensajes_tipo_check check (tipo in (
  'texto', 'imagen', 'plantilla', 'ubicacion', 'interactivo', 'audio', 'documento', 'otro'));

-- -----------------------------------------------------------------------------
-- 2. Citas: además del asesor, el LEAD debe ser visible para quien agenda.
--    Antes un asesor podía crear (por API) una cita para el lead de otro
--    asesor de su misma inmobiliaria.
-- -----------------------------------------------------------------------------
drop policy "citas: crear/editar" on public.citas;

create policy "citas: crear" on public.citas
  for insert to authenticated
  with check (
    inmobiliaria_id = (select app.inmobiliaria_id())
    and ((select app.es_dueno()) or asesor_id = (select auth.uid()))
    and exists (select 1 from public.leads l where l.id = lead_id)
  );

create policy "citas: editar" on public.citas
  for update to authenticated
  using (
    inmobiliaria_id = (select app.inmobiliaria_id())
    and ((select app.es_dueno()) or asesor_id = (select auth.uid()))
  )
  with check (
    inmobiliaria_id = (select app.inmobiliaria_id())
    and ((select app.es_dueno()) or asesor_id = (select auth.uid()))
    and exists (select 1 from public.leads l where l.id = lead_id)
  );

create policy "citas: dueño borra" on public.citas
  for delete to authenticated
  using (inmobiliaria_id = (select app.inmobiliaria_id()) and (select app.es_dueno()));

-- -----------------------------------------------------------------------------
-- 3. Funciones internas: Postgres da EXECUTE a PUBLIC por defecto. Las de
--    triggers no lo necesitan (al dispararse no se revisa) y algunas son
--    security definer con ids arbitrarios. Sólo quedan las que usan las
--    políticas de RLS.
-- -----------------------------------------------------------------------------
revoke execute on all functions in schema app from public, anon, authenticated;
grant execute on function app.inmobiliaria_id(), app.rol(), app.es_dueno() to authenticated, service_role;
alter default privileges in schema app revoke execute on functions from public;
