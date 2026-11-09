# Despliegue a producción

Arquitectura: **Vercel** (Next.js) + **Supabase** (Postgres, Auth, Storage,
pg_cron) + servicios externos (Anthropic, Meta/WhatsApp, Google, Postmark).

## 0. Decisiones antes de empezar

- **Dominio**: p. ej. `app.tudominio.mx` (panel) y `leads.tudominio.mx` (correo entrante de portales).
- **Región**: Supabase y Vercel en la misma región. Para México, `us-east-1`
  (Virginia) o `us-west-1`; elige la misma en ambos.
- **Plan**: el cron cada minuto y `maxDuration = 60 s` funcionan en Supabase
  Free/Pro y Vercel Pro (en Vercel Hobby las funciones duran hasta 60 s, pero
  su uso es sólo personal/no comercial).

## 1. Supabase

1. Crear el proyecto (región elegida). Guardar la contraseña de la base.
2. Aplicar las migraciones. **Opción A, sin terminal (botón en GitHub):**
   1. Supabase → botón **Connect** (arriba) → pestaña *Connection String* →
      **Session pooler** → copiar la URI y cambiar `[YOUR-PASSWORD]` por la
      contraseña de la base. Si la contraseña tiene símbolos (`@ : / ? # %`),
      genera una nueva sólo con letras y números en *Database → Settings*.
   2. GitHub → **Settings → Secrets and variables → Actions → New repository
      secret**: nombre `SUPABASE_DB_URL`, valor la URI anterior.
   3. GitHub → **Actions → Migraciones a producción → Run workflow** (rama
      `main`): primero con `simular` (lista las migraciones pendientes), luego
      con `aplicar`.

   Se usa el *Session pooler* porque los servidores de GitHub no tienen IPv6 y
   la conexión directa de Supabase sólo es IPv6. Repite el botón cada vez que
   se haga merge de una migración nueva a `main`.

   **Opción B, desde tu máquina:**
   ```bash
   pnpm exec supabase login
   pnpm exec supabase link --project-ref <ref-del-proyecto>
   pnpm exec supabase db push
   ```
   `db push` aplica las migraciones; **no** carga el `seed.sql` (que trae
   usuarios de prueba con contraseña conocida: nunca en producción).
3. **Auth → URL Configuration**: Site URL = `https://app.tudominio.mx`;
   Redirect URLs: `https://app.tudominio.mx/**`.
4. **Auth → Email Templates**: copiar `supabase/templates/confirmacion.html`,
   `invitacion.html` y `recuperacion.html` (usan `token_hash` y
   `/auth/confirmar`; sin esto los enlaces de los correos no funcionan).
5. **Auth → Providers → Email**: activar *Confirm email*.
6. **Auth → SMTP**: configurar un SMTP propio (Postmark, Resend, SES…). El
   SMTP de Supabase tiene un límite muy bajo y no sirve para invitaciones reales.
7. **Vault** (SQL editor), para el cron de seguimientos:
   ```sql
   select vault.create_secret('https://app.tudominio.mx', 'inmocrm_app_url');
   select vault.create_secret('<CRON_SECRET>', 'inmocrm_cron_secret');
   ```
8. **API Keys**: copiar la *publishable key* y la *secret key*.

## 2. Vercel

1. Importar el repositorio; framework Next.js; Node 22.
2. Variables de entorno (Production) — ver `.env.example`:

   | Variable | De dónde sale |
   |---|---|
   | `NEXT_PUBLIC_APP_URL` | `https://app.tudominio.mx` |
   | `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`, `SUPABASE_SECRET_KEY` | Supabase → API Keys |
   | `ENCRYPTION_KEY` | `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` — **guárdala aparte**: si se pierde, hay que reconectar WhatsApp, Meta y Google |
   | `CRON_SECRET` | texto aleatorio largo (el mismo que en Vault) |
   | `ANTHROPIC_API_KEY` | console.anthropic.com |
   | `META_APP_SECRET`, `META_VERIFY_TOKEN`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN` | app de Meta (pasos 3–4) |
   | `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` | Google Cloud (paso 5) |
   | `CORREO_ENTRANTE_DOMINIO`, `CORREO_ENTRANTE_SECRETO` | paso 6 |

3. Dominio `app.tudominio.mx` apuntando a Vercel.
4. Región de funciones = región de Supabase (Settings → Functions).

## 3. Meta: WhatsApp Business

1. Business Manager verificado (verificación de negocio de Meta: puede tardar días).
2. App de Meta tipo *Business* con el producto **WhatsApp**; número dado de
   alta y verificado (no puede estar usándose en la app de WhatsApp normal).
3. Usuario del sistema con token permanente y permisos
   `whatsapp_business_messaging` y `whatsapp_business_management`.
4. Webhook: `https://app.tudominio.mx/api/webhooks/whatsapp`, token =
   `WHATSAPP_VERIFY_TOKEN`, campo `messages`.
5. Plantillas (idioma `es_MX`; textos sugeridos en `docs/agente-whatsapp.md` y
   `docs/seguimientos.md`): bienvenida, recordatorio de visita, reactivación y
   aviso al asesor.
6. En InmoCRM: Configuración → Integraciones → WhatsApp Business.

## 4. Meta: Lead Ads

1. En la misma app: producto **Webhooks** → objeto *Page* → URL
   `https://app.tudominio.mx/api/webhooks/meta-leads`, token =
   `META_VERIFY_TOKEN`, campo `leadgen`.
2. Permisos `leads_retrieval`, `pages_manage_metadata`, `pages_show_list`
   (requieren **App Review** de Meta para páginas de terceros).
3. Token de página de larga duración → Configuración → Integraciones → Meta Lead Ads.
4. Probar con https://developers.facebook.com/tools/lead-ads-testing

## 5. Google Calendar

Ver `docs/agenda-google-calendar.md`. Para que cualquier asesor pueda conectar
(no sólo usuarios de prueba) hay que **publicar la app de OAuth** y pasar la
verificación de Google (los permisos de calendario son *sensibles*): requiere
dominio verificado, página de inicio y **aviso de privacidad** públicos.

## 6. Correo entrante (Postmark)

1. Servidor en Postmark → *Inbound* → dominio `leads.tudominio.mx` (registro MX
   apuntando a `inbound.postmarkapp.com`).
2. Webhook de inbound: `https://postmark:<CORREO_ENTRANTE_SECRETO>@app.tudominio.mx/api/webhooks/correo-entrante`.

## 7. Primer arranque

1. Registrar la primera inmobiliaria en `https://app.tudominio.mx/registro`.
2. Configuración: equipo, zonas y asignación, agenda, agente IA, integraciones.
3. Cargar el catálogo de propiedades (con la misma clave que en los portales).
4. Prueba completa: llenar el formulario de prueba de Meta → debe llegar el
   lead asignado y la plantilla de bienvenida → responder por WhatsApp → el
   agente califica y agenda → la visita aparece en el Google Calendar del asesor
   → con `update seguimientos set programado_para = now()` se fuerza el
   recordatorio.

## Verificación continua

El workflow `.github/workflows/ci.yml` corre en cada push: lint, typecheck,
pruebas unitarias, build y, sobre un Supabase real en Docker, migraciones,
seed y todas las pruebas pgTAP de seguridad. Protege `main` para exigirlo
antes de hacer merge.

## Pendientes conocidos (no bloquean el lanzamiento)

- Webhook de Twilio (la integración de envío y su parser ya existen).
- Qué hacer con leads que no contestan tras la última reactivación (¿marcarlos perdidos?).
- Facturación por inmobiliaria y medición del consumo de IA por cliente.
- Parser de portales validado sólo con correos sintéticos.
