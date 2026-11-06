# InmoCRM — Plataforma SaaS de IA para inmobiliarias en México

MVP de una plataforma SaaS de IA para inmobiliarias en México. El objetivo es llevar al lead desde el anuncio hasta la visita agendada, sin que un humano tenga que calificarlo.

## Contexto

Las inmobiliarias pierden leads porque tardan en contestar, no califican bien y no dan seguimiento. El dueño no ve qué hace cada asesor.

Usuarios:

- **Dueño/director de la inmobiliaria**: paga y ve reportes
- **Asesores**: reciben citas ya calificadas
- **Prospecto**: habla con el agente de IA por WhatsApp

## Stack

- Next.js (App Router) + TypeScript + Tailwind
- Supabase: PostgreSQL, Auth y cron jobs
- Multi-tenant: cada inmobiliaria es un tenant, con Row Level Security
- Claude API (SDK oficial de Anthropic) para el agente conversacional y el scoring
- WhatsApp Business Cloud API (con una capa de abstracción para poder cambiar a Twilio)
- Google Calendar API para la disponibilidad de los asesores
- Variables de entorno en `.env.example`, nunca credenciales en el código

## Modelo de datos

`inmobiliarias`, `usuarios` (rol: dueño | asesor), `propiedades`, `leads` (fuente, score, estado, asesor asignado), `conversaciones`, `mensajes`, `citas`

## Funciones del MVP

1. **Captura de leads**: webhook para Meta Lead Ads, endpoint para formularios de landing y parser de correos de Inmuebles24, Lamudi y Vivanuncios.
2. **Agente de WhatsApp**: responde en menos de 1 minuto, en español mexicano, cálido y profesional. Pregunta presupuesto, zona, tipo de propiedad, forma de pago (contado, crédito bancario, Infonavit/Fovissste) y urgencia. Recomienda propiedades del catálogo que coincidan.
3. **Scoring**: clasifica cada lead en caliente, tibio o frío con base en sus respuestas y guarda el motivo.
4. **Agenda**: ofrece horarios libres del asesor asignado desde Google Calendar y confirma la cita.
5. **Asignación de leads**: por zona o round robin, configurable por inmobiliaria.
6. **Seguimiento**: recordatorios 24 h y 2 h antes de la visita; reactivación de leads fríos a los 3, 7 y 15 días.
7. **Panel del dueño**: leads por fuente, tiempo promedio de respuesta, % de leads que llegan a cita, visitas por asesor.
8. **Catálogo de propiedades**: alta, edición y fotos.

## Fuera de alcance por ahora

Agente de voz, APIs oficiales de portales, firma de documentos, multi-idioma.

## Plan de construcción

Una fase a la vez; al terminar cada una se documenta qué se hizo y cómo probarla.

1. Esquema, auth multi-tenant y roles
2. Webhook de leads y bandeja de leads
3. Agente de WhatsApp con calificación y scoring
4. Agenda con Google Calendar
5. Recordatorios y reactivación
6. Panel del dueño

Arquitectura y decisiones técnicas: [`docs/arquitectura.md`](docs/arquitectura.md). Convenciones del proyecto: [`CLAUDE.md`](CLAUDE.md).

## Desarrollo local

Requisitos: Node 22+, pnpm, Docker (para Supabase local).

```bash
pnpm install
pnpm exec supabase start       # levanta Postgres, Auth, Storage y Mailpit
pnpm exec supabase db reset    # aplica migraciones + seed
cp .env.example .env.local     # y pega URL y llaves que imprime `supabase status`
pnpm dev                       # http://localhost:3000
```

Usuarios del seed (contraseña `inmocrm123`):

| Inmobiliaria | Dueño | Asesores |
|---|---|---|
| Casas del Bajío | ana@casasdelbajio.mx | luis@casasdelbajio.mx, marta@casasdelbajio.mx |
| Hogar Capital | beto@hogarcapital.mx | carla@hogarcapital.mx |

Los correos (invitaciones, recuperación) se ven en Mailpit: http://127.0.0.1:54324

Captura de leads (landing, Meta, correos de portales): ver [`docs/captura-de-leads.md`](docs/captura-de-leads.md).

Agente de WhatsApp (configuración, plantillas y cómo probarlo en la terminal con `pnpm agente:probar`): ver [`docs/agente-whatsapp.md`](docs/agente-whatsapp.md).

Agenda y Google Calendar: ver [`docs/agenda-google-calendar.md`](docs/agenda-google-calendar.md).

Recordatorios y reactivación (plantillas y cron): ver [`docs/seguimientos.md`](docs/seguimientos.md).

Verificación:

```bash
pnpm lint && pnpm typecheck && pnpm test   # ESLint, TypeScript, Vitest
pnpm exec supabase test db                 # pgTAP: aislamiento entre inmobiliarias y roles
```
