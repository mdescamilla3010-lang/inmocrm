import type { Metadata } from "next";
import { Proximamente } from "@/components/panel/proximamente";
import { requerirDueno } from "@/lib/auth/sesion";

export const metadata: Metadata = { title: "Reportes" };

export default async function PaginaReportes() {
  await requerirDueno();
  return (
    <Proximamente
      titulo="Reportes"
      fase={6}
      descripcion="Leads por fuente, tiempo de respuesta, % que llega a cita y visitas por asesor."
    />
  );
}
