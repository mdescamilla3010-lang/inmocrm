const ENTIDADES: Record<string, string> = {
  nbsp: " ", amp: "&", lt: "<", gt: ">", quot: '"', apos: "'",
  aacute: "á", eacute: "é", iacute: "í", oacute: "ó", uacute: "ú", ntilde: "ñ", uuml: "ü",
  Aacute: "Á", Eacute: "É", Iacute: "Í", Oacute: "Ó", Uacute: "Ú", Ntilde: "Ñ", Uuml: "Ü",
  iquest: "¿", iexcl: "¡",
};

/**
 * Convierte el HTML de un correo a texto con una línea por bloque/fila. Las
 * celdas de una fila se separan con tabulador (los portales suelen mandar
 * "Nombre | Juan" en tablas) y los enlaces conservan su URL.
 */
export function htmlATexto(html: string): string {
  return html
    .replace(/<(style|script|head)[\s\S]*?<\/\1>/gi, "")
    .replace(/<a\b[^>]*href=["']([^"']+)["'][^>]*>([\s\S]*?)<\/a>/gi, (_, url: string, texto: string) => {
      const limpio = texto.replace(/<[^>]+>/g, "").trim();
      return limpio && limpio !== url ? `${limpio} (${url})` : url;
    })
    .replace(/<br\s*\/?>/gi, "\n")
    .replace(/<\/(p|div|tr|li|h[1-6]|table|section)>/gi, "\n")
    .replace(/<\/(td|th)>/gi, "\t")
    .replace(/<[^>]+>/g, "")
    .replace(/&#(\d+);/g, (_, n: string) => String.fromCodePoint(Number(n)))
    .replace(/&#x([0-9a-f]+);/gi, (_, n: string) => String.fromCodePoint(parseInt(n, 16)))
    .replace(/&([a-z]+);/gi, (m, nombre: string) => ENTIDADES[nombre] ?? m)
    .split("\n")
    .map((l) => l.replace(/[  ]+/g, " ").replace(/\t\s*/g, "\t").trim().replace(/\t+$/, ""))
    .filter((l, i, arr) => l !== "" || (i > 0 && arr[i - 1] !== ""))
    .join("\n")
    .trim();
}
