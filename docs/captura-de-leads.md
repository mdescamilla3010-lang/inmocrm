# Captura de leads: configuración y pruebas

Todos los canales terminan en `capturarLead()` (`src/lib/leads/captura.ts`):
deduplica, ubica la zona, asigna asesor y deja rastro en la línea de tiempo y
en la bitácora (Configuración → Integraciones).

## 1. Formulario de landing

`POST /api/leads/landing` — JSON o `application/x-www-form-urlencoded`.

| Campo | Obligatorio | Notas |
|---|---|---|
| `clave` | sí | Configuración → Integraciones |
| `telefono` o `email` | al menos uno | el teléfono se normaliza a E.164 |
| `nombre`, `mensaje`, `zona` | no | la zona se reconoce por nombre o sinónimo |
| `propiedad` | no | clave de la propiedad en el catálogo |
| `pagina`, `utm_source`, `utm_medium`, `utm_campaign`, `utm_content` | no | origen de campaña |
| `gracias` | no | URL a la que regresa un `<form>` HTML |
| `sitio_web` | — | honeypot: si viene lleno, se ignora el envío |

```bash
curl -X POST http://localhost:3000/api/leads/landing \
  -H 'content-type: application/json' \
  -d '{"clave":"<CLAVE>","nombre":"Prueba Landing","telefono":"442 555 0101","mensaje":"Busco casa en Juriquilla","propiedad":"CB-001","utm_source":"facebook"}'
```

## 2. Meta Lead Ads

1. En tu app de Meta for Developers: producto **Webhooks** → objeto *Page* → URL `https://<tu-app>/api/webhooks/meta-leads`, token de verificación = `META_VERIFY_TOKEN`, campo `leadgen`.
2. Variables: `META_APP_SECRET`, `META_VERIFY_TOKEN`, `ENCRYPTION_KEY`.
3. En InmoCRM (dueño): Configuración → Integraciones → conectar la página con su ID y un token de página de larga duración con `leads_retrieval`.
4. Prueba con la [herramienta de prueba de anuncios para clientes potenciales](https://developers.facebook.com/tools/lead-ads-testing) de Meta.

Para simular sólo el webhook (sin Graph API) se puede firmar un cuerpo a mano:

```bash
CUERPO='{"object":"page","entry":[{"id":"123","changes":[{"field":"leadgen","value":{"leadgen_id":"1","page_id":"123"}}]}]}'
FIRMA=$(printf '%s' "$CUERPO" | openssl dgst -sha256 -hmac "$META_APP_SECRET" | sed 's/.* //')
curl -X POST http://localhost:3000/api/webhooks/meta-leads -H "x-hub-signature-256: sha256=$FIRMA" -d "$CUERPO"
```

## 3. Correos de Inmuebles24, Lamudi y Vivanuncios

1. Dominio de correo entrante en Postmark (Inbound) apuntando a `https://postmark:<CORREO_ENTRANTE_SECRETO>@<tu-app>/api/webhooks/correo-entrante`.
2. `CORREO_ENTRANTE_DOMINIO` = ese dominio. Cada inmobiliaria recibe en `<slug>@<dominio>`.
3. En Gmail de la inmobiliaria: reenvío a esa dirección (el código de confirmación aparece en la bitácora) y filtro por remitente de los portales.

```bash
curl -X POST http://localhost:3000/api/webhooks/correo-entrante -u postmark:$CORREO_ENTRANTE_SECRETO \
  -H 'content-type: application/json' \
  -d '{"MessageID":"prueba-1","From":"noreply@inmuebles24.com","OriginalRecipient":"casas-del-bajio@leads.tudominio.mx","Subject":"Nuevo contacto","TextBody":"Nombre: Prueba Portal\nTeléfono: 442 555 0202\nEmail: prueba@correo.mx\nMensaje: ¿Sigue disponible?\nCódigo del aviso: CB-002"}'
```

> El parser se escribió con correos **sintéticos**. Cuando tengamos correos
> reales de cada portal hay que agregarlos como casos en
> `src/lib/leads/correo/correo.test.ts` y ajustar etiquetas si hace falta.
