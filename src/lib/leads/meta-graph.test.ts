import { describe, expect, it, vi } from "vitest";
import { obtenerLeadMeta } from "./meta-graph";

const respuesta = (status: number, cuerpo: unknown) =>
  new Response(JSON.stringify(cuerpo), { status, headers: { "content-type": "application/json" } });

describe("obtenerLeadMeta", () => {
  it("manda el token en el header y pide los campos necesarios", async () => {
    const fetchFn = vi.fn().mockResolvedValue(
      respuesta(200, { id: "444", field_data: [{ name: "full_name", values: ["Ana"] }] }),
    );
    const lead = await obtenerLeadMeta({ leadgenId: "444", tokenPagina: "tok", version: "v23.0", fetchFn });
    expect(lead.field_data[0].values).toEqual(["Ana"]);
    const [url, init] = fetchFn.mock.calls[0] as [URL, RequestInit];
    expect(url.toString()).toBe(
      "https://graph.facebook.com/v23.0/444?fields=id%2Ccreated_time%2Cad_id%2Cform_id%2Ccampaign_id%2Cfield_data",
    );
    expect(url.toString()).not.toContain("tok");
    expect((init.headers as Record<string, string>).Authorization).toBe("Bearer tok");
  });

  it("propaga el mensaje de error de Graph", async () => {
    const fetchFn = vi.fn().mockResolvedValue(respuesta(400, { error: { message: "Invalid OAuth access token" } }));
    await expect(obtenerLeadMeta({ leadgenId: "1", tokenPagina: "x", version: "v23.0", fetchFn })).rejects.toThrow(
      "Graph API: Invalid OAuth access token",
    );
  });

  it("rechaza respuestas con formato inesperado", async () => {
    const fetchFn = vi.fn().mockResolvedValue(respuesta(200, { sin: "id" }));
    await expect(obtenerLeadMeta({ leadgenId: "1", tokenPagina: "x", version: "v23.0", fetchFn })).rejects.toThrow(
      /formato inesperado/,
    );
  });
});
