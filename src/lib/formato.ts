const pesos = new Intl.NumberFormat("es-MX", { style: "currency", currency: "MXN", maximumFractionDigits: 0 });

export function formatearPesos(monto: number | null | undefined, moneda = "MXN"): string {
  if (monto === null || monto === undefined) return "—";
  if (moneda !== "MXN") {
    return new Intl.NumberFormat("es-MX", { style: "currency", currency: moneda, maximumFractionDigits: 0 }).format(monto);
  }
  return pesos.format(monto);
}

/** "2,500,000", "$2.5 millones", "2.5M", "800 mil", "800k" → número. null si no se entiende. */
export function interpretarMonto(texto: string | null | undefined): number | null {
  if (!texto) return null;
  const t = texto.toLowerCase().replace(/\s+/g, " ").replace(/\$|mxn|pesos/g, "").trim();
  if (!t) return null;
  const m = /^([\d.,]+)\s*(millones|millon|millón|mdp|m|mil|k)?$/.exec(t);
  if (!m) return null;
  const multiplicador = m[2] ? (["mil", "k"].includes(m[2]) ? 1_000 : 1_000_000) : 1;

  let numero = m[1];
  if (multiplicador > 1) {
    // Con sufijo se permite decimal: "2.5M", "2,5 millones".
    numero = numero.replace(/,(?=\d{1,2}$)/, ".").replace(/,/g, "");
  } else {
    // Sin sufijo los separadores son de miles: "2,500,000" o "2.500.000".
    numero = numero.replace(/[.,](?=\d{3}(\D|$))/g, "").replace(/,/g, ".");
  }
  const valor = Number(numero) * multiplicador;
  return Number.isFinite(valor) && valor > 0 ? Math.round(valor * 100) / 100 : null;
}

const relativo = new Intl.RelativeTimeFormat("es-MX", { numeric: "auto" });

/** "hace 5 minutos", "ayer", "hace 3 días"… */
export function haceCuanto(fecha: string | Date, ahora: Date = new Date()): string {
  const segundos = Math.round((new Date(fecha).getTime() - ahora.getTime()) / 1000);
  const abs = Math.abs(segundos);
  if (abs < 60) return "hace un momento";
  if (abs < 3600) return relativo.format(Math.round(segundos / 60), "minute");
  if (abs < 86400) return relativo.format(Math.round(segundos / 3600), "hour");
  if (abs < 86400 * 30) return relativo.format(Math.round(segundos / 86400), "day");
  return relativo.format(Math.round(segundos / (86400 * 30)), "month");
}

export function formatearFechaHora(fecha: string | Date, zonaHoraria: string): string {
  return new Intl.DateTimeFormat("es-MX", {
    dateStyle: "medium",
    timeStyle: "short",
    timeZone: zonaHoraria,
  }).format(new Date(fecha));
}
