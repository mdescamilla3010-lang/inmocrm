/**
 * Normaliza teléfonos a E.164. Los números mexicanos quedan como
 * `+52` + 10 dígitos (sin el "1" de móvil que se usaba antes de 2019 y que
 * WhatsApp todavía reporta en algunos casos: +521…).
 *
 * Sin prefijo internacional se asume México. Devuelve null si no es válido.
 */
export function normalizarTelefono(entrada: string | null | undefined): string | null {
  if (!entrada) return null;
  const limpio = entrada.trim();
  if (!limpio) return null;

  let internacional = limpio.startsWith("+");
  let digitos = limpio.replace(/\D/g, "");
  if (!internacional && digitos.startsWith("00")) {
    internacional = true;
    digitos = digitos.slice(2);
  }

  if (internacional) {
    if (digitos.startsWith("52")) return nacionalMx(digitos.slice(2), true);
    return /^[1-9]\d{7,14}$/.test(digitos) ? `+${digitos}` : null;
  }

  if (digitos.length === 10) return nacionalMx(digitos, false);
  if (digitos.length === 12 && digitos.startsWith("52")) return nacionalMx(digitos.slice(2), true);
  if (digitos.length === 13 && digitos.startsWith("521")) return nacionalMx(digitos.slice(2), true);
  // Prefijos de marcación anteriores a 2019: 044/045 (móvil) y 01 (larga distancia).
  if (digitos.length === 13 && /^04[45]/.test(digitos)) return nacionalMx(digitos.slice(3), false);
  if (digitos.length === 12 && digitos.startsWith("01")) return nacionalMx(digitos.slice(2), false);
  return null;
}

function nacionalMx(resto: string, permitirUnoMovil: boolean): string | null {
  let n = resto;
  if (permitirUnoMovil && n.length === 11 && n.startsWith("1")) n = n.slice(1);
  return /^[1-9]\d{9}$/.test(n) ? `+52${n}` : null;
}

/** "+525512345678" → "55 1234 5678" (sólo para mostrar). */
export function formatearTelefono(e164: string): string {
  const m = /^\+52(\d{2})(\d{4})(\d{4})$/.exec(e164);
  return m ? `${m[1]} ${m[2]} ${m[3]}` : e164;
}
