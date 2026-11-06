# Agente de WhatsApp: configuración y pruebas

## Cómo funciona

```
Prospecto escribe ─► Meta ─► POST /api/webhooks/whatsapp (firma verificada, 200 inmediato)
                                   │ after()
                                   ▼
          registrarEntrante: lead (si es nuevo) + mensaje + ventana 24 h + ¿baja?
                                   │ espera AGENTE_ESPERA_MS (junta mensajes seguidos)
                                   ▼
          responderConversacion: reclama el turno ─► contexto ─► Claude + herramientas
                                   │                               │
                                   │        guardar_calificacion ─► score determinista
                                   │        buscar_propiedades   ─► recomendador
                                   │        escalar_a_asesor     ─► IA en pausa + aviso
                                   ▼
                     respuesta por WhatsApp + mensaje guardado
```

Leads que llegan por Meta Ads, landing o portales reciben primero la
**plantilla de bienvenida**; cuando contestan, el agente sigue la conversación.

## Configuración

1. **App de Meta** con el producto WhatsApp y un número de WhatsApp Business.
2. **Token permanente** de un *usuario del sistema* con `whatsapp_business_messaging`
   (y `whatsapp_business_management` para administrar plantillas).
3. **Webhook**: URL `https://<tu-app>/api/webhooks/whatsapp`, token de verificación
   = `WHATSAPP_VERIFY_TOKEN`, suscrito al campo `messages`.
4. **Variables**: `ANTHROPIC_API_KEY`, `WHATSAPP_APP_SECRET`, `WHATSAPP_VERIFY_TOKEN`,
   `ENCRYPTION_KEY` (ver `.env.example`).
5. En InmoCRM (dueño): **Configuración → Integraciones → WhatsApp Business**:
   Phone number ID, número, token y nombres de las plantillas.
6. **Configuración → Agente IA**: nombre del agente e indicaciones propias
   (tono, datos de la empresa, políticas de apartado, etc.).

### Plantillas sugeridas (categoría *Utility* o *Marketing*, idioma `es_MX`)

**Bienvenida** (`bienvenida_lead`):

> Hola {{1}}, gracias por tu interés en {{2}}. Soy tu asistente y te ayudo a
> encontrar la propiedad ideal. ¿Me cuentas qué estás buscando?

**Aviso al asesor** (`aviso_asesor`, opcional):

> Hola, el prospecto {{1}} {{2}}. Revisa su conversación en InmoCRM.

Meta tarda de minutos a horas en aprobar una plantilla. Mientras tanto, el
agente sólo contesta a quien escriba primero.

## Probar el agente sin WhatsApp

```bash
ANTHROPIC_API_KEY=sk-ant-... pnpm agente:probar
```

Abre un chat en la terminal con el mismo prompt, herramientas, scoring y
recomendador que producción, con un catálogo de ejemplo. Muestra cada
herramienta que usa el agente y cómo cambia el score. Para probar indicaciones
de una inmobiliaria: `AGENTE_INSTRUCCIONES="Háblales de usted" pnpm agente:probar`.
Cada mensaje es una llamada real a la API.

### Guion de prueba sugerido

1. "Hola, vi su anuncio" → debe presentarse y preguntar qué busca.
2. "Busco casa en Jurica, tengo como 2 millones con Infonavit" → guarda zona,
   presupuesto y forma de pago; busca y ofrece la casa que acepta Infonavit.
3. "Ya estoy precalificado, me quiero cambiar este mes" → el score sube a caliente.
4. "¿Puedo verla el sábado en la mañana?" → registra interés de visita.
5. "¿Me dejan en 1.7?" → escala a un asesor (negociación) y se despide.
6. En otra sesión: "BAJA" → confirma y no vuelve a escribir.

## Operación

- En la bandeja, **"Sólo los que requieren atención"** filtra los leads escalados
  o con visita por confirmar.
- En el detalle del lead, el asesor puede **tomar la conversación**,
  **devolverla a la IA** o escribir directamente (dentro de la ventana de 24 h;
  al escribir, la IA deja de contestar en esa conversación).
- Si el agente no puede responder (rechazo o error), manda un mensaje de
  respaldo y marca la conversación para un asesor: nunca deja a nadie sin
  respuesta.
