import { describe, expect, it } from "vitest";
import { esquemaPropiedad } from "./esquemas";
import { esRutaDeLaPropiedad, rutaNuevaFoto, urlPublicaFoto, validarArchivoFoto } from "./fotos";

const inmo = "aaaaaaaa-0000-0000-0000-000000000000";
const prop = "bbbbbbbb-0000-0000-0000-000000000000";

describe("fotos", () => {
  it("genera la ruta dentro de la carpeta de la inmobiliaria", () => {
    expect(rutaNuevaFoto(inmo, prop, "image/webp", "a1b2c3d4e5")).toBe(`${inmo}/${prop}/a1b2c3d4e5.webp`);
    expect(rutaNuevaFoto(inmo, prop, "image/gif", "a1b2c3d4e5")).toBeNull();
  });

  it("sólo acepta rutas de esa propiedad", () => {
    expect(esRutaDeLaPropiedad(`${inmo}/${prop}/a1b2c3d4e5.jpg`, inmo, prop)).toBe(true);
    expect(esRutaDeLaPropiedad(`${inmo}/otra/a1b2c3d4e5.jpg`, inmo, prop)).toBe(false);
    expect(esRutaDeLaPropiedad(`otra/${prop}/a1b2c3d4e5.jpg`, inmo, prop)).toBe(false);
    expect(esRutaDeLaPropiedad(`${inmo}/${prop}/../../x/a1b2c3d4e5.jpg`, inmo, prop)).toBe(false);
    expect(esRutaDeLaPropiedad(`${inmo}/${prop}/a1b2c3d4e5.exe`, inmo, prop)).toBe(false);
  });

  it("arma la URL pública", () => {
    expect(urlPublicaFoto("http://127.0.0.1:54321/", `${inmo}/${prop}/x.jpg`)).toBe(
      `http://127.0.0.1:54321/storage/v1/object/public/propiedades/${inmo}/${prop}/x.jpg`,
    );
  });

  it("valida tipo y tamaño", () => {
    expect(validarArchivoFoto({ type: "image/jpeg", size: 2_000_000 })).toBeNull();
    expect(validarArchivoFoto({ type: "application/pdf", size: 1000 })).toBe("Sólo JPG, PNG o WebP");
    expect(validarArchivoFoto({ type: "image/png", size: 11 * 1024 * 1024 })).toMatch(/10 MB/);
  });
});

describe("esquemaPropiedad", () => {
  const base = { titulo: "Casa en Juriquilla", tipo: "casa", operacion: "venta", estado: "disponible", precio: "4.85M" };

  it("convierte el formulario", () => {
    const r = esquemaPropiedad.parse({
      ...base,
      clave: " CB-001 ",
      recamaras: "3",
      banos: "2.5",
      m2_construccion: "210",
      codigo_postal: "76230",
      acepta_infonavit: "on",
      amenidades: "jardín, alberca\nalberca, seguridad 24/7",
      zona_id: "",
    });
    expect(r).toMatchObject({
      clave: "CB-001",
      precio: 4850000,
      recamaras: 3,
      banos: 2.5,
      m2_construccion: 210,
      m2_terreno: null,
      codigo_postal: "76230",
      acepta_infonavit: true,
      acepta_credito_bancario: false,
      amenidades: ["jardín", "alberca", "seguridad 24/7"],
      zona_id: null,
      moneda: "MXN",
    });
  });

  it.each([
    [{ precio: "barata" }, "precio"],
    [{ codigo_postal: "7623" }, "codigo_postal"],
    [{ banos: "2.3" }, "banos"],
    [{ titulo: "C" }, "titulo"],
    [{ tipo: "castillo" }, "tipo"],
  ])("rechaza %j", (cambio, campo) => {
    const r = esquemaPropiedad.safeParse({ ...base, ...cambio });
    expect(r.success).toBe(false);
    if (!r.success) expect(r.error.issues[0].path[0]).toBe(campo);
  });
});
