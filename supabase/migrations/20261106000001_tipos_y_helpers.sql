-- =============================================================================
-- 0001 · Extensiones, tipos enumerados y funciones auxiliares
-- =============================================================================

create extension if not exists pgcrypto with schema extensions;
-- btree_gist permite la restricción EXCLUDE que evita citas empalmadas por asesor.
create extension if not exists btree_gist with schema extensions;

-- Esquema privado para helpers de RLS y triggers (no expuesto por la API REST).
create schema if not exists app;
grant usage on schema app to authenticated, service_role;

-- -----------------------------------------------------------------------------
-- Tipos
-- -----------------------------------------------------------------------------
create type public.rol_usuario as enum ('dueno', 'asesor');

create type public.estrategia_asignacion as enum ('round_robin', 'zona');

create type public.fuente_lead as enum (
  'meta_ads', 'landing', 'inmuebles24', 'lamudi', 'vivanuncios',
  'whatsapp',   -- el prospecto escribió directo al número
  'manual'      -- capturado a mano por un asesor o el dueño
);

create type public.estado_lead as enum (
  'nuevo',             -- capturado, aún sin respuesta del prospecto
  'en_conversacion',   -- el agente está calificando
  'calificado',        -- ya tenemos los datos clave
  'cita_agendada',
  'visita_realizada',
  'ganado',
  'perdido',
  'descartado'         -- spam, duplicado, sin interés real, opt-out
);

create type public.score_lead as enum ('caliente', 'tibio', 'frio');

create type public.forma_pago as enum (
  'contado', 'credito_bancario', 'infonavit', 'fovissste', 'otro'
);

create type public.urgencia_lead as enum (
  'menos_1_mes', 'uno_a_tres_meses', 'tres_a_seis_meses', 'mas_de_seis_meses', 'sin_definir'
);

create type public.tipo_propiedad as enum (
  'casa', 'departamento', 'terreno', 'local_comercial', 'oficina', 'bodega', 'otro'
);

create type public.operacion_propiedad as enum ('venta', 'renta');

create type public.estado_propiedad as enum (
  'borrador', 'disponible', 'apartada', 'vendida', 'rentada', 'inactiva'
);

create type public.direccion_mensaje as enum ('entrante', 'saliente');

create type public.autor_mensaje as enum ('prospecto', 'agente', 'asesor', 'sistema');

create type public.estado_mensaje as enum (
  'recibido', 'en_cola', 'enviado', 'entregado', 'leido', 'fallido'
);

create type public.estado_cita as enum (
  'programada', 'confirmada', 'realizada', 'no_asistio', 'cancelada'
);

create type public.tipo_seguimiento as enum (
  'recordatorio_24h', 'recordatorio_2h',
  'reactivacion_3d', 'reactivacion_7d', 'reactivacion_15d'
);

create type public.estado_seguimiento as enum (
  'pendiente', 'procesando', 'enviado', 'cancelado', 'fallido'
);

create type public.proveedor_integracion as enum (
  'whatsapp_cloud', 'twilio', 'google_calendar', 'meta_leads'
);

-- -----------------------------------------------------------------------------
-- Trigger genérico de actualizado_en
-- -----------------------------------------------------------------------------
create or replace function app.set_actualizado_en()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.actualizado_en := now();
  return new;
end;
$$;
