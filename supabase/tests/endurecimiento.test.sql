-- =============================================================================
-- Endurecimiento: tipos de mensaje, citas por lead visible, funciones internas.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(8);

insert into auth.users (id, email) values
  ('8a000000-0000-0000-0000-000000000001', 'uno@end.mx'),
  ('8a000000-0000-0000-0000-000000000002', 'dos@end.mx');
insert into inmobiliarias (id, nombre, slug) values ('8aaaaaaa-0000-0000-0000-000000000000', 'End', 'endurecimiento');
insert into usuarios (id, inmobiliaria_id, rol, nombre, email) values
  ('8a000000-0000-0000-0000-000000000001', '8aaaaaaa-0000-0000-0000-000000000000', 'asesor', 'Uno', 'uno@end.mx'),
  ('8a000000-0000-0000-0000-000000000002', '8aaaaaaa-0000-0000-0000-000000000000', 'asesor', 'Dos', 'dos@end.mx');
insert into leads (id, inmobiliaria_id, nombre, telefono, fuente, asesor_id) values
  ('8aaaaaaa-0000-0000-0000-0000000000a1', '8aaaaaaa-0000-0000-0000-000000000000', 'De Uno', '+524470000001', 'whatsapp', '8a000000-0000-0000-0000-000000000001'),
  ('8aaaaaaa-0000-0000-0000-0000000000a2', '8aaaaaaa-0000-0000-0000-000000000000', 'De Dos', '+524470000002', 'whatsapp', '8a000000-0000-0000-0000-000000000002');
insert into conversaciones (id, inmobiliaria_id, lead_id) values
  ('8aaaaaaa-0000-0000-0000-0000000000c1', '8aaaaaaa-0000-0000-0000-000000000000', '8aaaaaaa-0000-0000-0000-0000000000a1');

select lives_ok(
  $$insert into mensajes (inmobiliaria_id, conversacion_id, direccion, autor, tipo, contenido, estado)
    values ('8aaaaaaa-0000-0000-0000-000000000000', '8aaaaaaa-0000-0000-0000-0000000000c1', 'entrante', 'prospecto', 'otro', '[Envió un sticker]', 'recibido')$$,
  'se guardan mensajes de tipos no previstos (stickers, video…)');

set local role authenticated;
set local request.jwt.claims = '{"sub":"8a000000-0000-0000-0000-000000000001"}';

select lives_ok(
  $$insert into citas (inmobiliaria_id, lead_id, asesor_id, inicio, fin) values
    ('8aaaaaaa-0000-0000-0000-000000000000', '8aaaaaaa-0000-0000-0000-0000000000a1', '8a000000-0000-0000-0000-000000000001', '2026-12-01 16:00Z', '2026-12-01 17:00Z')$$,
  'un asesor agenda visitas de sus leads');
select throws_ok(
  $$insert into citas (inmobiliaria_id, lead_id, asesor_id, inicio, fin) values
    ('8aaaaaaa-0000-0000-0000-000000000000', '8aaaaaaa-0000-0000-0000-0000000000a2', '8a000000-0000-0000-0000-000000000001', '2026-12-02 16:00Z', '2026-12-02 17:00Z')$$,
  '42501', null, 'pero no para el lead de otro asesor');
select throws_ok(
  $$update citas set lead_id = '8aaaaaaa-0000-0000-0000-0000000000a2' where lead_id = '8aaaaaaa-0000-0000-0000-0000000000a1'$$,
  '42501', null, 'ni mover su cita al lead de otro asesor');
with x as (delete from citas returning 1)
select is(count(*)::int, 0, 'un asesor no borra citas (sólo cancela)') from x;

select throws_ok(
  $$select app.programar_reactivacion('8aaaaaaa-0000-0000-0000-000000000000', '8aaaaaaa-0000-0000-0000-0000000000a2', now())$$,
  '42501', null, 'un usuario no puede llamar funciones internas');
select ok(has_function_privilege('authenticated', 'app.es_dueno()', 'execute'), 'las funciones de RLS siguen disponibles');

-- Los triggers siguen funcionando aunque el usuario no tenga EXECUTE sobre sus funciones.
update leads set estado = 'calificado' where id = '8aaaaaaa-0000-0000-0000-0000000000a1';
reset role;
select is(
  (select count(*)::int from eventos_lead where lead_id = '8aaaaaaa-0000-0000-0000-0000000000a1' and tipo = 'estado_cambiado'),
  1, 'los triggers se siguen disparando');

select * from finish();
rollback;
