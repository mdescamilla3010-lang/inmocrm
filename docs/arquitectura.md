# Arquitectura

## 1. Estructura de carpetas

```
inmocrm/
├── README.md                     # brief del producto
├── CLAUDE.md                     # convenciones
├── .env.example
├── docs/
│   └── arquitectura.md
├── supabase/
│   ├── config.toml
│   ├── migrations/               # SQL versionado (ver §2)
│   ├── tests/                    # pgTAP: aislamiento multi-tenant y roles
│   └── seed.sql                  # 2 inmobiliarias demo, asesores, propiedades
└── src/
    ├── proxy.ts                  # (antes middleware) refresca sesión y protege el panel
    ├── app/
    │   ├── (publico)/
    │   │   ├── login/
    │   │   ├── registro/         # alta del dueño + crear_inmobiliaria()
    │   │   └── invitacion/       # el asesor acepta la invitación
    │   ├── (panel)/              # requiere sesión
    │   │   ├── leads/            # bandeja + detalle (conversación, timeline, score)
    │   │   │   └── [id]/
    │   │   ├── citas/
    │   │   ├── propiedades/      # catálogo: alta, edición, fotos
    │   │   │   ├── nueva/
    │   │   │   └── [id]/
    │   │   ├── reportes/         # panel del dueño (sólo rol dueno)
    │   │   └── configuracion/    # equipo, zonas, asignación, agente, integraciones
    │   └── api/
    │       ├── webhooks/
    │       │   ├── meta-leads/route.ts     # Meta Lead Ads (GET verify + POST)
    │       │   ├── whatsapp/route.ts       # mensajes entrantes y estados
    │       │   └── correo-entrante/route.ts# correos reenviados de portales
    │       ├── leads/landing/route.ts      # formularios de landing (clave_landing)
    │       ├── integraciones/google/       # OAuth de cada asesor (inicio + callback)
    │       └── cron/seguimientos/route.ts  # lo invoca pg_cron cada minuto
    ├── components/
    │   ├── ui/                   # botones, tablas, badges, formularios
    │   └── leads/ propiedades/ reportes/
    └── lib/
        ├── env.ts                # variables de entorno validadas con Zod
        ├── cripto.ts             # AES-256-GCM para tokens de terceros
        ├── supabase/             # server.ts (RLS) · admin.ts (service role) · database.types.ts
        ├── auth/                 # sesión actual, guards por rol
        ├── telefono.ts           # normalización E.164 México  (+ test)
        ├── leads/
        │   ├── captura.ts        # crear o deduplicar lead + evento + asignar + primer mensaje
        │   └── parsers/          # meta.ts · inmuebles24.ts · lamudi.ts · vivanuncios.ts (+ tests con correos reales anonimizados)
        ├── asignacion/           # round-robin y por zona, funciones puras (+ tests)
        ├── scoring/              # reglas → puntos → caliente/tibio/frío + motivo (+ tests)
        ├── agente/
        │   ├── prompt.ts         # system prompt (persona, tono, datos de la inmobiliaria)
        │   ├── herramientas.ts   # definición de tools + esquemas Zod
        │   ├── orquestador.ts    # loop: historial → Claude → ejecutar tools → responder
        │   └── recomendador.ts   # búsqueda de propiedades compatibles (+ tests)
        ├── mensajeria/
        │   ├── tipos.ts          # interface ProveedorMensajeria
        │   ├── whatsapp-cloud.ts
        │   ├── twilio.ts         # implementación mínima, mismo contrato
        │   └── index.ts          # selecciona proveedor según integraciones del tenant
        ├── calendario/
        │   ├── tipos.ts          # interface ProveedorCalendario
        │   ├── google.ts
        │   └── disponibilidad.ts # horario de visitas − eventos ocupados = slots (+ tests)
        ├── seguimiento/          # programar y ejecutar recordatorios / reactivaciones
        └── metricas/             # consultas del panel del dueño
```

## 2. Esquema de base de datos

Migraciones en `supabase/migrations/`:

| Archivo | Contenido |
|---|---|
| `…0001_tipos_y_helpers.sql` | extensiones, enums, trigger `actualizado_en` |
| `…0002_tablas.sql` | tablas, FKs compuestas, índices, restricciones |
| `…0003_rls.sql` | helpers `app.*`, políticas RLS, protección de roles, `crear_inmobiliaria()` |
| `…0004_storage.sql` | bucket `propiedades` y políticas por carpeta de tenant |

### Tablas

| Tabla | Para qué |
|---|---|
| `inmobiliarias` | tenant: slug, zona horaria, estrategia de asignación, puntero de round robin, nombre/instrucciones del agente, horario de visitas, duración de cita, clave de landing |
| `usuarios` | 1:1 con `auth.users`; rol `dueno`/`asesor`, `recibe_leads`, calendario de Google |
| `zonas`, `asesor_zonas` | catálogo de zonas (con alias) y qué asesor atiende cada una |
| `propiedades`, `propiedad_fotos` | catálogo; precio, ubicación, características, si acepta crédito/Infonavit/Fovissste |
| `leads` | contacto, fuente, datos de calificación, score + motivo, estado, asesor, métricas |
| `conversaciones` | una por lead y canal; `ia_activa` (el asesor puede tomar el control), ventana de 24 h |
| `mensajes` | entrantes/salientes, autor (prospecto/agente/asesor/sistema), id del proveedor (idempotencia) |
| `citas` | asesor, propiedad, horario, estado, `google_event_id`; **no permite empalmes** por asesor |
| `seguimientos` | cola de recordatorios 24 h / 2 h y reactivaciones 3/7/15 d que procesa el cron |
| `eventos_lead` | línea de tiempo y auditoría (asignaciones, cambios de score, recapturas, notas) |
| `integraciones` | credenciales cifradas de WhatsApp, Meta y Google; enruta webhooks al tenant |

### Reglas de acceso (RLS)

| | Dueño | Asesor |
|---|---|---|
| Inmobiliaria / configuración | ver y editar | ver |
| Equipo (`usuarios`) | ver, cambiar rol/estado | ver; editar sólo su perfil |
| Zonas | administrar | ver |
| Propiedades y fotos | todo | ver, crear, editar (no borrar) |
| Leads, conversaciones, citas | todo lo de su inmobiliaria | **sólo lo asignado a él**; no puede reasignar |
| Credenciales de integraciones | ver estado, nunca el secreto | ver su conexión de Google |

Validado con pruebas en un Postgres 16 local: aislamiento entre inmobiliarias, asesor sólo ve sus leads, asesor no puede reasignar ni auto-promoverse, FK compuesta impide cruzar tenants incluso con service role, `anon` sin acceso, citas empalmadas rechazadas, deduplicación por teléfono.

## 3. Decisiones de diseño propuestas

1. **Scoring híbrido**: Claude extrae datos estructurados de la conversación (tool `guardar_calificacion`); el score lo calcula **código determinista** (`lib/scoring`) con puntos por presupuesto vs. catálogo, forma de pago (contado / crédito preaprobado suman más), urgencia, zona compatible y respuesta activa. Ventaja: auditable, explicable al dueño, probable con tests y barato.
2. **Deduplicación**: un teléfono = un lead por inmobiliaria. Si llega otra vez por otro portal, se registra `recapturado` en `eventos_lead` y no se crea lead nuevo.
3. **Tiempo de respuesta < 1 min**: el webhook responde 200 de inmediato y procesa con `after()`. Para leads de Meta/portales/landing el primer mensaje es una **plantilla aprobada de WhatsApp** (obligatorio fuera de la ventana de 24 h).
4. **Tenant por webhook**: WhatsApp por `phone_number_id`, Meta por `page_id`, correo por `slug@leads.<dominio>`, landing por `clave_landing`.
5. **Google Calendar**: cada asesor conecta su propia cuenta (OAuth). El agente consulta free/busy y crea el evento.
6. **Cron**: `pg_cron` + `pg_net` llaman cada minuto a `/api/cron/seguimientos` con `CRON_SECRET` (se agrega en la fase 5).
7. **Fotos**: bucket público (WhatsApp necesita URL accesible); escritura limitada a la carpeta del tenant.

## 4. Decisiones tomadas

Aprobadas el 2026-11-06 ("usa lo que propusiste"). Las que aplican a fases
futuras se pueden revisar al llegar a esa fase.

| # | Tema | Decisión |
|---|---|---|
| 1 | Números de WhatsApp | Cada inmobiliaria conecta **su propio número** (WhatsApp Business Cloud). El webhook enruta por `phone_number_id`. |
| 2 | Correos de portales | Cada inmobiliaria reenvía los correos de Inmuebles24, Lamudi y Vivanuncios a `<slug>@leads.<dominio>` (servicio de correo entrante con webhook). |
| 3 | Alta de clientes | **Self-service**: el dueño se registra, crea su inmobiliaria y queda como dueño. Cobro/suscripción fuera del MVP. |
| 4 | Operación | **Venta y renta** (el esquema soporta ambas). |
| 5 | Asignación por zona | Si ningún asesor cubre la zona, o aún no se conoce, se usa **round robin como respaldo**. |
| 6 | Pasar a humano | El asesor toma el control **desde la plataforma** (`conversaciones.ia_activa = false`). Criterios exactos de escalamiento: se definen en la fase 3. |
| 7 | Catálogo | **Asesores y dueño** crean y editan propiedades; sólo el dueño borra. |
| 8 | Calendario | **Cada asesor conecta su propio Google Calendar** (OAuth). |
| 9 | Horario del agente | Pendiente: se define en la fase 3 (propuesta: 24/7, con citas sólo dentro de `horario_visitas`). |

### Decisiones técnicas de la fase 1

- **Next.js 16**: `middleware.ts` ahora se llama `src/proxy.ts`. Refresca la sesión de Supabase y redirige a `/login` si no hay sesión; la verificación de inmobiliaria y rol se hace en el servidor (`lib/auth/sesion.ts`), no en el proxy.
- **`cacheComponents` desactivado**: todo el panel depende de la sesión y del tenant, no hay contenido estático que aprovechar; activarlo obligaría a envolver cada lectura de cookies en `<Suspense>`.
- **Correos de Auth con `token_hash`** (`supabase/templates/`): los enlaces de confirmación, invitación y recuperación llegan a `/auth/confirmar`, que canjea el token en el servidor. En producción hay que copiar esas plantillas en Supabase → Auth → Email Templates.
- **Invitaciones**: el dueño invita desde Equipo; se crea el usuario en Auth con la llave secreta y su fila en `usuarios` con la inmobiliaria del dueño (tomada de la sesión). Si falla el segundo paso, se borra el usuario de Auth.
- **Siempre debe haber un dueño activo** por inmobiliaria (validado en la acción de Equipo).
- **Usuarios desactivados** pueden leer su propia fila (migración 0005) para mostrarles "acceso desactivado" en lugar de mandarlos a crear otra inmobiliaria.
- **Catálogo de propiedades**: el brief no lo ubica en ninguna fase, pero el agente (fase 3) lo necesita para recomendar. Se propone construirlo en la **fase 2**, junto con la bandeja de leads.
