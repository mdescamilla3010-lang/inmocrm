import type { Intervalo } from "./disponibilidad";
import { ErrorCalendario, type EventoCalendario, type ProveedorCalendario } from "./tipos";

const URL_TOKEN = "https://oauth2.googleapis.com/token";
const URL_CALENDAR = "https://www.googleapis.com/calendar/v3";

/** Permisos mínimos: ver ocupado/libre y administrar los eventos que creamos. */
export const SCOPES_GOOGLE = [
  "openid",
  "email",
  "https://www.googleapis.com/auth/calendar.freebusy",
  "https://www.googleapis.com/auth/calendar.events",
];

type Credenciales = { clientId: string; clientSecret: string; fetchFn?: typeof fetch };

export function urlAutorizacionGoogle(args: { clientId: string; redirectUri: string; state: string }): string {
  const url = new URL("https://accounts.google.com/o/oauth2/v2/auth");
  url.search = new URLSearchParams({
    client_id: args.clientId,
    redirect_uri: args.redirectUri,
    response_type: "code",
    scope: SCOPES_GOOGLE.join(" "),
    // offline + consent: Google entrega refresh_token aunque el usuario ya haya autorizado antes.
    access_type: "offline",
    prompt: "consent",
    include_granted_scopes: "true",
    state: args.state,
  }).toString();
  return url.toString();
}

async function postToken(c: Credenciales, campos: Record<string, string>) {
  const f = c.fetchFn ?? fetch;
  const r = await f(URL_TOKEN, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: c.clientId, client_secret: c.clientSecret, ...campos }),
    signal: AbortSignal.timeout(10_000),
  });
  const json = (await r.json().catch(() => null)) as Record<string, unknown> | null;
  if (!r.ok || !json) {
    const error = String(json?.error ?? `HTTP ${r.status}`);
    throw new ErrorCalendario(`Google: ${error}`, error === "invalid_grant");
  }
  return json;
}

function correoDeIdToken(idToken: unknown): string | null {
  if (typeof idToken !== "string") return null;
  try {
    const payload = JSON.parse(Buffer.from(idToken.split(".")[1] ?? "", "base64url").toString("utf8")) as { email?: unknown };
    return typeof payload.email === "string" ? payload.email.toLowerCase() : null;
  } catch {
    return null;
  }
}

/** Canjea el código del callback de OAuth por el refresh token y el correo de la cuenta. */
export async function intercambiarCodigoGoogle(c: Credenciales & { code: string; redirectUri: string }) {
  const json = await postToken(c, { code: c.code, grant_type: "authorization_code", redirect_uri: c.redirectUri });
  const refreshToken = typeof json.refresh_token === "string" ? json.refresh_token : null;
  const email = correoDeIdToken(json.id_token);
  if (!refreshToken) throw new ErrorCalendario("Google no entregó un refresh token; vuelve a intentarlo.");
  if (!email) throw new ErrorCalendario("No se pudo leer el correo de la cuenta de Google.");
  return { refreshToken, email, scopes: typeof json.scope === "string" ? json.scope.split(" ") : [] };
}

export class ProveedorGoogleCalendar implements ProveedorCalendario {
  private token: { valor: string; vence: number } | null = null;

  constructor(private readonly c: Credenciales & { refreshToken: string; calendarId: string }) {}

  private async accessToken(): Promise<string> {
    if (this.token && this.token.vence > Date.now() + 60_000) return this.token.valor;
    const json = await postToken(this.c, { refresh_token: this.c.refreshToken, grant_type: "refresh_token" });
    const valor = String(json.access_token ?? "");
    if (!valor) throw new ErrorCalendario("Google no entregó access token");
    this.token = { valor, vence: Date.now() + Number(json.expires_in ?? 3000) * 1000 };
    return valor;
  }

  private async api(ruta: string, init: RequestInit = {}) {
    const f = this.c.fetchFn ?? fetch;
    const r = await f(`${URL_CALENDAR}${ruta}`, {
      ...init,
      headers: { Authorization: `Bearer ${await this.accessToken()}`, "Content-Type": "application/json", ...init.headers },
      signal: AbortSignal.timeout(10_000),
    });
    return r;
  }

  async ocupados(desde: Date, hasta: Date): Promise<Intervalo[]> {
    const r = await this.api("/freeBusy", {
      method: "POST",
      body: JSON.stringify({ timeMin: desde.toISOString(), timeMax: hasta.toISOString(), items: [{ id: this.c.calendarId }] }),
    });
    const json = (await r.json().catch(() => null)) as {
      calendars?: Record<string, { busy?: { start: string; end: string }[]; errors?: { reason: string }[] }>;
    } | null;
    const cal = json?.calendars?.[this.c.calendarId];
    if (!r.ok || !cal) throw new ErrorCalendario(`Google Calendar: no se pudo leer la disponibilidad (HTTP ${r.status})`);
    if (cal.errors?.length) throw new ErrorCalendario(`Google Calendar: ${cal.errors.map((e) => e.reason).join(", ")}`);
    return (cal.busy ?? []).map((b) => ({ inicio: new Date(b.start), fin: new Date(b.end) }));
  }

  async crearEvento(e: EventoCalendario) {
    const r = await this.api(`/calendars/${encodeURIComponent(this.c.calendarId)}/events?sendUpdates=none`, {
      method: "POST",
      body: JSON.stringify({
        summary: e.titulo,
        description: e.descripcion,
        ...(e.ubicacion ? { location: e.ubicacion } : {}),
        start: { dateTime: e.inicio.toISOString(), timeZone: e.zonaHoraria },
        end: { dateTime: e.fin.toISOString(), timeZone: e.zonaHoraria },
        reminders: { useDefault: true },
        extendedProperties: { private: { inmocrm_cita_id: e.citaId } },
      }),
    });
    const json = (await r.json().catch(() => null)) as { id?: string; htmlLink?: string; error?: { message?: string } } | null;
    if (!r.ok || !json?.id) throw new ErrorCalendario(`Google Calendar: ${json?.error?.message ?? `HTTP ${r.status}`}`);
    return { id: json.id, enlace: json.htmlLink ?? null };
  }

  async cancelarEvento(id: string) {
    const r = await this.api(`/calendars/${encodeURIComponent(this.c.calendarId)}/events/${encodeURIComponent(id)}?sendUpdates=none`, {
      method: "DELETE",
    });
    // 404/410: ya no existe (lo borraron a mano); para nosotros está cancelado.
    if (!r.ok && r.status !== 404 && r.status !== 410) throw new ErrorCalendario(`Google Calendar: no se pudo borrar el evento (HTTP ${r.status})`);
  }
}
