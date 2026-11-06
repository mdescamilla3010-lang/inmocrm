# Agenda con Google Calendar

## Cómo funciona

```
Prospecto: "¿Puedo verla el sábado en la mañana?"
        │
        ▼
ofrecer_horarios(fecha, franja)
        │  horario de visitas de la inmobiliaria
        │  − citas del asesor en InmoCRM
        │  − ocupado en su Google Calendar (free/busy)
        │  − margen de traslado, anticipación mínima
        ▼
"Tengo el sábado 15 a las 10:00 o a las 12:00, ¿cuál prefieres?"
        │
        ▼
agendar_cita(inicio) ── vuelve a validar el horario
        │                └─ la base impide empalmes aunque dos procesos agenden a la vez
        ├─ cita en InmoCRM (lead → "cita agendada", línea de tiempo)
        └─ evento en el Google Calendar del asesor (con teléfono, score y liga al lead)
```

- Si el asesor **no conectó** Google Calendar, el agente igual agenda, evitando
  sólo los choques con las visitas registradas en InmoCRM.
- Si Google **falla** (o el asesor retiró el acceso), el agente no ofrece
  horarios: registra la preferencia del prospecto y el asesor coordina. Es
  preferible a empalmar una visita con la agenda personal del asesor.
- Si el lead aún no tiene asesor, se le asigna al momento de ofrecer horarios.

## Configuración

1. En Google Cloud Console:
   - Habilita **Google Calendar API**.
   - Pantalla de consentimiento OAuth (externa) con los permisos
     `calendar.freebusy` y `calendar.events`. Mientras la app esté en modo
     *prueba*, agrega como usuarios de prueba los correos de los asesores.
   - Credencial **ID de cliente de OAuth → Aplicación web** con URI de
     redirección: `<NEXT_PUBLIC_APP_URL>/api/integraciones/google/callback`.
2. Variables: `GOOGLE_CLIENT_ID`, `GOOGLE_CLIENT_SECRET` (y `ENCRYPTION_KEY`).
3. Dueño: **Configuración → Agenda**: horario de visitas por día, duración,
   margen de traslado y anticipación mínima.
4. Cada asesor: **Mi perfil → Conectar Google Calendar**.

InmoCRM sólo pide ver si el asesor está ocupado (no el contenido de sus
eventos) y administrar los eventos que crea. El refresh token se guarda cifrado.

## Operación

- **Citas**: próximas visitas (asesor: las suyas; dueño: todo el equipo, con
  filtro por asesor) y últimos 60 días. Marcar *realizada* pasa el lead a
  "visita realizada"; *cancelar* borra también el evento de Google.
- **Detalle del lead → Visitas**: agendar con los horarios libres del asesor
  (o un horario acordado fuera del horario de visitas). Si el prospecto escribió
  en las últimas 24 h, se le confirma por WhatsApp.
- El agente puede **reprogramar**: cancela la cita y ofrece horarios nuevos.

## Pendiente para la fase 5

Recordatorios por WhatsApp 24 h y 2 h antes de la visita (requieren plantilla
aprobada, porque suelen caer fuera de la ventana de 24 h).
