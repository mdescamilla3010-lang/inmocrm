-- =============================================================================
-- Datos de prueba para desarrollo local (`supabase db reset`).
-- Contraseña de todos los usuarios: inmocrm123
--
--   Casas del Bajío (Querétaro)        Hogar Capital (CDMX)
--   · ana@casasdelbajio.mx   (dueña)   · beto@hogarcapital.mx (dueño)
--   · luis@casasdelbajio.mx  (asesor)  · carla@hogarcapital.mx (asesora)
--   · marta@casasdelbajio.mx (asesora)
-- =============================================================================

with usuarios_demo (id, email, nombre) as (
  values
    ('a0000000-0000-0000-0000-000000000001'::uuid, 'ana@casasdelbajio.mx',   'Ana Gutiérrez'),
    ('a0000000-0000-0000-0000-000000000002'::uuid, 'luis@casasdelbajio.mx',  'Luis Hernández'),
    ('a0000000-0000-0000-0000-000000000003'::uuid, 'marta@casasdelbajio.mx', 'Marta Ríos'),
    ('b0000000-0000-0000-0000-000000000001'::uuid, 'beto@hogarcapital.mx',   'Alberto Sánchez'),
    ('b0000000-0000-0000-0000-000000000002'::uuid, 'carla@hogarcapital.mx',  'Carla Mendoza')
),
nuevos as (
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  )
  select
    '00000000-0000-0000-0000-000000000000', id, 'authenticated', 'authenticated', email,
    extensions.crypt('inmocrm123', extensions.gen_salt('bf')), now(),
    '{"provider":"email","providers":["email"]}', jsonb_build_object('nombre', nombre), now(), now(),
    '', '', '', ''
  from usuarios_demo
  returning id, email
)
insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), id, id::text,
       jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true),
       'email', now(), now(), now()
from nuevos;

insert into public.inmobiliarias (id, nombre, slug, zona_horaria, estrategia_asignacion, agente_nombre) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'Casas del Bajío', 'casas-del-bajio', 'America/Mexico_City', 'zona', 'Sofía'),
  ('bbbbbbbb-0000-0000-0000-000000000000', 'Hogar Capital', 'hogar-capital', 'America/Mexico_City', 'round_robin', 'Valeria');

insert into public.usuarios (id, inmobiliaria_id, rol, nombre, email, telefono) values
  ('a0000000-0000-0000-0000-000000000001', 'aaaaaaaa-0000-0000-0000-000000000000', 'dueno',  'Ana Gutiérrez',   'ana@casasdelbajio.mx',   '+524421000001'),
  ('a0000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-000000000000', 'asesor', 'Luis Hernández',  'luis@casasdelbajio.mx',  '+524421000002'),
  ('a0000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-000000000000', 'asesor', 'Marta Ríos',      'marta@casasdelbajio.mx', '+524421000003'),
  ('b0000000-0000-0000-0000-000000000001', 'bbbbbbbb-0000-0000-0000-000000000000', 'dueno',  'Alberto Sánchez', 'beto@hogarcapital.mx',   '+525510000001'),
  ('b0000000-0000-0000-0000-000000000002', 'bbbbbbbb-0000-0000-0000-000000000000', 'asesor', 'Carla Mendoza',   'carla@hogarcapital.mx',  '+525510000002');

-- La dueña de Casas del Bajío no recibe leads; sólo supervisa.
update public.usuarios set recibe_leads = false where id = 'a0000000-0000-0000-0000-000000000001';

insert into public.zonas (id, inmobiliaria_id, nombre, alias) values
  ('aaaaaaaa-0000-0000-0000-0000000000e1', 'aaaaaaaa-0000-0000-0000-000000000000', 'Juriquilla', '{"Juriquilla","Jurica","Real de Juriquilla"}'),
  ('aaaaaaaa-0000-0000-0000-0000000000e2', 'aaaaaaaa-0000-0000-0000-000000000000', 'Zibatá',     '{"Zibata","El Marqués"}'),
  ('aaaaaaaa-0000-0000-0000-0000000000e3', 'aaaaaaaa-0000-0000-0000-000000000000', 'Centro Sur', '{"Centro Sur","Milenio III","El Refugio"}'),
  ('bbbbbbbb-0000-0000-0000-0000000000e1', 'bbbbbbbb-0000-0000-0000-000000000000', 'Del Valle',  '{"Del Valle","Narvarte","Benito Juárez"}'),
  ('bbbbbbbb-0000-0000-0000-0000000000e2', 'bbbbbbbb-0000-0000-0000-000000000000', 'Polanco',    '{"Polanco","Polanquito","Granada"}');

insert into public.asesor_zonas (inmobiliaria_id, asesor_id, zona_id) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-0000000000e1'),
  ('aaaaaaaa-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000002', 'aaaaaaaa-0000-0000-0000-0000000000e2'),
  ('aaaaaaaa-0000-0000-0000-000000000000', 'a0000000-0000-0000-0000-000000000003', 'aaaaaaaa-0000-0000-0000-0000000000e3');

insert into public.propiedades (
  inmobiliaria_id, clave, titulo, descripcion, tipo, operacion, precio, zona_id, colonia, municipio,
  entidad_federativa, recamaras, banos, estacionamientos, m2_construccion, m2_terreno,
  acepta_credito_bancario, acepta_infonavit, acepta_fovissste, amenidades, asesor_responsable_id
) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'CB-001', 'Casa en Juriquilla con jardín',
   'Casa de dos plantas en privada con vigilancia, cerca de la UNAM Juriquilla.',
   'casa', 'venta', 4850000, 'aaaaaaaa-0000-0000-0000-0000000000e1', 'Juriquilla', 'Querétaro', 'Querétaro',
   3, 2.5, 2, 210, 180, true, false, false, '{"jardín","seguridad 24/7","casa club"}', 'a0000000-0000-0000-0000-000000000002'),
  ('aaaaaaaa-0000-0000-0000-000000000000', 'CB-002', 'Departamento en Zibatá',
   'Departamento nuevo con vista al campo de golf.',
   'departamento', 'venta', 2650000, 'aaaaaaaa-0000-0000-0000-0000000000e2', 'Zibatá', 'El Marqués', 'Querétaro',
   2, 2, 1, 95, null, true, true, false, '{"alberca","gimnasio"}', 'a0000000-0000-0000-0000-000000000002'),
  ('aaaaaaaa-0000-0000-0000-000000000000', 'CB-003', 'Casa Infonavit en El Refugio',
   'Ideal para primera vivienda, acepta Infonavit y Fovissste.',
   'casa', 'venta', 1890000, 'aaaaaaaa-0000-0000-0000-0000000000e3', 'El Refugio', 'Querétaro', 'Querétaro',
   2, 1.5, 1, 90, 105, true, true, true, '{"parque","escuelas cerca"}', 'a0000000-0000-0000-0000-000000000003'),
  ('aaaaaaaa-0000-0000-0000-000000000000', 'CB-004', 'Terreno residencial en Zibatá',
   'Lote plano listo para construir.',
   'terreno', 'venta', 1450000, 'aaaaaaaa-0000-0000-0000-0000000000e2', 'Zibatá', 'El Marqués', 'Querétaro',
   null, null, null, null, 250, true, false, false, '{}', null),
  ('bbbbbbbb-0000-0000-0000-000000000000', 'HC-101', 'Departamento remodelado en Del Valle',
   'A dos cuadras del metro, con roof garden común.',
   'departamento', 'venta', 5200000, 'bbbbbbbb-0000-0000-0000-0000000000e1', 'Del Valle Centro', 'Benito Juárez', 'Ciudad de México',
   2, 2, 1, 88, null, true, true, true, '{"roof garden","elevador"}', 'b0000000-0000-0000-0000-000000000002'),
  ('bbbbbbbb-0000-0000-0000-000000000000', 'HC-102', 'Departamento en renta en Polanco',
   'Amueblado, listo para habitar.',
   'departamento', 'renta', 38000, 'bbbbbbbb-0000-0000-0000-0000000000e2', 'Polanco V Sección', 'Miguel Hidalgo', 'Ciudad de México',
   2, 2, 2, 120, null, false, false, false, '{"amueblado","gimnasio","seguridad 24/7"}', 'b0000000-0000-0000-0000-000000000002');

-- -----------------------------------------------------------------------------
-- Leads de ejemplo (el trigger registra "capturado" y "asignado" en la línea de tiempo)
-- -----------------------------------------------------------------------------
insert into public.leads (
  inmobiliaria_id, nombre, telefono, email, fuente, fuente_detalle, mensaje_inicial, estado, asesor_id, asignado_en,
  zona_interes, zona_id, presupuesto_min, presupuesto_max, forma_pago, urgencia, tipo_propiedad_interes, operacion_interes,
  creado_en
) values
  ('aaaaaaaa-0000-0000-0000-000000000000', 'María Fernanda Ruiz', '+524421234567', 'mafer.ruiz@gmail.com', 'inmuebles24',
   '{"referencia":"CB-001"}', 'Hola, ¿sigue disponible? ¿Aceptan crédito Infonavit?', 'nuevo',
   'a0000000-0000-0000-0000-000000000002', now() - interval '20 minutes', 'Juriquilla', 'aaaaaaaa-0000-0000-0000-0000000000e1',
   null, null, null, null, 'casa', 'venta', now() - interval '20 minutes'),
  ('aaaaaaaa-0000-0000-0000-000000000000', 'Jorge Medina', '+525598765432', 'jorge.medina@outlook.com', 'meta_ads',
   '{"form_id":"555","campaign_id":"preventa-zibata"}', 'presupuesto: 2.5 a 3 millones' || chr(10) || 'zona de interés: Zibatá', 'en_conversacion',
   'a0000000-0000-0000-0000-000000000002', now() - interval '3 hours', 'Zibatá', 'aaaaaaaa-0000-0000-0000-0000000000e2',
   2500000, 3000000, 'credito_bancario', 'uno_a_tres_meses', 'departamento', 'venta', now() - interval '3 hours'),
  ('aaaaaaaa-0000-0000-0000-000000000000', 'Laura Gómez', '+524427654321', null, 'landing',
   '{"utm_source":"facebook","utm_campaign":"infonavit"}', 'Busco casa con Infonavit por El Refugio', 'calificado',
   'a0000000-0000-0000-0000-000000000003', now() - interval '1 day', 'El Refugio', 'aaaaaaaa-0000-0000-0000-0000000000e3',
   1500000, 2000000, 'infonavit', 'menos_1_mes', 'casa', 'venta', now() - interval '1 day'),
  ('aaaaaaaa-0000-0000-0000-000000000000', 'Pedro Salinas', '+524429990000', 'pedro@empresa.mx', 'lamudi',
   '{}', '¿Tienen terrenos en Zibatá?', 'perdido',
   'a0000000-0000-0000-0000-000000000002', now() - interval '12 days', 'Zibatá', 'aaaaaaaa-0000-0000-0000-0000000000e2',
   null, 1500000, 'contado', 'mas_de_seis_meses', 'terreno', 'venta', now() - interval '12 days'),
  ('aaaaaaaa-0000-0000-0000-000000000000', null, '+524421112233', null, 'vivanuncios',
   '{}', 'Info del depa por favor', 'nuevo', null, null, null, null,
   null, null, null, null, null, null, now() - interval '5 minutes'),
  ('bbbbbbbb-0000-0000-0000-000000000000', 'Andrea Castillo', '+525511223344', 'andrea.c@gmail.com', 'meta_ads',
   '{}', 'Me interesa rentar en Polanco', 'nuevo',
   'b0000000-0000-0000-0000-000000000002', now() - interval '2 hours', 'Polanco', 'bbbbbbbb-0000-0000-0000-0000000000e2',
   null, 40000, null, 'menos_1_mes', 'departamento', 'renta', now() - interval '2 hours');

-- Los eventos del trigger usan now(); se alinean con la fecha de llegada del lead.
update public.eventos_lead e set creado_en = l.creado_en
from public.leads l where l.id = e.lead_id;
