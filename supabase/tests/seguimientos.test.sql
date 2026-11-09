-- =============================================================================
-- Fase 5: programación automática de recordatorios y reactivaciones.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(16);

insert into auth.users (id, email) values ('5a000000-0000-0000-0000-000000000001', 'asesor@seg.mx');
insert into inmobiliarias (id, nombre, slug) values ('5aaaaaaa-0000-0000-0000-000000000000', 'Seg', 'seguimientos-a');
insert into usuarios (id, inmobiliaria_id, rol, nombre, email) values
  ('5a000000-0000-0000-0000-000000000001', '5aaaaaaa-0000-0000-0000-000000000000', 'dueno', 'Asesora', 'asesor@seg.mx');

-- -----------------------------------------------------------------------------
-- Reactivación al capturar
-- -----------------------------------------------------------------------------
insert into leads (id, inmobiliaria_id, nombre, telefono, fuente, asesor_id) values
  ('5aaaaaaa-0000-0000-0000-0000000000a1', '5aaaaaaa-0000-0000-0000-000000000000', 'Meta', '+524450000001', 'meta_ads', '5a000000-0000-0000-0000-000000000001');
insert into leads (id, inmobiliaria_id, nombre, telefono, fuente) values
  ('5aaaaaaa-0000-0000-0000-0000000000a2', '5aaaaaaa-0000-0000-0000-000000000000', 'Manual', '+524450000002', 'manual');
insert into leads (id, inmobiliaria_id, nombre, email, fuente) values
  ('5aaaaaaa-0000-0000-0000-0000000000a3', '5aaaaaaa-0000-0000-0000-000000000000', 'Sin tel', 'x@y.mx', 'landing');

select results_eq(
  $$select tipo::text, (programado_para - (select creado_en from leads where id = '5aaaaaaa-0000-0000-0000-0000000000a1'))::text
    from seguimientos where lead_id = '5aaaaaaa-0000-0000-0000-0000000000a1' order by programado_para$$,
  $$values ('reactivacion_3d', '3 days'), ('reactivacion_7d', '7 days'), ('reactivacion_15d', '15 days')$$,
  'un lead nuevo con teléfono queda con reactivaciones a 3, 7 y 15 días');
select is((select count(*)::int from seguimientos where lead_id = '5aaaaaaa-0000-0000-0000-0000000000a2'), 0, 'los leads capturados a mano no se reactivan solos');
select is((select count(*)::int from seguimientos where lead_id = '5aaaaaaa-0000-0000-0000-0000000000a3'), 0, 'sin teléfono no hay reactivación');

-- -----------------------------------------------------------------------------
-- Cuando el prospecto escribe, se reinicia el conteo
-- -----------------------------------------------------------------------------
insert into conversaciones (id, inmobiliaria_id, lead_id) values
  ('5aaaaaaa-0000-0000-0000-0000000000c1', '5aaaaaaa-0000-0000-0000-000000000000', '5aaaaaaa-0000-0000-0000-0000000000a1');
update conversaciones set ultimo_entrante_en = now() + interval '1 hour' where id = '5aaaaaaa-0000-0000-0000-0000000000c1';
select is(
  (select count(*)::int from seguimientos where lead_id = '5aaaaaaa-0000-0000-0000-0000000000a1' and estado = 'cancelado'),
  3, 'al escribir se cancelan las reactivaciones anteriores');
select is(
  (select min(programado_para) from seguimientos where lead_id = '5aaaaaaa-0000-0000-0000-0000000000a1' and estado = 'pendiente'),
  now() + interval '1 hour' + interval '3 days', 'y se programan de nuevo desde su último mensaje');

-- -----------------------------------------------------------------------------
-- Recordatorios de visita
-- -----------------------------------------------------------------------------
insert into citas (id, inmobiliaria_id, lead_id, asesor_id, inicio, fin) values
  ('5aaaaaaa-0000-0000-0000-0000000000d1', '5aaaaaaa-0000-0000-0000-000000000000', '5aaaaaaa-0000-0000-0000-0000000000a1',
   '5a000000-0000-0000-0000-000000000001', now() + interval '3 days', now() + interval '3 days 1 hour');
select results_eq(
  $$select tipo::text, programado_para from seguimientos where cita_id = '5aaaaaaa-0000-0000-0000-0000000000d1' order by programado_para$$,
  $$values ('recordatorio_24h', now() + interval '2 days'), ('recordatorio_2h', now() + interval '3 days' - interval '2 hours')$$,
  'agendar programa recordatorios 24 h y 2 h antes');

update citas set inicio = now() + interval '5 days', fin = now() + interval '5 days 1 hour' where id = '5aaaaaaa-0000-0000-0000-0000000000d1';
select is(
  (select programado_para from seguimientos where cita_id = '5aaaaaaa-0000-0000-0000-0000000000d1' and tipo = 'recordatorio_24h'),
  now() + interval '4 days', 'reprogramar la cita mueve sus recordatorios');
select is((select count(*)::int from seguimientos where cita_id = '5aaaaaaa-0000-0000-0000-0000000000d1'), 2, 'sin duplicar recordatorios');

update citas set estado = 'confirmada' where id = '5aaaaaaa-0000-0000-0000-0000000000d1';
select is(
  (select count(*)::int from seguimientos where cita_id = '5aaaaaaa-0000-0000-0000-0000000000d1' and estado = 'pendiente'),
  2, 'confirmar la cita conserva los recordatorios');

update citas set estado = 'cancelada' where id = '5aaaaaaa-0000-0000-0000-0000000000d1';
select is(
  (select count(*)::int from seguimientos where cita_id = '5aaaaaaa-0000-0000-0000-0000000000d1' and estado = 'cancelado'),
  2, 'cancelar la cita cancela sus recordatorios');

-- Visita en 5 horas: ya no cabe el de 24 h, sí el de 2 h
insert into citas (id, inmobiliaria_id, lead_id, asesor_id, inicio, fin) values
  ('5aaaaaaa-0000-0000-0000-0000000000d2', '5aaaaaaa-0000-0000-0000-000000000000', '5aaaaaaa-0000-0000-0000-0000000000a1',
   '5a000000-0000-0000-0000-000000000001', now() + interval '5 hours', now() + interval '6 hours');
select results_eq(
  $$select tipo::text from seguimientos where cita_id = '5aaaaaaa-0000-0000-0000-0000000000d2'$$,
  $$values ('recordatorio_2h')$$,
  'una visita agendada con poca anticipación sólo lleva el recordatorio de 2 h');

-- -----------------------------------------------------------------------------
-- Baja
-- -----------------------------------------------------------------------------
update leads set opt_out = true where id = '5aaaaaaa-0000-0000-0000-0000000000a1';
select is(
  (select count(*)::int from seguimientos where lead_id = '5aaaaaaa-0000-0000-0000-0000000000a1' and estado = 'pendiente'),
  0, 'pedir la baja cancela todos los seguimientos pendientes');

-- -----------------------------------------------------------------------------
-- Reclamo atómico
-- -----------------------------------------------------------------------------
insert into seguimientos (id, inmobiliaria_id, lead_id, tipo, programado_para, estado) values
  ('5aaaaaaa-0000-0000-0000-0000000000e1', '5aaaaaaa-0000-0000-0000-000000000000', '5aaaaaaa-0000-0000-0000-0000000000a3', 'reactivacion_3d', now() - interval '1 minute', 'pendiente'),
  ('5aaaaaaa-0000-0000-0000-0000000000e2', '5aaaaaaa-0000-0000-0000-000000000000', '5aaaaaaa-0000-0000-0000-0000000000a3', 'reactivacion_7d', now() + interval '1 day', 'pendiente');
select results_eq(
  $$select id, estado::text, intentos::int from reclamar_seguimientos(10) where lead_id = '5aaaaaaa-0000-0000-0000-0000000000a3'$$,
  $$values ('5aaaaaaa-0000-0000-0000-0000000000e1'::uuid, 'procesando', 1)$$,
  'reclama sólo lo vencido y lo marca como procesando');
select is((select count(*)::int from reclamar_seguimientos(10) where lead_id = '5aaaaaaa-0000-0000-0000-0000000000a3'), 0, 'no se reclama dos veces');

-- El trigger de actualizado_en pisaría la fecha simulada, así que se ajusta sin él.
alter table seguimientos disable trigger set_actualizado_en;
update seguimientos set actualizado_en = now() - interval '11 minutes' where id = '5aaaaaaa-0000-0000-0000-0000000000e1';
alter table seguimientos enable trigger set_actualizado_en;
select is((select count(*)::int from reclamar_seguimientos(10) where id = '5aaaaaaa-0000-0000-0000-0000000000e1'), 1, 'recupera los que se quedaron procesando');

set local role authenticated;
set local request.jwt.claims = '{"sub":"5a000000-0000-0000-0000-000000000001"}';
select throws_ok('select * from reclamar_seguimientos(1)', '42501', null, 'un usuario no puede reclamar seguimientos');

select * from finish();
rollback;
