import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

// Formato: v1.<iv>.<tag>.<cifrado>, todo en base64url. La versión permite
// rotar el algoritmo o la llave sin romper lo ya guardado.
const VERSION = "v1";

function llaveDesdeBase64(llaveBase64: string): Buffer {
  const llave = Buffer.from(llaveBase64, "base64");
  if (llave.length !== 32) {
    throw new Error("ENCRYPTION_KEY debe ser de 32 bytes en base64");
  }
  return llave;
}

/** Cifra con AES-256-GCM (confidencialidad + integridad). */
export function cifrar(texto: string, llaveBase64: string): string {
  const llave = llaveDesdeBase64(llaveBase64);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", llave, iv);
  const cifrado = Buffer.concat([cipher.update(texto, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), cifrado.toString("base64url")].join(".");
}

export function descifrar(paquete: string, llaveBase64: string): string {
  const [version, iv, tag, cifrado] = paquete.split(".");
  if (version !== VERSION || !iv || !tag || cifrado === undefined) {
    throw new Error("Formato de dato cifrado no reconocido");
  }
  const decipher = createDecipheriv("aes-256-gcm", llaveDesdeBase64(llaveBase64), Buffer.from(iv, "base64url"));
  decipher.setAuthTag(Buffer.from(tag, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(cifrado, "base64url")), decipher.final()]).toString("utf8");
}
