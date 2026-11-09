import { describe, expect, it, vi } from "vitest";
import { crearEstadoOAuth, verificarEstadoOAuth } from "./estado-oauth";
import { intercambiarCodigoGoogle, ProveedorGoogleCalendar, urlAutorizacionGoogle } from "./google";

const json = (cuerpo: unknown, status = 200) => new Response(JSON.stringify(cuerpo), { status, headers: { "content-type": "application/json" } });
const idToken = (payload: object) => `x.${Buffer.from(JSON.stringify(payload)).toString("base64url")}.y`;
const cred = { clientId: "cid", clientSecret: "csec" };

describe("OAuth de Google", () => {
  it("pide acceso offline con permisos mínimos", () => {
    const url = new URL(urlAutorizacionGoogle({ clientId: "cid", redirectUri: "https://app.mx/cb", state: "s1" }));
    expect(url.searchParams.get("access_type")).toBe("offline");
    expect(url.searchParams.get("prompt")).toBe("consent");
    expect(url.searchParams.get("scope")).toBe(
      "openid email https://www.googleapis.com/auth/calendar.freebusy https://www.googleapis.com/auth/calendar.events",
    );
    expect(url.searchParams.get("state")).toBe("s1");
  });

  it("canjea el código y lee el correo del id_token", async () => {
    const fetchFn = vi.fn().mockResolvedValue(json({ access_token: "a", refresh_token: "r1", id_token: idToken({ email: "Luis@Gmail.com" }), scope: "openid email" }));
    expect(await intercambiarCodigoGoogle({ ...cred, code: "c", redirectUri: "https://app.mx/cb", fetchFn })).toEqual({
      refreshToken: "r1",
      email: "luis@gmail.com",
      scopes: ["openid", "email"],
    });
    const body = (fetchFn.mock.calls[0] as [string, RequestInit])[1].body as URLSearchParams;
    expect(body.get("grant_type")).toBe("authorization_code");
    expect(body.get("client_secret")).toBe("csec");
  });

  it("falla con mensaje claro si no viene refresh token", async () => {
    const fetchFn = vi.fn().mockResolvedValue(json({ access_token: "a", id_token: idToken({ email: "x@y.mx" }) }));
    await expect(intercambiarCodigoGoogle({ ...cred, code: "c", redirectUri: "u", fetchFn })).rejects.toThrow(/refresh token/);
  });
});

describe("ProveedorGoogleCalendar", () => {
  const nuevo = (fetchFn: typeof fetch) => new ProveedorGoogleCalendar({ ...cred, refreshToken: "r1", calendarId: "primary", fetchFn });

  it("renueva el token una vez y consulta free/busy", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(json({ access_token: "tok", expires_in: 3600 }))
      .mockResolvedValueOnce(json({ calendars: { primary: { busy: [{ start: "2026-11-14T16:00:00Z", end: "2026-11-14T17:00:00Z" }] } } }))
      .mockResolvedValueOnce(json({ calendars: { primary: { busy: [] } } }));
    const g = nuevo(fetchFn);
    const ocupados = await g.ocupados(new Date("2026-11-14T00:00:00Z"), new Date("2026-11-21T00:00:00Z"));
    expect(ocupados).toEqual([{ inicio: new Date("2026-11-14T16:00:00Z"), fin: new Date("2026-11-14T17:00:00Z") }]);
    await g.ocupados(new Date(), new Date());
    expect(fetchFn).toHaveBeenCalledTimes(3); // el token se reutiliza
    const [url, init] = fetchFn.mock.calls[1] as [string, RequestInit];
    expect(url).toBe("https://www.googleapis.com/calendar/v3/freeBusy");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
  });

  it("token revocado → pide reconectar", async () => {
    const fetchFn = vi.fn().mockResolvedValue(json({ error: "invalid_grant" }, 400));
    await expect(nuevo(fetchFn).ocupados(new Date(), new Date())).rejects.toMatchObject({ requiereReconectar: true });
  });

  it("crea el evento con zona horaria y la referencia a la cita", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(json({ access_token: "tok", expires_in: 3600 }))
      .mockResolvedValueOnce(json({ id: "ev1", htmlLink: "https://calendar.google.com/ev1" }));
    const r = await nuevo(fetchFn).crearEvento({
      inicio: new Date("2026-11-14T16:00:00Z"),
      fin: new Date("2026-11-14T17:00:00Z"),
      titulo: "Visita: Ana",
      descripcion: "Tel 442",
      ubicacion: "Juriquilla",
      zonaHoraria: "America/Mexico_City",
      citaId: "c1",
    });
    expect(r).toEqual({ id: "ev1", enlace: "https://calendar.google.com/ev1" });
    const [url, init] = fetchFn.mock.calls[1] as [string, RequestInit];
    expect(url).toBe("https://www.googleapis.com/calendar/v3/calendars/primary/events?sendUpdates=none");
    expect(JSON.parse(init.body as string)).toMatchObject({
      summary: "Visita: Ana",
      location: "Juriquilla",
      start: { dateTime: "2026-11-14T16:00:00.000Z", timeZone: "America/Mexico_City" },
      extendedProperties: { private: { inmocrm_cita_id: "c1" } },
    });
  });

  it("borrar un evento que ya no existe no es error", async () => {
    const fetchFn = vi
      .fn()
      .mockResolvedValueOnce(json({ access_token: "tok", expires_in: 3600 }))
      .mockResolvedValueOnce(new Response(null, { status: 410 }));
    await expect(nuevo(fetchFn).cancelarEvento("ev1")).resolves.toBeUndefined();
  });
});

describe("state de OAuth", () => {
  const secreto = "s3cr3t";
  it("acepta el state firmado y vigente", () => {
    const s = crearEstadoOAuth("usuario-1", secreto, 1_000);
    expect(verificarEstadoOAuth(s, secreto, 2_000)).toBe("usuario-1");
  });
  it("rechaza vencido, alterado o con otro secreto", () => {
    const s = crearEstadoOAuth("usuario-1", secreto, 1_000);
    expect(verificarEstadoOAuth(s, secreto, 1_000 + 11 * 60_000)).toBeNull();
    expect(verificarEstadoOAuth(s.replace("usuario-1", "usuario-2"), secreto, 2_000)).toBeNull();
    expect(verificarEstadoOAuth(s, "otro", 2_000)).toBeNull();
    expect(verificarEstadoOAuth(null, secreto)).toBeNull();
  });
});
