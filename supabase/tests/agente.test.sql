-- =============================================================================
-- Fase 3: turno del agente, eventos de la IA y permisos sobre conversaciones.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(10);

insert into auth.users (id, email) values
  ('fa000000-0000-0000-0000-000000000001', 'duena@ag.mx'),
  ('fa000000-0000-0000-0000-000000000002', 'asesor@ag.mx'),
  ('fa000000-0000-0000-0000-000000000003', 'otro@ag.mx');
insert into inmobiliarias (id, nombre, slug) values ('faaaaaaa-0000-0000-0000-000000000000', 'Agente A', 'agente-a');
insert into usuarios (id, inmobiliaria_id, rol, nombre, email) values
  ('fa000000-0000-0000-0000-000000000001', 'faaaaaaa-0000-0000-0000-000000000000', 'dueno',  'Dueña',  'duena@ag.mx'),
  ('fa000000-0000-0000-0000-000000000002', 'faaaaaaa-0000-0000-0000-000000000000', 'asesor', 'Asesor', 'asesor@ag.mx'),
  ('fa000000-0000-0000-0000-000000000003', 'faaaaaaa-0000-0000-0000-000000000000', 'asesor', 'Otro',   'otro@ag.mx');
insert into leads (id, inmobiliaria_id, nombre, telefono, fuente, asesor_id) values
  ('faaaaaaa-0000-0000-0000-0000000000a1', 'faaaaaaa-0000-0000-0000-000000000000', 'Prospecto', '+524430000001', 'whatsapp',
   'fa000000-0000-0000-0000-000000000002');
insert into conversaciones (id, inmobiliaria_id, lead_id) values
  ('faaaaaaa-0000-0000-0000-0000000000c1', 'faaaaaaa-0000-0000-0000-000000000000', 'faaaaaaa-0000-0000-0000-0000000000a1');

-- Turno del agente
select is(reclamar_turno_agente('faaaaaaa-0000-0000-0000-0000000000c1', 60), true, 'el primer proceso reclama el turno');
select is(reclamar_turno_agente('faaaaaaa-0000-0000-0000-0000000000c1', 60), false, 'un segundo proceso no puede responder a la vez');
select liberar_turno_agente('faaaaaaa-0000-0000-0000-0000000000c1');
select is(reclamar_turno_agente('faaaaaaa-0000-0000-0000-0000000000c1', 60), true, 'liberado, se puede volver a reclamar');
update conversaciones set agente_ocupado_hasta = now() - interval '1 second' where id = 'faaaaaaa-0000-0000-0000-0000000000c1';
select is(reclamar_turno_agente('faaaaaaa-0000-0000-0000-0000000000c1', 60), true, 'un reclamo vencido se puede tomar');

-- Escalamiento del sistema (sin usuario)
set local request.jwt.claims = '';
update conversaciones set ia_activa = false, requiere_atencion = true, motivo_escalamiento = 'pide_humano'
  where id = 'faaaaaaa-0000-0000-0000-0000000000c1';
select results_eq(
  $$select tipo, usuario_id, datos from eventos_lead where lead_id = 'faaaaaaa-0000-0000-0000-0000000000a1' and tipo = 'ia_pausada'$$,
  $$values ('ia_pausada', null::uuid, '{"motivo": "pide_humano"}'::jsonb)$$,
  'el escalamiento queda en la línea de tiempo con su motivo');

-- El asesor del lead reanuda la IA
set local role authenticated;
set local request.jwt.claims = '{"sub":"fa000000-0000-0000-0000-000000000002"}';
select lives_ok(
  $$update conversaciones set ia_activa = true, requiere_atencion = false where id = 'faaaaaaa-0000-0000-0000-0000000000c1'$$,
  'el asesor del lead puede devolverle la conversación a la IA');
select is(
  (select usuario_id from eventos_lead where lead_id = 'faaaaaaa-0000-0000-0000-0000000000a1' and tipo = 'ia_reanudada'),
  'fa000000-0000-0000-0000-000000000002'::uuid, 'se registra quién reanudó la IA');
select throws_ok(
  $$update conversaciones set agente_ocupado_hasta = null where id = 'faaaaaaa-0000-0000-0000-0000000000c1'$$,
  '42501', null, 'un usuario no puede tocar los campos internos del agente');
select throws_ok(
  $$select reclamar_turno_agente('faaaaaaa-0000-0000-0000-0000000000c1', 60)$$,
  '42501', null, 'un usuario no puede reclamar el turno del agente');

-- Otro asesor no ve ni toca la conversación
set local request.jwt.claims = '{"sub":"fa000000-0000-0000-0000-000000000003"}';
with x as (update conversaciones set ia_activa = false where id = 'faaaaaaa-0000-0000-0000-0000000000c1' returning 1)
select is(count(*)::int, 0, 'otro asesor no puede pausar una conversación ajena') from x;

select * from finish();
rollback;
