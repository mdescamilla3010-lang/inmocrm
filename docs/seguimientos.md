# Seguimientos: recordatorios y reactivación

## Qué se manda y cuándo

| Seguimiento | Cuándo | Se cancela solo si… |
|---|---|---|
| Recordatorio 24 h | 24 h antes de cada visita activa | la visita se cancela, se marca realizada/no asistió o se reprograma (entonces se mueve) |
| Recordatorio 2 h | 2 h antes | igual; también si la visita se agendó con menos de 2 h |
| Reactivación 3 / 7 / 15 días | desde la captura o el **último mensaje** del prospecto | el prospecto vuelve a escribir (el conteo se reinicia), pide la baja, agenda una visita, deja de ser frío, el lead se cierra o un asesor toma la conversación |

- **Programar** lo hace la base de datos con triggers (citas, leads, conversaciones), así que no importa si la visita la agendó el agente, un asesor o alguien a mano.
- **Enviar** lo decide el servidor al momento (`lib/seguimiento/reglas.ts`): revisa que todavía aplique. Lo que ya no aplica queda como "No se envió" con su motivo, visible en el detalle del lead.
- Se reactivan sólo leads **fríos** o que **nunca contestaron**. Los leads capturados a mano no se reactivan (los atiende el asesor).
- **Ventana de 24 h**: si el prospecto escribió en las últimas 24 h se manda texto libre; si no, la **plantilla aprobada**. Sin plantilla configurada, el seguimiento no se envía.
- Si el prospecto contesta, el agente sigue la conversación: puede **confirmar** la visita (`confirmar_cita`), reprogramarla o retomar la calificación.
- Fallos de WhatsApp: se reintenta a los 15 y 30 minutos; al tercer intento queda como "Falló".

## Configuración

### 1. Plantillas en Meta (categoría *Utility* para recordatorios, *Marketing* para reactivación; idioma `es_MX`)

**Recordatorio** (`recordatorio_visita`), parámetros: {{1}} nombre, {{2}} día y hora, {{3}} lugar:

> Hola {{1}}, te recordamos tu visita del {{2}} en {{3}}. ¿Nos confirmas que sigue en pie?

**Reactivación** (`reactivacion_lead`), parámetros: {{1}} nombre, {{2}} inmobiliaria:

> Hola {{1}}, ¿sigues buscando propiedad? En {{2}} tenemos opciones que podrían interesarte. Respóndenos y te ayudamos; si ya no te interesa, escribe BAJA.

Después, en InmoCRM: **Configuración → Integraciones → WhatsApp Business → Plantillas de seguimiento** (nombre de cada plantilla y su texto).

### 2. Interruptores

**Configuración → Agente IA → Seguimiento automático**: recordatorios y reactivación se pueden apagar por inmobiliaria.

### 3. Cron

El endpoint es `POST` (o `GET`) `/api/cron/seguimientos` con `Authorization: Bearer <CRON_SECRET>`. Procesa en lotes durante ~40 s por llamada.

**Opción A: Supabase (pg_cron + pg_net, ya incluido en la migración).** Sólo falta guardar la URL y el secreto en Vault, una vez por proyecto, desde el SQL editor:

```sql
select vault.create_secret('https://tu-app.mx', 'inmocrm_app_url');
select vault.create_secret('<el mismo valor de CRON_SECRET>', 'inmocrm_cron_secret');
```

Revisa que corra en `cron.job_run_details` y las respuestas en `net._http_response`.

**Opción B: Vercel Cron.** `vercel.json` con `{"crons": [{"path": "/api/cron/seguimientos", "schedule": "* * * * *"}]}`; Vercel manda el `CRON_SECRET` en el header automáticamente. (Cada minuto requiere plan Pro.)

### Prueba manual

```bash
curl -X POST http://localhost:3000/api/cron/seguimientos -H "Authorization: Bearer $CRON_SECRET"
# {"ok":true,"procesados":3,"enviados":2,"cancelados":1,"reintentos":0,"fallidos":0}
```

Para probar sin esperar días, adelanta un seguimiento en el SQL editor:

```sql
update seguimientos set programado_para = now() where id = '<id>';
```
