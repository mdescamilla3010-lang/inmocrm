-- =============================================================================
-- Aislamiento multi-tenant y permisos por rol.
-- Ejecutar con: supabase test db
--
-- Escenario: inmobiliaria A (dueña Ana, asesores Luis y Marta) e
-- inmobiliaria B (dueño Beto). Cada asesor de A tiene un lead.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
set local search_path = public, extensions;

select plan(35);

-- -----------------------------------------------------------------------------
-- Datos
-- -----------------------------------------------------------------------------
insert into auth.users (id, email) values
  ('a0000000-0000-0000-0000-000000000001', 'ana@casas-a.mx'),
  ('a0000000-0000-0000-0000-000000000002', 'luis@casas-a.mx'),
  ('a0000000-0000-0000-0000-000000000003', 'marta@casas-a.mx'),
  ('b0000000-0000-0000-0000-000000000001', 'beto@casas-b.mx'),
  ('c0000000-0000-0000-0000-000000000001', 'nuevo@sin-inmo.mx');

insert into inmobiliarias (id, nombre, slug) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'Casas A', 'casas-a'),
  ('bbbbbbbb-0000-0000-0000-000000000000', 'Casas B', 'casas-b');

insert into usuarios (id, inmobiliaria_id, rol, nombre, email) values
  ('a0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000000', 'dueno',  'Ana',   'ana@casas-a.mx'),
  ('a0000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000000', 'asesor', 'Luis',  'luis@casas-a.mx'),
  ('a0000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000000', 'asesor', 'Marta', 'marta@casas-a.mx'),
  ('b0000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000000', 'dueno',  'Beto',  'beto@casas-b.mx');

insert into propiedades (id, inmobiliaria_id, titulo, tipo, precio) values
  ('aaaaaaaa-0000-0000-0000-0000000000f1', 'aaaaaaaa-0000-0000-0000-000000000000', 'Casa en Juriquilla', 'casa', 4500000),
  ('bbbbbbbb-0000-0000-0000-0000000000f1', 'bbbbbbbb-0000-0000-0000-000000000000', 'Depa en Polanco', 'departamento', 9800000);

insert into leads (id, inmobiliaria_id, nombre, telefono, fuente, asesor_id) values
  ('aaaaaaaa-0000-0000-0000-0000000000a1', 'aaaaaaaa-0000-0000-0000-000000000000', 'Lead de Luis',  '+525511111111', 'meta_ads', 'a0000000-0000-0000-0000-000000000002'),
  ('aaaaaaaa-0000-0000-0000-0000000000a2', 'aaaaaaaa-0000-0000-0000-000000000000', 'Lead de Marta', '+525522222222', 'landing',  'a0000000-0000-0000-0000-000000000003'),
  ('bbbbbbbb-0000-0000-0000-0000000000b1', 'bbbbbbbb-0000-0000-0000-000000000000', 'Lead de B',     '+525533333333', 'lamudi',   null);

insert into conversaciones (id, inmobiliaria_id, lead_id) values
  ('aaaaaaaa-0000-0000-0000-0000000000c1', 'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000a1'),
  ('aaaaaaaa-0000-0000-0000-0000000000c2', 'aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000a2');

insert into mensajes (inmobiliaria_id, conversacion_id, direccion, autor, contenido, estado) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000c1', 'entrante', 'prospecto', 'Hola, me interesa', 'recibido'),
  ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000c2', 'entrante', 'prospecto', 'Info por favor', 'recibido');

insert into integraciones (inmobiliaria_id, proveedor, identificador_externo, credenciales_cifradas) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'whatsapp_cloud', '1234567890', 'cifrado:secreto');

-- -----------------------------------------------------------------------------
-- Estructura
-- -----------------------------------------------------------------------------
select is(
  (select count(*)::int from pg_class c join pg_namespace n on n.oid = c.relnamespace
   where n.nspname = 'public' and c.relkind = 'r' and not c.relrowsecurity),
  0,
  'todas las tablas de public tienen RLS habilitado'
);

-- -----------------------------------------------------------------------------
-- Dueña de A
-- -----------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000001"}';

select is((select count(*)::int from inmobiliarias), 1, 'dueña A sólo ve su inmobiliaria');
select is((select count(*)::int from leads), 2, 'dueña A ve todos los leads de A y ninguno de B');
select is((select count(*)::int from propiedades), 1, 'dueña A no ve propiedades de B');
select is((select count(*)::int from usuarios), 3, 'dueña A ve a su equipo, no al de B');
select is((select count(*)::int from mensajes), 2, 'dueña A ve las conversaciones de todos sus asesores');
select is((select count(*)::int from integraciones), 1, 'dueña A ve sus integraciones');
select throws_ok(
  'select credenciales_cifradas from integraciones',
  '42501', null, 'nadie autenticado puede leer credenciales cifradas'
);
select lives_ok(
  $$update leads set asesor_id = 'a0000000-0000-0000-0000-000000000003' where id = 'aaaaaaaa-0000-0000-0000-0000000000a1'$$,
  'la dueña puede reasignar leads'
);
with x as (
  update leads set nombre = 'hackeado' where id = 'bbbbbbbb-0000-0000-0000-0000000000b1' returning 1
)
select is(count(*)::int, 0, 'dueña A no puede modificar leads de B') from x;
select throws_ok(
  $$insert into propiedades (inmobiliaria_id, titulo, tipo, precio)
    values ('bbbbbbbb-0000-0000-0000-000000000000', 'Intrusa', 'casa', 1000000)$$,
  '42501', null, 'dueña A no puede crear propiedades en B'
);
-- devolver el lead a Luis para el resto de pruebas
update leads set asesor_id = 'a0000000-0000-0000-0000-000000000002' where id = 'aaaaaaaa-0000-0000-0000-0000000000a1';

-- -----------------------------------------------------------------------------
-- Asesor Luis (A)
-- -----------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000002"}';

select results_eq('select nombre from leads', $$values ('Lead de Luis')$$, 'Luis sólo ve su lead');
select is((select count(*)::int from conversaciones), 1, 'Luis sólo ve la conversación de su lead');
select is((select count(*)::int from mensajes), 1, 'Luis sólo ve mensajes de su lead');
select is((select count(*)::int from propiedades), 1, 'Luis ve el catálogo de su inmobiliaria');
select is((select count(*)::int from usuarios), 3, 'Luis ve a su equipo');
select is((select count(*)::int from integraciones), 0, 'Luis no ve las integraciones de la inmobiliaria');
select throws_ok(
  $$update leads set asesor_id = 'a0000000-0000-0000-0000-000000000003' where id = 'aaaaaaaa-0000-0000-0000-0000000000a1'$$,
  '42501', null, 'Luis no puede pasarle su lead a otro asesor'
);
select lives_ok(
  $$update leads set presupuesto_max = 5000000 where id = 'aaaaaaaa-0000-0000-0000-0000000000a1'$$,
  'Luis puede actualizar la calificación de su lead'
);
select throws_ok(
  $$update usuarios set rol = 'dueno' where id = 'a0000000-0000-0000-0000-000000000002'$$,
  'P0001', null, 'Luis no puede volverse dueño'
);
select lives_ok(
  $$update usuarios set nombre = 'Luis Pérez' where id = 'a0000000-0000-0000-0000-000000000002'$$,
  'Luis puede editar su propio nombre'
);
with x as (
  update usuarios set nombre = 'X' where id = 'a0000000-0000-0000-0000-000000000003' returning 1
)
select is(count(*)::int, 0, 'Luis no puede editar el perfil de Marta') from x;
with x as (
  delete from propiedades returning 1
)
select is(count(*)::int, 0, 'un asesor no puede borrar propiedades') from x;
select lives_ok(
  $$insert into eventos_lead (inmobiliaria_id, lead_id, tipo, usuario_id, datos)
    values ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000a1', 'nota',
            'a0000000-0000-0000-0000-000000000002', '{"texto":"Llamar el lunes"}')$$,
  'Luis puede dejar notas en su lead'
);
select throws_ok(
  $$insert into eventos_lead (inmobiliaria_id, lead_id, tipo, usuario_id)
    values ('aaaaaaaa-0000-0000-0000-000000000000', 'aaaaaaaa-0000-0000-0000-0000000000a2', 'nota',
            'a0000000-0000-0000-0000-000000000002')$$,
  '42501', null, 'Luis no puede dejar notas en el lead de Marta'
);

-- -----------------------------------------------------------------------------
-- Dueño de B
-- -----------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"b0000000-0000-0000-0000-000000000001"}';

select results_eq('select nombre from leads', $$values ('Lead de B')$$, 'dueño B sólo ve leads de B');
select is((select count(*)::int from mensajes), 0, 'dueño B no ve mensajes de A');

-- -----------------------------------------------------------------------------
-- Usuario desactivado
-- -----------------------------------------------------------------------------
reset role;
update usuarios set activo = false where id = 'a0000000-0000-0000-0000-000000000003';
set local role authenticated;
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000003"}';

select is((select count(*)::int from leads), 0, 'un asesor desactivado ya no ve sus leads');
select is((select count(*)::int from usuarios), 1, 'un usuario desactivado sólo ve su propio registro');

-- -----------------------------------------------------------------------------
-- Fotos en Storage
-- -----------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"a0000000-0000-0000-0000-000000000002"}';
select lives_ok(
  $$insert into storage.objects (bucket_id, name)
    values ('propiedades', 'aaaaaaaa-0000-0000-0000-000000000000/aaaaaaaa-0000-0000-0000-0000000000f1/fachada.jpg')$$,
  'un asesor puede subir fotos a la carpeta de su inmobiliaria'
);
select throws_ok(
  $$insert into storage.objects (bucket_id, name)
    values ('propiedades', 'bbbbbbbb-0000-0000-0000-000000000000/bbbbbbbb-0000-0000-0000-0000000000f1/fachada.jpg')$$,
  '42501', null, 'nadie puede subir fotos a la carpeta de otra inmobiliaria'
);

-- -----------------------------------------------------------------------------
-- Alta self-service
-- -----------------------------------------------------------------------------
set local request.jwt.claims = '{"sub":"c0000000-0000-0000-0000-000000000001"}';
select isnt(public.crear_inmobiliaria('Nueva Inmo', 'nueva-inmo', 'Nora'), null, 'un usuario nuevo puede crear su inmobiliaria');
select is((select rol::text from usuarios where id = auth.uid()), 'dueno', 'quien crea la inmobiliaria queda como dueño');
select throws_ok(
  $$select public.crear_inmobiliaria('Otra', 'otra-inmo', 'Nora')$$,
  'P0001', null, 'no se puede crear una segunda inmobiliaria'
);

-- -----------------------------------------------------------------------------
-- Integridad aun con service role
-- -----------------------------------------------------------------------------
reset role;
select throws_ok(
  $$update leads set asesor_id = 'a0000000-0000-0000-0000-000000000002' where id = 'bbbbbbbb-0000-0000-0000-0000000000b1'$$,
  '23503', null, 'FK compuesta: un lead de B no puede asignarse a un asesor de A'
);

select * from finish();
rollback;
