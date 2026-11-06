import type { Database } from "@/lib/supabase/database.types";

export type Rol = Database["public"]["Enums"]["rol_usuario"];

export type ItemNavegacion = {
  href: string;
  etiqueta: string;
  roles: readonly Rol[];
};

const NAVEGACION: readonly ItemNavegacion[] = [
  { href: "/leads", etiqueta: "Leads", roles: ["dueno", "asesor"] },
  { href: "/citas", etiqueta: "Citas", roles: ["dueno", "asesor"] },
  { href: "/propiedades", etiqueta: "Propiedades", roles: ["dueno", "asesor"] },
  { href: "/reportes", etiqueta: "Reportes", roles: ["dueno"] },
  { href: "/configuracion/equipo", etiqueta: "Equipo", roles: ["dueno"] },
];

export function navegacionPara(rol: Rol): ItemNavegacion[] {
  return NAVEGACION.filter((i) => i.roles.includes(rol));
}

export function puedeAdministrarEquipo(rol: Rol): boolean {
  return rol === "dueno";
}

export function puedeVerReportes(rol: Rol): boolean {
  return rol === "dueno";
}

export const ETIQUETA_ROL: Record<Rol, string> = {
  dueno: "Dueño / director",
  asesor: "Asesor",
};

type Miembro = { id: string; rol: Rol; activo: boolean };

/**
 * Evita que una inmobiliaria se quede sin ningún dueño activo (nadie podría
 * administrar el equipo ni ver reportes).
 */
export function dejariaSinDueno(
  equipo: readonly Miembro[],
  cambio: { id: string; rol: Rol; activo: boolean },
): boolean {
  const resultado = equipo.map((m) => (m.id === cambio.id ? { ...m, ...cambio } : m));
  return !resultado.some((m) => m.rol === "dueno" && m.activo);
}
