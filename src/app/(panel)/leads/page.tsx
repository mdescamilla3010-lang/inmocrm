import type { Metadata } from "next";
import { Proximamente } from "@/components/panel/proximamente";

export const metadata: Metadata = { title: "Leads" };

export default function PaginaLeads() {
  return (
    <Proximamente
      titulo="Leads"
      fase={2}
      descripcion="Aquí llegarán los leads de Meta, tu landing y los portales, ya asignados a un asesor."
    />
  );
}
