# Revisión previa al despliegue

Revisión de seguridad y correctitud de las seis fases antes de salir a producción.

## Hallazgos corregidos

| # | Severidad | Hallazgo | Corrección |
|---|---|---|---|
| 1 | Alta | Mensajes de WhatsApp de tipos no previstos (video, sticker, contacto) fallaban al guardarse: el prospecto se quedaba sin respuesta. Las reacciones (👍) habrían disparado una respuesta del agente. | Tipo `otro` permitido en la base; el parser describe video/sticker/contacto e ignora reacciones y avisos del sistema. |
| 2 | Media | Redirección abierta: el formulario de landing redirigía a cualquier URL en `gracias`. | Sólo redirige a una página del mismo sitio que envió el formulario (`Origin`/`Referer`). |
| 3 | Media | Sin límite de consumo: alguien podía mandar cientos de mensajes y generar cientos de llamadas a la API de Claude. | Más de 40 mensajes en una hora en una conversación pausa la IA y avisa al asesor. |
| 4 | Media | Sin límite de envíos en el endpoint público de landing. | Máximo 30 envíos por minuto por inmobiliaria (429). |
| 5 | Media | Un asesor podía, llamando la API directamente, crear o mover una cita al lead de otro asesor de su inmobiliaria. | Las políticas de `citas` exigen que el lead sea visible para quien agenda; sólo el dueño borra. |
| 6 | Baja | Funciones internas (`app.*`, algunas `security definer`) ejecutables por cualquier rol (no expuestas por la API, pero sin necesidad). | `EXECUTE` revocado salvo las tres que usan las políticas de RLS. |
| 7 | Baja | Argumentos ligados de algunas acciones del panel no se validaban en el servidor (estado de cita, booleano de IA, rutas de fotos). | Validación en tiempo de ejecución. |
| 8 | Baja | Sin encabezados de seguridad HTTP. | `frame-ancestors 'none'`, `X-Frame-Options`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS; sin `X-Powered-By`. |

Cada corrección de base de datos tiene prueba pgTAP (`supabase/tests/endurecimiento.test.sql`).

## Revisado sin hallazgos

- **Aislamiento entre inmobiliarias**: RLS en todas las tablas, FKs compuestas por `inmobiliaria_id`, pruebas pgTAP por rol.
- **Uso de la llave de servicio** (salta RLS): cada uso filtra por `inmobiliaria_id` resuelto en el servidor; las acciones del panel primero verifican acceso con la sesión del usuario.
- **Webhooks**: firma HMAC de Meta/WhatsApp, Basic auth del correo entrante, Bearer del cron; comparación en tiempo constante; idempotencia por id externo.
- **Credenciales de terceros**: cifradas con AES-256-GCM; la columna no es legible por usuarios.
- **OAuth de Google**: `state` firmado, con caducidad y ligado al usuario con sesión.
- **XSS**: no hay `dangerouslySetInnerHTML`; React escapa todo el contenido.
- **Redirecciones internas** (`?next=`): sólo rutas de la propia app.
- **Agente de IA**: no escribe en la base directamente; sus herramientas sólo tocan el lead de esa conversación y propiedades de su inmobiliaria; ignora instrucciones del prospecto que intenten cambiar su papel.
- **Secretos en el repo**: ninguno (sólo valores de ejemplo en `.env.example`).

## Riesgos aceptados / por decidir

- **Registro abierto**: cualquiera puede crear una inmobiliaria. El costo de IA es tuyo, pero el agente sólo corre cuando la inmobiliaria conecta su propio WhatsApp. Si prefieres dar de alta clientes tú, se desactiva el registro en Supabase.
- **Datos personales (LFPDPPP)**: hace falta un **aviso de privacidad** publicado y referenciarlo en formularios y en la plantilla de bienvenida. Es un tema legal, no de código.
- **Logs**: los errores del servidor pueden incluir teléfonos; usar un proveedor de logs con retención limitada.
