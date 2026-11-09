-- =============================================================================
-- Fase 6: reporte del dueño con datos controlados.
-- Periodo: 2026-11-01 00:00 a 2026-11-08 00:00 hora de Ciudad de México (UTC-6).
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(14);

insert into auth.users (id, email) values
  ('7a000000-0000-0000-0000-000000000001', 'duena@rep.mx'),
  ('7a000000-0000-0000-0000-000000000002', 'luis@rep.mx'),
  ('7a000000-0000-0000-0000-000000000003', 'marta@rep.mx'),
  ('7b000000-0000-0000-0000-000000000001', 'otro@rep.mx');
insert into inmobiliarias (id, nombre, slug) values
  ('7aaaaaaa-0000-0000-0000-000000000000', 'Rep A', 'reportes-a'),
  ('7bbbbbbb-0000-0000-0000-000000000000', 'Rep B', 'reportes-b');
insert into usuarios (id, inmobiliaria_id, rol, nombre, email, recibe_leads) values
  ('7a000000-0000-0000-0000-000000000001', '7aaaaaaa-0000-0000-0000-000000000000', 'dueno',  'Dueña', 'duena@rep.mx', false),
  ('7a000000-0000-0000-0000-000000000002', '7aaaaaaa-0000-0000-0000-000000000000', 'asesor', 'Luis',  'luis@rep.mx',  true),
  ('7a000000-0000-0000-0000-000000000003', '7aaaaaaa-0000-0000-0000-000000000000', 'asesor', 'Marta', 'marta@rep.mx', true),
  ('7b000000-0000-0000-0000-000000000001', '7bbbbbbb-0000-0000-0000-000000000000', 'dueno',  'Otro',  'otro@rep.mx',  true);

-- Leads de A en el periodo (5) + uno fuera del periodo + uno de B.
insert into leads (id, inmobiliaria_id, nombre, telefono, fuente, asesor_id, score, creado_en, primer_contacto_en) values
  -- Meta: contestado en 30 s y 90 s
  ('7aaaaaaa-0000-0000-0000-0000000000a1', '7aaaaaaa-0000-0000-0000-000000000000', 'A1', '+524460000001', 'meta_ads', '7a000000-0000-0000-0000-000000000002', 'caliente',
   '2026-11-02 16:00Z', '2026-11-02 16:00:30Z'),
  ('7aaaaaaa-0000-0000-0000-0000000000a2', '7aaaaaaa-0000-0000-0000-000000000000', 'A2', '+524460000002', 'meta_ads', '7a000000-0000-0000-0000-000000000003', 'frio',
   '2026-11-02 18:00Z', '2026-11-02 18:01:30Z'),
  -- Landing: 10 min
  ('7aaaaaaa-0000-0000-0000-0000000000a3', '7aaaaaaa-0000-0000-0000-000000000000', 'A3', '+524460000003', 'landing', '7a000000-0000-0000-0000-000000000002', 'tibio',
   '2026-11-05 15:00Z', '2026-11-05 15:10:00Z'),
  -- Lamudi: nunca contactado
  ('7aaaaaaa-0000-0000-0000-0000000000a4', '7aaaaaaa-0000-0000-0000-000000000000', 'A4', '+524460000004', 'lamudi', null, null,
   '2026-11-07 05:30Z', null),
  -- Manual: no cuenta para tiempo de respuesta
  ('7aaaaaaa-0000-0000-0000-0000000000a5', '7aaaaaaa-0000-0000-0000-000000000000', 'A5', '+524460000005', 'manual', '7a000000-0000-0000-0000-000000000003', null,
   '2026-11-07 20:00Z', '2026-11-08 20:00Z'),
  -- Fuera del periodo (31 oct 23:00 hora local = 1 nov 05:00 UTC → 31 oct local)
  ('7aaaaaaa-0000-0000-0000-0000000000a6', '7aaaaaaa-0000-0000-0000-000000000000', 'Fuera', '+524460000006', 'meta_ads', null, null,
   '2026-11-01 05:00Z', null),
  ('7bbbbbbb-0000-0000-0000-0000000000b1', '7bbbbbbb-0000-0000-0000-000000000000', 'B1', '+524460000007', 'meta_ads', null, null,
   '2026-11-03 16:00Z', null);

insert into conversaciones (inmobiliaria_id, lead_id, ultimo_entrante_en) values
  ('7aaaaaaa-0000-0000-0000-000000000000', '7aaaaaaa-0000-0000-0000-0000000000a1', '2026-11-02 16:05Z'),
  ('7aaaaaaa-0000-0000-0000-000000000000', '7aaaaaaa-0000-0000-0000-0000000000a3', '2026-11-05 15:20Z');

insert into citas (inmobiliaria_id, lead_id, asesor_id, inicio, fin, estado, origen) values
  ('7aaaaaaa-0000-0000-0000-000000000000', '7aaaaaaa-0000-0000-0000-0000000000a1', '7a000000-0000-0000-0000-000000000002', '2026-11-04 17:00Z', '2026-11-04 18:00Z', 'realizada', 'agente'),
  ('7aaaaaaa-0000-0000-0000-000000000000', '7aaaaaaa-0000-0000-0000-0000000000a3', '7a000000-0000-0000-0000-000000000002', '2026-11-06 17:00Z', '2026-11-06 18:00Z', 'no_asistio', 'asesor'),
  ('7aaaaaaa-0000-0000-0000-000000000000', '7aaaaaaa-0000-0000-0000-0000000000a2', '7a000000-0000-0000-0000-000000000003', '2026-11-06 19:00Z', '2026-11-06 20:00Z', 'cancelada', 'agente');

-- -----------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"7a000000-0000-0000-0000-000000000001"}';
create temp table r as select reporte_dueno('2026-11-01 06:00Z', '2026-11-08 06:00Z') as j;

select is((select (j->>'leads')::int from r), 5, 'cuenta sólo los leads del periodo y de su inmobiliaria');
select is((select j->'respuesta' from r),
  '{"medidos": 3, "promedio_seg": 240, "mediana_seg": 90, "p90_seg": 498, "menos_1_min": 1, "sin_contacto": 1}'::jsonb,
  'tiempos de respuesta: promedio, mediana, p90, < 1 min y sin contacto (sin contar manuales)');
select is((select j->'embudo' from r),
  '{"leads": 5, "contactados": 4, "respondieron": 2, "con_cita": 3, "visitaron": 1}'::jsonb,
  'embudo del periodo');
select is((select j->'por_score' from r),
  '{"caliente": 1, "tibio": 1, "frio": 1, "sin_score": 2}'::jsonb, 'distribución de score');
select is((select j->'por_fuente'->0 from r),
  '{"fuente": "meta_ads", "leads": 2, "con_cita": 2, "calientes": 1, "mediana_resp_seg": 60}'::jsonb,
  'por fuente: ordenado por leads, con % a cita y mediana de respuesta');
select is((select jsonb_array_length(j->'por_fuente') from r), 4, 'una fila por fuente con leads');
select is((select (j->>'sin_asignar')::int from r), 1, 'leads sin asignar');

select is(
  (select a from r, jsonb_array_elements(j->'por_asesor') a where a->>'nombre' = 'Luis'),
  '{"asesor_id": "7a000000-0000-0000-0000-000000000002", "nombre": "Luis", "activo": true, "leads_asignados": 2, "leads_con_cita": 2,
    "citas": 2, "visitas_realizadas": 1, "no_asistio": 1, "canceladas": 0, "pendientes": 0, "agendadas_por_agente": 1}'::jsonb,
  'visitas por asesor');
select is(
  (select a->>'canceladas' from r, jsonb_array_elements(j->'por_asesor') a where a->>'nombre' = 'Marta'),
  '1', 'las canceladas no cuentan como citas pero se reportan');
select is(
  (select count(*)::int from r, jsonb_array_elements(j->'por_asesor') a where a->>'nombre' = 'Dueña'),
  0, 'quien no recibe leads ni tiene actividad no aparece');

select is((select jsonb_array_length(j->'por_dia') from r), 7, 'un día por cada día local del periodo');
select is((select j->'por_dia'->1 from r), '{"dia": "2026-11-02", "leads": 2, "con_cita": 2}'::jsonb, 'agrupa por día en hora local');

-- Asesor: sin acceso
set local request.jwt.claims = '{"sub":"7a000000-0000-0000-0000-000000000002"}';
select throws_ok($$select reporte_dueno('2026-11-01', '2026-11-08')$$, '42501', null, 'un asesor no puede ver reportes');

set local request.jwt.claims = '{"sub":"7a000000-0000-0000-0000-000000000001"}';
select throws_ok($$select reporte_dueno('2026-11-08', '2026-11-01')$$, '22023', null, 'rango inválido');

select * from finish();
rollback;
