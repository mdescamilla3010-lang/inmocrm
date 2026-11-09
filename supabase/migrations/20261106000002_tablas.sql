-- =============================================================================
-- 0002 · Tablas del dominio
--
-- Convención multi-tenant: toda tabla tiene inmobiliaria_id y expone
-- unique (inmobiliaria_id, id) para que las FK compuestas impidan que un
-- registro apunte a otro de una inmobiliaria distinta.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- inmobiliarias (tenant)
-- -----------------------------------------------------------------------------
create table public.inmobiliarias (
  id                         uuid primary key default gen_random_uuid(),
  nombre                     text not null check (length(trim(nombre)) > 0),
  -- Se usa en el correo entrante: <slug>@leads.<dominio>
  slug                       text not null unique check (slug ~ '^[a-z0-9][a-z0-9-]{2,39}$'),
  zona_horaria               text not null default 'America/Mexico_City',
  estrategia_asignacion      public.estrategia_asignacion not null default 'round_robin',
  -- Puntero del round robin (FK se agrega tras crear usuarios).
  ultimo_asesor_asignado_id  uuid,
  -- Personalización del agente de IA
  agente_nombre              text not null default 'Sofía',
  agente_instrucciones       text,             -- tono, datos de la empresa, políticas
  -- Horario en que se pueden agendar visitas (hora local). null = día cerrado.
  horario_visitas            jsonb not null default '{
    "lun": ["09:00", "19:00"], "mar": ["09:00", "19:00"], "mie": ["09:00", "19:00"],
    "jue": ["09:00", "19:00"], "vie": ["09:00", "19:00"], "sab": ["10:00", "14:00"],
    "dom": null
  }'::jsonb,
  duracion_cita_min          smallint not null default 60 check (duracion_cita_min between 15 and 240),
  -- Clave pública que identifica al tenant en el endpoint de formularios de landing.
  clave_landing              text not null unique default encode(extensions.gen_random_bytes(16), 'hex'),
  creado_en                  timestamptz not null default now(),
  actualizado_en             timestamptz not null default now()
);

-- -----------------------------------------------------------------------------
-- usuarios (dueño | asesor). 1 usuario = 1 inmobiliaria en el MVP.
-- -----------------------------------------------------------------------------
create table public.usuarios (
  id                  uuid primary key references auth.users (id) on delete cascade,
  inmobiliaria_id     uuid not null references public.inmobiliarias (id) on delete cascade,
  rol                 public.rol_usuario not null,
  nombre              text not null,
  email               text not null,
  telefono            text check (telefono ~ '^\+[1-9][0-9]{7,14}$'),
  activo              boolean not null default true,
  -- Entra en la asignación automática de leads (el dueño también puede vender).
  recibe_leads        boolean not null default true,
  google_calendar_id  text default 'primary',
  creado_en           timestamptz not null default now(),
  actualizado_en      timestamptz not null default now(),
  unique (inmobiliaria_id, id)
);
create index usuarios_inmobiliaria_idx on public.usuarios (inmobiliaria_id, rol) where activo;

alter table public.inmobiliarias
  add constraint inmobiliarias_ultimo_asesor_fk
  foreign key (id, ultimo_asesor_asignado_id)
  references public.usuarios (inmobiliaria_id, id)
  on delete set null (ultimo_asesor_asignado_id)
  deferrable initially deferred;

-- -----------------------------------------------------------------------------
-- zonas y su relación con asesores (asignación por zona)
-- -----------------------------------------------------------------------------
create table public.zonas (
  id               uuid primary key default gen_random_uuid(),
  inmobiliaria_id  uuid not null references public.inmobiliarias (id) on delete cascade,
  nombre           text not null,
  -- Sinónimos para que el agente reconozca la zona ("Polanco", "Polanco V Sección", "Polanquito").
  alias            text[] not null default '{}',
  creado_en        timestamptz not null default now(),
  unique (inmobiliaria_id, id),
  unique (inmobiliaria_id, nombre)
);

create table public.asesor_zonas (
  inmobiliaria_id  uuid not null,
  asesor_id        uuid not null,
  zona_id          uuid not null,
  primary key (asesor_id, zona_id),
  foreign key (inmobiliaria_id, asesor_id) references public.usuarios (inmobiliaria_id, id) on delete cascade,
  foreign key (inmobiliaria_id, zona_id)   references public.zonas (inmobiliaria_id, id) on delete cascade
);
create index asesor_zonas_zona_idx on public.asesor_zonas (inmobiliaria_id, zona_id);

-- -----------------------------------------------------------------------------
-- propiedades y fotos
-- -----------------------------------------------------------------------------
create table public.propiedades (
  id                     uuid primary key default gen_random_uuid(),
  inmobiliaria_id        uuid not null references public.inmobiliarias (id) on delete cascade,
  clave                  text,                    -- folio interno de la inmobiliaria
  titulo                 text not null,
  descripcion            text,
  tipo                   public.tipo_propiedad not null,
  operacion              public.operacion_propiedad not null default 'venta',
  estado                 public.estado_propiedad not null default 'disponible',
  precio                 numeric(14, 2) not null check (precio > 0),
  moneda                 char(3) not null default 'MXN' check (moneda in ('MXN', 'USD')),
  zona_id                uuid,
  colonia                text,
  municipio              text,
  entidad_federativa     text,
  codigo_postal          text check (codigo_postal ~ '^[0-9]{5}$'),
  direccion              text,                    -- se comparte sólo al confirmar cita
  latitud                numeric(9, 6),
  longitud               numeric(9, 6),
  recamaras              smallint check (recamaras >= 0),
  banos                  numeric(3, 1) check (banos >= 0),
  estacionamientos       smallint check (estacionamientos >= 0),
  m2_construccion        numeric(10, 2) check (m2_construccion > 0),
  m2_terreno             numeric(10, 2) check (m2_terreno > 0),
  acepta_credito_bancario boolean not null default true,
  acepta_infonavit        boolean not null default false,
  acepta_fovissste        boolean not null default false,
  amenidades             text[] not null default '{}',
  asesor_responsable_id  uuid,
  creado_por             uuid references public.usuarios (id) on delete set null,
  creado_en              timestamptz not null default now(),
  actualizado_en         timestamptz not null default now(),
  unique (inmobiliaria_id, id),
  unique (inmobiliaria_id, clave),
  foreign key (inmobiliaria_id, zona_id)
    references public.zonas (inmobiliaria_id, id) on delete set null (zona_id),
  foreign key (inmobiliaria_id, asesor_responsable_id)
    references public.usuarios (inmobiliaria_id, id) on delete set null (asesor_responsable_id)
);
-- Índice para el recomendador del agente (filtra por estado, operación, tipo, zona y precio).
create index propiedades_busqueda_idx
  on public.propiedades (inmobiliaria_id, estado, operacion, tipo, zona_id, precio);

create table public.propiedad_fotos (
  id               uuid primary key default gen_random_uuid(),
  inmobiliaria_id  uuid not null,
  propiedad_id     uuid not null,
  -- Ruta en Storage: <inmobiliaria_id>/<propiedad_id>/<archivo>
  ruta_storage     text not null unique,
  orden            smallint not null default 0,
  es_portada       boolean not null default false,
  creado_en        timestamptz not null default now(),
  foreign key (inmobiliaria_id, propiedad_id)
    references public.propiedades (inmobiliaria_id, id) on delete cascade
);
create index propiedad_fotos_propiedad_idx on public.propiedad_fotos (propiedad_id, orden);
create unique index propiedad_fotos_una_portada on public.propiedad_fotos (propiedad_id) where es_portada;

-- -----------------------------------------------------------------------------
-- leads
-- -----------------------------------------------------------------------------
create table public.leads (
  id                      uuid primary key default gen_random_uuid(),
  inmobiliaria_id         uuid not null references public.inmobiliarias (id) on delete cascade,
  nombre                  text,
  telefono                text check (telefono ~ '^\+[1-9][0-9]{7,14}$'),
  email                   text,
  -- Fuente de la PRIMERA captura (las recapturas quedan en eventos_lead).
  fuente                  public.fuente_lead not null,
  fuente_detalle          jsonb not null default '{}', -- campaña, form_id, id del anuncio en portal…
  propiedad_interes_id    uuid,                         -- anuncio por el que llegó
  mensaje_inicial         text,

  -- Calificación (la llena el agente; el asesor puede corregir)
  operacion_interes       public.operacion_propiedad,
  tipo_propiedad_interes  public.tipo_propiedad,
  zona_interes            text,                         -- texto libre del prospecto
  zona_id                 uuid,                         -- zona resuelta del catálogo
  presupuesto_min         numeric(14, 2) check (presupuesto_min >= 0),
  presupuesto_max         numeric(14, 2) check (presupuesto_max >= 0),
  forma_pago              public.forma_pago,
  credito_preaprobado     boolean,
  urgencia                public.urgencia_lead,
  recamaras_min           smallint,
  notas_calificacion      text,

  -- Scoring (calculado por código determinista; ver lib/scoring)
  score                   public.score_lead,
  score_puntos            smallint check (score_puntos between 0 and 100),
  score_motivo            text,
  score_actualizado_en    timestamptz,

  estado                  public.estado_lead not null default 'nuevo',
  asesor_id               uuid,
  asignado_en             timestamptz,

  -- Métricas
  primer_contacto_en      timestamptz,  -- primer mensaje saliente → tiempo de respuesta
  ultimo_mensaje_en       timestamptz,

  opt_out                 boolean not null default false,
  datos_crudos            jsonb,         -- payload original del webhook/correo
  creado_en               timestamptz not null default now(),
  actualizado_en          timestamptz not null default now(),

  unique (inmobiliaria_id, id),
  check (presupuesto_max is null or presupuesto_min is null or presupuesto_max >= presupuesto_min),
  check (telefono is not null or email is not null),
  foreign key (inmobiliaria_id, asesor_id)
    references public.usuarios (inmobiliaria_id, id) on delete set null (asesor_id),
  foreign key (inmobiliaria_id, zona_id)
    references public.zonas (inmobiliaria_id, id) on delete set null (zona_id),
  foreign key (inmobiliaria_id, propiedad_interes_id)
    references public.propiedades (inmobiliaria_id, id) on delete set null (propiedad_interes_id)
);
-- Deduplicación: un teléfono = un lead por inmobiliaria.
create unique index leads_telefono_unico on public.leads (inmobiliaria_id, telefono) where telefono is not null;
create index leads_email_idx      on public.leads (inmobiliaria_id, lower(email)) where email is not null;
create index leads_bandeja_idx    on public.leads (inmobiliaria_id, estado, creado_en desc);
create index leads_asesor_idx     on public.leads (inmobiliaria_id, asesor_id, creado_en desc);
create index leads_fuente_idx     on public.leads (inmobiliaria_id, fuente, creado_en);

-- -----------------------------------------------------------------------------
-- conversaciones y mensajes
-- -----------------------------------------------------------------------------
create table public.conversaciones (
  id                   uuid primary key default gen_random_uuid(),
  inmobiliaria_id      uuid not null,
  lead_id              uuid not null,
  canal                text not null default 'whatsapp' check (canal in ('whatsapp')),
  -- false cuando un asesor toma el control: el agente deja de responder.
  ia_activa            boolean not null default true,
  -- Último mensaje del prospecto: define la ventana de 24 h de WhatsApp
  -- (fuera de ella sólo se pueden enviar plantillas aprobadas).
  ultimo_entrante_en   timestamptz,
  resumen              text,          -- resumen para el asesor generado por IA
  cerrada_en           timestamptz,
  creado_en            timestamptz not null default now(),
  actualizado_en       timestamptz not null default now(),
  unique (inmobiliaria_id, id),
  unique (inmobiliaria_id, lead_id, canal),
  foreign key (inmobiliaria_id, lead_id)
    references public.leads (inmobiliaria_id, id) on delete cascade
);

create table public.mensajes (
  id                     uuid primary key default gen_random_uuid(),
  inmobiliaria_id        uuid not null,
  conversacion_id        uuid not null,
  direccion              public.direccion_mensaje not null,
  autor                  public.autor_mensaje not null,
  asesor_id              uuid,                    -- si autor = 'asesor'
  tipo                   text not null default 'texto'
                         check (tipo in ('texto', 'imagen', 'plantilla', 'ubicacion',
                                         'interactivo', 'audio', 'documento')),
  contenido              text,
  metadatos              jsonb not null default '{}', -- plantilla, media, tool calls del agente
  proveedor_mensaje_id   text,                        -- wamid de WhatsApp / SID de Twilio
  estado                 public.estado_mensaje not null,
  error                  text,
  creado_en              timestamptz not null default now(),
  check ((autor = 'asesor') = (asesor_id is not null)),
  foreign key (inmobiliaria_id, conversacion_id)
    references public.conversaciones (inmobiliaria_id, id) on delete cascade,
  foreign key (inmobiliaria_id, asesor_id)
    references public.usuarios (inmobiliaria_id, id) on delete set null (asesor_id)
);
-- Idempotencia: WhatsApp reintenta webhooks; el mismo wamid no se guarda dos veces.
create unique index mensajes_proveedor_id_unico on public.mensajes (proveedor_mensaje_id)
  where proveedor_mensaje_id is not null;
create index mensajes_conversacion_idx on public.mensajes (conversacion_id, creado_en);

-- -----------------------------------------------------------------------------
-- citas
-- -----------------------------------------------------------------------------
create table public.citas (
  id                uuid primary key default gen_random_uuid(),
  inmobiliaria_id   uuid not null,
  lead_id           uuid not null,
  asesor_id         uuid not null,
  propiedad_id      uuid,
  inicio            timestamptz not null,
  fin               timestamptz not null,
  estado            public.estado_cita not null default 'programada',
  origen            text not null default 'agente' check (origen in ('agente', 'asesor')),
  google_event_id   text,
  notas             text,
  motivo_cancelacion text,
  creado_en         timestamptz not null default now(),
  actualizado_en    timestamptz not null default now(),
  unique (inmobiliaria_id, id),
  check (fin > inicio),
  foreign key (inmobiliaria_id, lead_id)
    references public.leads (inmobiliaria_id, id) on delete cascade,
  foreign key (inmobiliaria_id, asesor_id)
    references public.usuarios (inmobiliaria_id, id),
  foreign key (inmobiliaria_id, propiedad_id)
    references public.propiedades (inmobiliaria_id, id) on delete set null (propiedad_id),
  -- Un asesor no puede tener dos citas activas empalmadas.
  constraint citas_sin_empalmes exclude using gist (
    asesor_id with =,
    tstzrange(inicio, fin) with &&
  ) where (estado in ('programada', 'confirmada'))
);
create index citas_agenda_idx on public.citas (inmobiliaria_id, asesor_id, inicio);
create index citas_lead_idx   on public.citas (lead_id);

-- -----------------------------------------------------------------------------
-- seguimientos: cola de recordatorios y reactivaciones que procesa el cron
-- -----------------------------------------------------------------------------
create table public.seguimientos (
  id                uuid primary key default gen_random_uuid(),
  inmobiliaria_id   uuid not null,
  lead_id           uuid not null,
  cita_id           uuid,
  tipo              public.tipo_seguimiento not null,
  programado_para   timestamptz not null,
  estado            public.estado_seguimiento not null default 'pendiente',
  intentos          smallint not null default 0,
  ultimo_error      text,
  ejecutado_en      timestamptz,
  creado_en         timestamptz not null default now(),
  check ((tipo in ('recordatorio_24h', 'recordatorio_2h')) = (cita_id is not null)),
  foreign key (inmobiliaria_id, lead_id)
    references public.leads (inmobiliaria_id, id) on delete cascade,
  foreign key (inmobiliaria_id, cita_id)
    references public.citas (inmobiliaria_id, id) on delete cascade
);
create unique index seguimientos_recordatorio_unico on public.seguimientos (cita_id, tipo)
  where cita_id is not null;
create index seguimientos_pendientes_idx on public.seguimientos (programado_para)
  where estado = 'pendiente';
create index seguimientos_lead_idx on public.seguimientos (lead_id);

-- -----------------------------------------------------------------------------
-- eventos_lead: línea de tiempo / auditoría (asignaciones, cambios de score,
-- recapturas desde otra fuente, notas del asesor…)
-- -----------------------------------------------------------------------------
create table public.eventos_lead (
  id                bigint generated always as identity primary key,
  inmobiliaria_id   uuid not null,
  lead_id           uuid not null,
  tipo              text not null check (tipo in (
                      'capturado', 'recapturado', 'asignado', 'reasignado',
                      'score_cambiado', 'estado_cambiado', 'cita_agendada',
                      'cita_cancelada', 'ia_pausada', 'ia_reanudada', 'opt_out', 'nota')),
  usuario_id        uuid,              -- null = sistema / agente
  datos             jsonb not null default '{}',
  creado_en         timestamptz not null default now(),
  foreign key (inmobiliaria_id, lead_id)
    references public.leads (inmobiliaria_id, id) on delete cascade,
  foreign key (inmobiliaria_id, usuario_id)
    references public.usuarios (inmobiliaria_id, id) on delete set null (usuario_id)
);
create index eventos_lead_idx on public.eventos_lead (lead_id, creado_en);

-- -----------------------------------------------------------------------------
-- integraciones: credenciales de terceros por inmobiliaria (y por asesor para Google)
-- -----------------------------------------------------------------------------
create table public.integraciones (
  id                     uuid primary key default gen_random_uuid(),
  inmobiliaria_id        uuid not null references public.inmobiliarias (id) on delete cascade,
  usuario_id             uuid,     -- sólo google_calendar (una cuenta por asesor)
  proveedor              public.proveedor_integracion not null,
  -- Con esto se enruta un webhook a su tenant: phone_number_id (WhatsApp),
  -- page_id (Meta Lead Ads), correo de Google.
  identificador_externo  text not null,
  credenciales_cifradas  text,     -- AES-256-GCM con ENCRYPTION_KEY; nunca legible por el cliente
  config                 jsonb not null default '{}',
  activa                 boolean not null default true,
  creado_en              timestamptz not null default now(),
  actualizado_en         timestamptz not null default now(),
  unique (proveedor, identificador_externo),
  check ((proveedor = 'google_calendar') = (usuario_id is not null)),
  foreign key (inmobiliaria_id, usuario_id)
    references public.usuarios (inmobiliaria_id, id) on delete cascade
);
create index integraciones_inmobiliaria_idx on public.integraciones (inmobiliaria_id, proveedor);

-- -----------------------------------------------------------------------------
-- Triggers de actualizado_en
-- -----------------------------------------------------------------------------
create trigger set_actualizado_en before update on public.inmobiliarias  for each row execute function app.set_actualizado_en();
create trigger set_actualizado_en before update on public.usuarios       for each row execute function app.set_actualizado_en();
create trigger set_actualizado_en before update on public.propiedades    for each row execute function app.set_actualizado_en();
create trigger set_actualizado_en before update on public.leads          for each row execute function app.set_actualizado_en();
create trigger set_actualizado_en before update on public.conversaciones for each row execute function app.set_actualizado_en();
create trigger set_actualizado_en before update on public.citas          for each row execute function app.set_actualizado_en();
create trigger set_actualizado_en before update on public.integraciones  for each row execute function app.set_actualizado_en();
