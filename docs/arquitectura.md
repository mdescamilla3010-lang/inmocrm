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
| `inmobiliarias` | tenant: slug, zona horaria, estrategia de asignación, nombre/instrucciones del agente, horario de visitas, duración de cita, clave de landing |
| `usuarios` | 1:1 con `auth.users`; rol `dueno`/`asesor`, `recibe_leads`, `ultima_asignacion_en` (round robin), calendario de Google |
| `zonas`, `asesor_zonas` | catálogo de zonas (con alias) y qué asesor atiende cada una |
| `propiedades`, `propiedad_fotos` | catálogo; precio, ubicación, características, si acepta crédito/Infonavit/Fovissste |
| `leads` | contacto, fuente, datos de calificación, score + motivo, estado, asesor, métricas |
| `conversaciones` | una por lead y canal; `ia_activa` (el asesor puede tomar el control), ventana de 24 h |
| `mensajes` | entrantes/salientes, autor (prospecto/agente/asesor/sistema), id del proveedor (idempotencia) |
| `citas` | asesor, propiedad, horario, estado, `google_event_id`; **no permite empalmes** por asesor |
| `seguimientos` | cola de recordatorios 24 h / 2 h y reactivaciones 3/7/15 d que procesa el cron |
| `eventos_lead` | línea de tiempo y auditoría; la llena un **trigger** sobre `leads` (captura, asignación, estado, score, ediciones) más recapturas y notas |
| `capturas_lead` | bitácora de cada intento de captura por canal: idempotencia (`leadgen_id`, `Message-ID`) y diagnóstico de correos no reconocidos |
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
| 6 | Pasar a humano | El asesor toma el control **desde la plataforma** (`conversaciones.ia_activa = false`). El agente escala cuando el prospecto pide una persona, quiere negociar, tiene una queja, no se le entiende tras 2 intentos o pregunta algo legal/fiscal/de crédito que no puede responder con certeza. |
| 7 | Catálogo | **Asesores y dueño** crean y editan propiedades; sólo el dueño borra. |
| 8 | Calendario | **Cada asesor conecta su propio Google Calendar** (OAuth). |
| 9 | Horario del agente | **24/7**; las visitas sólo se proponen dentro de `horario_visitas`. |

### Decisiones técnicas de la fase 1

- **Next.js 16**: `middleware.ts` ahora se llama `src/proxy.ts`. Refresca la sesión de Supabase y redirige a `/login` si no hay sesión; la verificación de inmobiliaria y rol se hace en el servidor (`lib/auth/sesion.ts`), no en el proxy.
- **`cacheComponents` desactivado**: todo el panel depende de la sesión y del tenant, no hay contenido estático que aprovechar; activarlo obligaría a envolver cada lectura de cookies en `<Suspense>`.
- **Correos de Auth con `token_hash`** (`supabase/templates/`): los enlaces de confirmación, invitación y recuperación llegan a `/auth/confirmar`, que canjea el token en el servidor. En producción hay que copiar esas plantillas en Supabase → Auth → Email Templates.
- **Invitaciones**: el dueño invita desde Equipo; se crea el usuario en Auth con la llave secreta y su fila en `usuarios` con la inmobiliaria del dueño (tomada de la sesión). Si falla el segundo paso, se borra el usuario de Auth.
- **Siempre debe haber un dueño activo** por inmobiliaria (validado en la acción de Equipo).
- **Usuarios desactivados** pueden leer su propia fila (migración 0005) para mostrarles "acceso desactivado" en lugar de mandarlos a crear otra inmobiliaria.
- **Catálogo de propiedades**: se construye en la fase 2 (aprobado), porque el agente de la fase 3 lo necesita para recomendar.

### Decisiones técnicas de la fase 2

- **Round robin = "el que lleva más tiempo sin recibir un lead"** (`usuarios.ultima_asignacion_en`). Un puntero único no sirve para la asignación por zona (los candidatos son un subconjunto y siempre ganaría el primero). La elección es atómica en `siguiente_asesor_round_robin()` (bloquea la fila de la inmobiliaria), sólo invocable por el servidor.
- **Deduplicación**: primero por teléfono (único por inmobiliaria), luego por correo. Una recaptura sólo **completa** datos faltantes (nunca sobrescribe), queda en la línea de tiempo y **reabre** el lead si estaba perdido/descartado (salvo opt-out).
- **Zona del lead**: la de la propiedad de interés si se conoce; si no, se busca en el texto (respuestas del formulario, mensaje) contra nombre y sinónimos de las zonas, sin acentos y por palabra completa.
- **Liga con el catálogo**: los correos de portal y la landing traen una referencia; se liga si coincide con `propiedades.clave`. Hay que usar la misma clave en el portal y en InmoCRM.
- **Correo entrante con Postmark Inbound** (adaptador en `lib/leads/correo/entrante.ts`; cambiar de proveedor es escribir otro adaptador). Webhook protegido con Basic auth. El parser es tolerante (etiquetas comunes + respaldo por expresiones regulares), pero **se probó sólo con correos sintéticos**: hay que validarlo con correos reales.
- **Meta Lead Ads**: el token de cada página se guarda cifrado; el lead se pide a la Graph API con el token en el header. Webhook verificado con `X-Hub-Signature-256`, se responde 200 de inmediato y se procesa con `after()`.
- **Landing**: endpoint público con CORS abierto, clave pública por inmobiliaria (regenerable), honeypot anti-spam. **Pendiente**: rate limiting (se recomienda en el CDN/WAF del despliegue).
- **Fotos**: el navegador sube directo a Storage (sin pasar por el servidor ni por el límite de 1 MB de server actions); el servidor sólo registra rutas que estén dentro de la carpeta de esa propiedad.
- **Línea de tiempo por trigger**: ningún flujo (pantalla, webhook o agente) tiene que acordarse de registrar eventos de estado, asignación o score.


### Decisiones técnicas de la fase 3

- **Modelo**: Claude Opus 5.5 (`claude-opus-5-5`) por defecto, configurable con `ANTHROPIC_MODEL` y `ANTHROPIC_EFFORT` (default `medium`). Thinking adaptativo (por defecto en este modelo). **Respaldo del lado del servidor** activado (`fallbacks: "default"`): si el modelo declina un mensaje por política, otro modelo contesta en la misma llamada.
- **Caché de prompts**: herramientas + prompt de sistema son fijos por inmobiliaria (sin fechas ni datos del lead) y se cachean; el estado del lead y la hora local van en un **mensaje de sistema al final** de la conversación.
- **Herramientas** (`strict: true` + validación Zod antes de ejecutar): `guardar_calificacion`, `buscar_propiedades`, `enviar_fotos_propiedad`, `registrar_interes_visita`, `escalar_a_asesor`, `registrar_baja`. El agente **no escribe en la base**: el orquestador valida y ejecuta.
- **Scoring** determinista en `lib/scoring` (urgencia ≤30, forma de pago ≤25, presupuesto 10 + 5 si hay coincidencias, zona 5, tipo 5, quiere visitar 15; caliente ≥ 65, tibio ≥ 35; topes: sin respuesta = frío, más de 6 meses ≤ tibio). Se recalcula cada vez que el agente guarda datos; el motivo queda en `leads.score_motivo` y el cambio en la línea de tiempo.
- **Concurrencia**: un solo proceso contesta cada conversación (`reclamar_turno_agente`, con caducidad). El webhook espera `AGENTE_ESPERA_MS` para juntar mensajes seguidos; al terminar, el agente revisa si llegó algo nuevo.
- **Primer contacto**: leads nuevos de Meta, landing y portales reciben la **plantilla de bienvenida** (obligatoria fuera de la ventana de 24 h). Sin plantilla configurada, el agente sólo contesta a quien escriba primero. Los leads capturados a mano no reciben plantilla automática.
- **Bajas**: "BAJA", "STOP", "no me escriban"… se detectan sin IA (`esSolicitudDeBaja`); se marca `opt_out`, se cancelan seguimientos y se confirma una sola vez. Si la persona vuelve a escribir por su cuenta, se retoma.
- **Visitas (provisional hasta la fase 4)**: el agente registra la disponibilidad en `leads.interes_visita` y marca la conversación como "requiere atención" para que el asesor confirme. La fase 4 lo reemplaza por horarios reales de Google Calendar.
- **Twilio**: `ProveedorTwilio` y su parser/firma están implementados y probados detrás de la misma interfaz; falta sólo la ruta del webhook de Twilio y su formulario de conexión cuando se decida usarlo.

### Decisiones técnicas de la fase 4

- **Disponibilidad** = horario de visitas de la inmobiliaria − citas activas del asesor − ocupado en su Google Calendar, con margen de traslado (default 30 min) y anticipación mínima (default 2 h), en horarios cada 30 min durante 14 días. Cálculo puro en `lib/calendario/disponibilidad.ts`; la conversión hora local ↔ UTC usa `Intl` (probada con Ciudad de México y con Tijuana, que tiene horario de verano).
- **Google Calendar sin `googleapis`**: `fetch` directo a OAuth, free/busy y eventos (`lib/calendario/google.ts`) detrás de `ProveedorCalendario`. Permisos mínimos: `calendar.freebusy` + `calendar.events`. El `state` de OAuth va firmado (HMAC) con caducidad de 10 min y debe coincidir con el usuario con sesión.
- **Fallo de Google = no ofrecer horarios**: mejor registrar la preferencia que arriesgar un empalme con la agenda personal. Un token revocado marca la conexión como inactiva y el asesor ve "debe reconectar".
- **Doble validación al agendar**: se recalcula la disponibilidad justo antes de guardar y la restricción `citas_sin_empalmes` de la base impide choques aunque dos procesos agenden a la vez. Si el evento de Google falla, la cita se conserva en InmoCRM.
- **El agente nunca confirma una visita que `agendar_cita` no guardó**; reprogramar = cancelar + ofrecer de nuevo. `registrar_interes_visita` queda como respaldo cuando ningún horario le acomoda.
- **Visitas en la línea de tiempo** por trigger (agendada, cancelada con motivo, realizada, no asistió).
- **Agendar desde el panel**: horarios libres o uno manual (el asesor puede acordar fuera del horario de visitas; la base igual impide empalmes).
- **Mi perfil**: cada usuario conecta su calendario y registra su WhatsApp para recibir avisos; incluye "Cerrar sesión" (en móvil el botón de la barra lateral no se mostraba).

### Decisiones técnicas de la fase 5

- **Programar en la base, decidir al enviar**: triggers en `citas`, `leads` y `conversaciones` crean/mueven/cancelan filas de `seguimientos`; el ejecutor revisa con `decidirSeguimiento` (puro, probado) si todavía aplica. Así ningún flujo tiene que acordarse de programar recordatorios.
- **Reactivación sólo de leads fríos o sin respuesta**, contada desde la captura o el último mensaje del prospecto (si escribe, se reinicia). No a leads manuales, con visita, cerrados, atendidos por un asesor o con baja. Un seguimiento con más de 2 días de atraso (cron caído) se descarta en vez de mandarse desfasado.
- **Ventana de 24 h**: texto libre dentro de la ventana; fuera, plantilla aprobada (recordatorio: nombre, día y hora, lugar; reactivación: nombre, inmobiliaria). Sin plantilla no se envía.
- **Cron**: `reclamar_seguimientos()` con `for update skip locked` (varias ejecuciones no toman la misma fila) y rescate de filas atoradas en "procesando". pg_cron + pg_net con URL y secreto en Vault; la migración lo omite donde no existen esas extensiones. Alternativa documentada: Vercel Cron.
- **Reintentos**: 15 y 30 min; al tercer intento, "fallido" (visible en el lead).
- **`confirmar_cita`**: el agente marca la visita como confirmada cuando el prospecto responde al recordatorio.

### Decisiones técnicas de la fase 6

- **Agregación en la base**: `reporte_dueno(desde, hasta)` devuelve todo el panel en un JSON (validado con Zod en la app). `security invoker` + verificación de rol: el dueño sólo ve su inmobiliaria.
- **Definiciones explícitas** (ver `docs/reportes.md`): % a cita sobre leads del periodo; tiempo de respuesta sin leads manuales; visitas por fecha de la cita.
- **Comparación** contra el periodo anterior de igual duración; "este mes" contra los mismos días del mes anterior. Proporciones en puntos, conteos en %. La variación lleva flecha y texto, no sólo color.
- **Gráficas sin librería** (HTML/CSS, servidor): todas de una sola serie → un color, validado contra la superficie con el validador de la guía de visualización; barras ≤ 24 px, valor en la punta, tooltip por mouse y teclado, tablas con los mismos datos.
