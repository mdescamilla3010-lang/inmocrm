# CLAUDE.md — Convenciones de InmoCRM

Guía para cualquier persona (o agente) que trabaje en este repo. El brief del producto está en `README.md`; la arquitectura y las decisiones en `docs/arquitectura.md`.

## Forma de trabajo

- Construir **una fase a la vez** (ver README). Al cerrar una fase: resumen de lo hecho + cómo probarlo.
- Si algo del brief es ambiguo, **preguntar antes de suponer**. Registrar la decisión en `docs/arquitectura.md` (sección "Decisiones").
- Commits pequeños, en español, en imperativo, con prefijo convencional: `feat:`, `fix:`, `test:`, `docs:`, `chore:`, `refactor:`, `db:` (migraciones).
- No hay merge a `main` sin que pasen `pnpm lint`, `pnpm typecheck` y `pnpm test`.

## Idioma

- UI, mensajes del agente, errores visibles y documentación: **español de México**.
- Identificadores del dominio (tablas, columnas, tipos, funciones de negocio) en **español, sin acentos ni ñ**: `dueno`, `banos`, `inmobiliaria_id`, `calcularScore`.
- Términos técnicos estándar se quedan en inglés cuando no tienen traducción natural: `webhook`, `lead`, `score`, `round_robin`, `route.ts`, `middleware`.
- Comentarios en español, sólo cuando explican el *porqué*.

## Stack y herramientas

- Next.js (App Router) + TypeScript estricto (`strict: true`, sin `any` implícito) + Tailwind.
- Gestor de paquetes: **pnpm**. Pruebas: **Vitest**. Validación de entradas: **Zod** (todo body de webhook, formulario o salida de herramienta del agente se valida con Zod).
- Supabase (Postgres + Auth + Storage + `pg_cron`). Supabase CLI para desarrollo local (`supabase start`).
- Claude vía `@anthropic-ai/sdk`. El modelo se configura con variable de entorno, nunca hardcodeado en la lógica.

## Multi-tenant y seguridad (no negociable)

- **Toda tabla de negocio tiene `inmobiliaria_id`**, RLS habilitado, políticas explícitas e índice que empiece por `inmobiliaria_id`.
- Las relaciones entre tablas de negocio usan **FK compuestas** `(inmobiliaria_id, x_id)` para que la base impida mezclar datos de dos inmobiliarias.
- Dos clientes de Supabase:
  - `lib/supabase/server.ts` — sesión del usuario, **respeta RLS**. Es el default en páginas y server actions.
  - `lib/supabase/admin.ts` — service role, **salta RLS**. Sólo en webhooks, cron y el agente. Importa `server-only`. **Cada consulta con este cliente debe filtrar por `inmobiliaria_id`** de forma explícita.
- El tenant se resuelve **en el servidor** (sesión, `phone_number_id` de WhatsApp, slug del correo entrante, clave de landing), nunca por un parámetro que mande el cliente.
- Funciones auxiliares de RLS viven en el esquema `app` (`app.inmobiliaria_id()`, `app.es_dueno()`), son `security definer` con `search_path = ''`. En políticas se llaman envueltas en `(select ...)`.
- Tokens de terceros (WhatsApp, Google) se guardan **cifrados** (AES-256-GCM, `ENCRYPTION_KEY`) en `integraciones.credenciales_cifradas`; esa columna no es legible por usuarios autenticados.
- Webhooks: verificar firma (`X-Hub-Signature-256` de Meta, secreto compartido en correo/landing), ser **idempotentes** (ids externos únicos) y responder 200 rápido; el trabajo pesado se hace con `after()`.
- Respetar opt-out: si el prospecto pide no ser contactado, `leads.opt_out = true` y se cancelan seguimientos.

## Variables de entorno

- Todas se documentan en `.env.example` con un valor de ejemplo falso. **Nunca** se commitean credenciales reales ni `.env.local`.
- Se leen a través de `lib/env.ts` (validado con Zod) — no usar `process.env.X` disperso por el código.

## Base de datos

- Migraciones en `supabase/migrations/`, nombre `AAAAMMDDHHMMSS_descripcion.sql`. **Nunca editar una migración ya aplicada**: crear una nueva.
- Fechas en `timestamptz` (UTC). Se muestran en la zona horaria de la inmobiliaria (`inmobiliarias.zona_horaria`).
- Teléfonos en **E.164** (`+5215512345678` → normalizar a `+525512345678`). Montos en `numeric(14,2)` MXN.
- Columnas de auditoría: `creado_en`, `actualizado_en` (trigger `app.set_actualizado_en`).
- Tipos de TS de la base se generan con `pnpm db:types` (no editarlos a mano).

## Estructura y diseño de código

- Lógica de negocio en `src/lib/<dominio>/` como **funciones puras sin I/O** cuando sea posible (scoring, asignación, cálculo de horarios libres, parsers de correos). Las rutas y server actions sólo orquestan.
- Integraciones externas detrás de interfaces:
  - Mensajería: `ProveedorMensajeria` (`lib/mensajeria/`). Implementaciones `whatsapp-cloud` y `twilio`. **Nunca** llamar a la API de WhatsApp fuera de ese módulo.
  - Calendario: `ProveedorCalendario` (`lib/calendario/`).
- El agente de IA no escribe en la base directamente: propone acciones vía *tool use* (`guardar_calificacion`, `buscar_propiedades`, `ofrecer_horarios`, `agendar_cita`, `escalar_a_asesor`) que el orquestador valida y ejecuta.
- El **score lo calcula código determinista** a partir de los datos que extrae Claude; así es auditable y se puede probar.

## Pruebas

- Vitest, archivos `*.test.ts` junto al código.
- Obligatorio: **scoring**, **asignación**, cálculo de **disponibilidad**, **parsers** de portales y **normalización de teléfonos**.
- Aislamiento multi-tenant: pruebas de RLS con pgTAP en `supabase/tests/` (`supabase test db`).
- Llamadas a Claude, WhatsApp y Google se mockean en pruebas unitarias.

## Comandos (se habilitan en la fase 1)

```bash
pnpm dev          # Next.js en local
pnpm test         # Vitest
pnpm lint         # ESLint
pnpm typecheck    # tsc --noEmit
supabase start    # Supabase local
supabase db reset # reaplica migraciones + seed
supabase test db  # pruebas pgTAP (RLS)
pnpm db:types     # genera src/lib/supabase/database.types.ts
```
