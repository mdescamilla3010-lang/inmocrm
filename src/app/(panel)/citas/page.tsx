import type { Metadata } from "next";
import { Proximamente } from "@/components/panel/proximamente";

export const metadata: Metadata = { title: "Citas" };

export default function PaginaCitas() {
  return (
    <Proximamente titulo="Citas" fase={4} descripcion="Las visitas que agenda el agente con Google Calendar aparecerán aquí." />
  );
}
