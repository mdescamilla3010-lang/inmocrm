-- =============================================================================
-- Fase 2: eventos automáticos de leads, bitácora de capturas y round robin.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(16);

insert into auth.users (id, email) values
  ('ea000000-0000-0000-0000-000000000001', 'duena@rr.mx'),
  ('ea000000-0000-0000-0000-000000000002', 'uno@rr.mx'),
  ('ea000000-0000-0000-0000-000000000003', 'dos@rr.mx'),
  ('ea000000-0000-0000-0000-000000000004', 'tres@rr.mx'),
  ('eb000000-0000-0000-0000-000000000001', 'otro@rr.mx');

insert into inmobiliarias (id, nombre, slug) values
  ('eaaaaaaa-0000-0000-0000-000000000000', 'RR A', 'rr-a'),
  ('ebbbbbbb-0000-0000-0000-000000000000', 'RR B', 'rr-b');

insert into usuarios (id, inmobiliaria_id, rol, nombre, email, recibe_leads) values
  ('ea000000-0000-0000-0000-000000000001', 'eaaaaaaa-0000-0000-0000-000000000000', 'dueno',  'Dueña', 'duena@rr.mx', false),
  ('ea000000-0000-0000-0000-000000000002', 'eaaaaaaa-0000-0000-0000-000000000000', 'asesor', 'Uno',   'uno@rr.mx',   true),
  ('ea000000-0000-0000-0000-000000000003', 'eaaaaaaa-0000-0000-0000-000000000000', 'asesor', 'Dos',   'dos@rr.mx',   true),
  ('ea000000-0000-0000-0000-000000000004', 'eaaaaaaa-0000-0000-0000-000000000000', 'asesor', 'Tres',  'tres@rr.mx',  false),
  ('eb000000-0000-0000-0000-000000000001', 'ebbbbbbb-0000-0000-0000-000000000000', 'asesor', 'Otro',  'otro@rr.mx',  true);

-- -----------------------------------------------------------------------------
-- Round robin
-- -----------------------------------------------------------------------------
select is(
  siguiente_asesor_round_robin('eaaaaaaa-0000-0000-0000-000000000000',
    array['ea000000-0000-0000-0000-000000000002', 'ea000000-0000-0000-0000-000000000003']::uuid[]),
  'ea000000-0000-0000-0000-000000000002'::uuid, 'RR: el primero que nunca ha recibido');
select is(
  siguiente_asesor_round_robin('eaaaaaaa-0000-0000-0000-000000000000',
    array['ea000000-0000-0000-0000-000000000002', 'ea000000-0000-0000-0000-000000000003']::uuid[]),
  'ea000000-0000-0000-0000-000000000003'::uuid, 'RR: después el otro');
-- now() es igual dentro de la transacción; se simula el paso del tiempo.
update usuarios set ultima_asignacion_en = now() - interval '2 minutes' where id = 'ea000000-0000-0000-0000-000000000002';
update usuarios set ultima_asignacion_en = now() - interval '1 minute'  where id = 'ea000000-0000-0000-0000-000000000003';
select is(
  siguiente_asesor_round_robin('eaaaaaaa-0000-0000-0000-000000000000',
    array['ea000000-0000-0000-0000-000000000002', 'ea000000-0000-0000-0000-000000000003']::uuid[]),
  'ea000000-0000-0000-0000-000000000002'::uuid, 'RR: vuelve al que lleva más tiempo sin lead');
select is(
  siguiente_asesor_round_robin('eaaaaaaa-0000-0000-0000-000000000000',
    array['ea000000-0000-0000-0000-000000000004']::uuid[]),
  null, 'RR: ignora a quien no recibe leads');
select is(
  siguiente_asesor_round_robin('eaaaaaaa-0000-0000-0000-000000000000',
    array['eb000000-0000-0000-0000-000000000001']::uuid[]),
  null, 'RR: ignora candidatos de otra inmobiliaria');
select is(
  siguiente_asesor_round_robin('eaaaaaaa-0000-0000-0000-000000000000', array[]::uuid[]),
  null, 'RR: sin candidatos devuelve null');

set local role authenticated;
set local request.jwt.claims = '{"sub":"ea000000-0000-0000-0000-000000000001"}';
select throws_ok(
  $$select siguiente_asesor_round_robin('eaaaaaaa-0000-0000-0000-000000000000', array[]::uuid[])$$,
  '42501', null, 'RR: un usuario autenticado no puede llamarla');
reset role;

-- -----------------------------------------------------------------------------
-- Eventos automáticos
-- -----------------------------------------------------------------------------
insert into leads (id, inmobiliaria_id, nombre, telefono, fuente, asesor_id) values
  ('eaaaaaaa-0000-0000-0000-0000000000a1', 'eaaaaaaa-0000-0000-0000-000000000000', 'Prospecto', '+524420000001',
   'meta_ads', 'ea000000-0000-0000-0000-000000000002');

select results_eq(
  $$select tipo from eventos_lead where lead_id = 'eaaaaaaa-0000-0000-0000-0000000000a1' order by id$$,
  $$values ('capturado'), ('asignado')$$,
  'al capturar con asesor se registran capturado y asignado');

set local role authenticated;
set local request.jwt.claims = '{"sub":"ea000000-0000-0000-0000-000000000001"}';
update leads set asesor_id = 'ea000000-0000-0000-0000-000000000003', estado = 'calificado'
  where id = 'eaaaaaaa-0000-0000-0000-0000000000a1';
select results_eq(
  $$select tipo, usuario_id from eventos_lead
    where lead_id = 'eaaaaaaa-0000-0000-0000-0000000000a1' and tipo in ('reasignado', 'estado_cambiado') order by tipo$$,
  $$values ('estado_cambiado', 'ea000000-0000-0000-0000-000000000001'::uuid),
           ('reasignado',      'ea000000-0000-0000-0000-000000000001'::uuid)$$,
  'reasignar y cambiar estado quedan registrados con quién lo hizo');

update leads set presupuesto_max = 3000000, forma_pago = 'infonavit' where id = 'eaaaaaaa-0000-0000-0000-0000000000a1';
select is(
  (select datos->'campos' from eventos_lead where lead_id = 'eaaaaaaa-0000-0000-0000-0000000000a1' and tipo = 'calificacion_editada'),
  '["presupuesto_max", "forma_pago"]'::jsonb,
  'la edición manual de la calificación lista los campos cambiados');

update leads set nombre = 'Prospecto Pérez' where id = 'eaaaaaaa-0000-0000-0000-0000000000a1';
select is(
  (select count(*)::int from eventos_lead where lead_id = 'eaaaaaaa-0000-0000-0000-0000000000a1' and tipo = 'contacto_editado'),
  1, 'editar el contacto queda registrado');

update leads set notas_calificacion = notas_calificacion where id = 'eaaaaaaa-0000-0000-0000-0000000000a1';
select is(
  (select count(*)::int from eventos_lead where lead_id = 'eaaaaaaa-0000-0000-0000-0000000000a1'),
  6, 'un update sin cambios reales no genera eventos');

reset role;
set local request.jwt.claims = '';
update leads set presupuesto_max = 3500000 where id = 'eaaaaaaa-0000-0000-0000-0000000000a1';
select is(
  (select count(*)::int from eventos_lead where lead_id = 'eaaaaaaa-0000-0000-0000-0000000000a1' and tipo = 'calificacion_editada'),
  1, 'los cambios del sistema/agente no generan calificacion_editada');

-- -----------------------------------------------------------------------------
-- Bitácora de capturas
-- -----------------------------------------------------------------------------
insert into capturas_lead (inmobiliaria_id, canal, fuente, id_externo, resultado, detalle) values
  ('eaaaaaaa-0000-0000-0000-000000000000', 'correo', null, '<msg-1@portal>', 'descartado', 'Formato no reconocido');

select throws_ok(
  $$insert into capturas_lead (inmobiliaria_id, canal, fuente, id_externo)
    values ('eaaaaaaa-0000-0000-0000-000000000000', 'correo', 'inmuebles24', '<msg-1@portal>')$$,
  '23505', null, 'el mismo correo no se procesa dos veces');

set local role authenticated;
set local request.jwt.claims = '{"sub":"ea000000-0000-0000-0000-000000000001"}';
select is((select count(*)::int from capturas_lead), 1, 'la dueña ve la bitácora de capturas');

set local request.jwt.claims = '{"sub":"ea000000-0000-0000-0000-000000000002"}';
select is((select count(*)::int from capturas_lead), 0, 'un asesor no ve la bitácora');

select * from finish();
rollback;
