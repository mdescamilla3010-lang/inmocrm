import { z } from "zod";

export const esquemaPaginaMeta = z.object({
  pageId: z.string().trim().regex(/^\d{5,30}$/, { error: "El ID de la página son sólo números" }),
  nombre: z.string().trim().max(120).optional().transform((v) => v || null),
  token: z.string().trim().min(20, { error: "Pega el token de acceso de la página" }).max(1000),
});

/** Código HTML mínimo para pegar en una landing. */
export function codigoFormularioLanding(endpoint: string, clave: string): string {
  return `<form action="${endpoint}" method="POST">
  <input type="hidden" name="clave" value="${clave}">
  <input type="hidden" name="gracias" value="https://tu-sitio.mx/gracias">
  <input name="nombre" placeholder="Nombre" required>
  <input name="telefono" type="tel" placeholder="WhatsApp" required>
  <input name="email" type="email" placeholder="Correo">
  <textarea name="mensaje" placeholder="¿Qué buscas?"></textarea>
  <!-- Opcional: propiedad (clave del catálogo) y zona -->
  <input type="hidden" name="propiedad" value="">
  <!-- Anti-spam: no lo quites ni lo muestres -->
  <input name="sitio_web" tabindex="-1" autocomplete="off" style="position:absolute;left:-9999px">
  <button type="submit">Quiero información</button>
</form>`;
}
