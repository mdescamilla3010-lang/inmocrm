-- =============================================================================
-- Fase 4: citas (choques de horario, eventos, permisos).
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(9);

insert into auth.users (id, email) values
  ('ca000000-0000-0000-0000-000000000001', 'duena@ag4.mx'),
  ('ca000000-0000-0000-0000-000000000002', 'asesor1@ag4.mx'),
  ('ca000000-0000-0000-0000-000000000003', 'asesor2@ag4.mx');
insert into inmobiliarias (id, nombre, slug) values ('caaaaaaa-0000-0000-0000-000000000000', 'Agenda A', 'agenda-a');
insert into usuarios (id, inmobiliaria_id, rol, nombre, email) values
  ('ca000000-0000-0000-0000-000000000001', 'caaaaaaa-0000-0000-0000-000000000000', 'dueno',  'Dueña',  'duena@ag4.mx'),
  ('ca000000-0000-0000-0000-000000000002', 'caaaaaaa-0000-0000-0000-000000000000', 'asesor', 'Uno',    'asesor1@ag4.mx'),
  ('ca000000-0000-0000-0000-000000000003', 'caaaaaaa-0000-0000-0000-000000000000', 'asesor', 'Dos',    'asesor2@ag4.mx');
insert into leads (id, inmobiliaria_id, nombre, telefono, fuente, asesor_id) values
  ('caaaaaaa-0000-0000-0000-0000000000a1', 'caaaaaaa-0000-0000-0000-000000000000', 'Lead 1', '+524440000001', 'whatsapp', 'ca000000-0000-0000-0000-000000000002'),
  ('caaaaaaa-0000-0000-0000-0000000000a2', 'caaaaaaa-0000-0000-0000-000000000000', 'Lead 2', '+524440000002', 'whatsapp', 'ca000000-0000-0000-0000-000000000003');

select is((select margen_traslado_min from inmobiliarias where slug = 'agenda-a'), 30::smallint, 'margen de traslado por defecto: 30 min');

-- El agente (sistema) agenda una cita
set local request.jwt.claims = '';
insert into citas (id, inmobiliaria_id, lead_id, asesor_id, inicio, fin) values
  ('caaaaaaa-0000-0000-0000-0000000000c1', 'caaaaaaa-0000-0000-0000-000000000000', 'caaaaaaa-0000-0000-0000-0000000000a1',
   'ca000000-0000-0000-0000-000000000002', '2026-11-14 16:00Z', '2026-11-14 17:00Z');
select results_eq(
  $$select tipo, usuario_id, datos->>'origen' from eventos_lead where lead_id = 'caaaaaaa-0000-0000-0000-0000000000a1' and tipo like 'cita%'$$,
  $$values ('cita_agendada', null::uuid, 'agente')$$,
  'agendar registra cita_agendada en la línea de tiempo');

select throws_ok(
  $$insert into citas (inmobiliaria_id, lead_id, asesor_id, inicio, fin) values
    ('caaaaaaa-0000-0000-0000-000000000000', 'caaaaaaa-0000-0000-0000-0000000000a2', 'ca000000-0000-0000-0000-000000000002',
     '2026-11-14 16:30Z', '2026-11-14 17:30Z')$$,
  '23P01', null, 'el mismo asesor no puede tener dos visitas empalmadas');
select lives_ok(
  $$insert into citas (inmobiliaria_id, lead_id, asesor_id, inicio, fin) values
    ('caaaaaaa-0000-0000-0000-000000000000', 'caaaaaaa-0000-0000-0000-0000000000a2', 'ca000000-0000-0000-0000-000000000003',
     '2026-11-14 16:30Z', '2026-11-14 17:30Z')$$,
  'otro asesor sí puede tener visita a esa hora');

-- El asesor del lead marca la visita como realizada
set local role authenticated;
set local request.jwt.claims = '{"sub":"ca000000-0000-0000-0000-000000000002"}';
update citas set estado = 'realizada' where id = 'caaaaaaa-0000-0000-0000-0000000000c1';
select is(
  (select usuario_id from eventos_lead where lead_id = 'caaaaaaa-0000-0000-0000-0000000000a1' and tipo = 'cita_realizada'),
  'ca000000-0000-0000-0000-000000000002'::uuid, 'marcar realizada queda registrado con quién lo hizo');
select is((select count(*)::int from citas), 1, 'el asesor sólo ve sus citas');

-- El otro asesor no puede tocar citas ajenas
set local request.jwt.claims = '{"sub":"ca000000-0000-0000-0000-000000000003"}';
with x as (update citas set estado = 'cancelada' where id = 'caaaaaaa-0000-0000-0000-0000000000c1' returning 1)
select is(count(*)::int, 0, 'otro asesor no puede cancelar una cita ajena') from x;

-- Cancelar libera el horario
reset role;
set local request.jwt.claims = '';
update citas set estado = 'cancelada', motivo_cancelacion = 'El prospecto no puede'
  where lead_id = 'caaaaaaa-0000-0000-0000-0000000000a2';
select is(
  (select datos->>'motivo' from eventos_lead where lead_id = 'caaaaaaa-0000-0000-0000-0000000000a2' and tipo = 'cita_cancelada'),
  'El prospecto no puede', 'la cancelación guarda su motivo');
select lives_ok(
  $$insert into citas (inmobiliaria_id, lead_id, asesor_id, inicio, fin) values
    ('caaaaaaa-0000-0000-0000-000000000000', 'caaaaaaa-0000-0000-0000-0000000000a2', 'ca000000-0000-0000-0000-000000000003',
     '2026-11-14 16:30Z', '2026-11-14 17:30Z')$$,
  'una cita cancelada libera su horario');

select * from finish();
rollback;
