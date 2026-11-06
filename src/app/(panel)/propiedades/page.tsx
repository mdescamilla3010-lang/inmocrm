import type { Metadata } from "next";
import { Proximamente } from "@/components/panel/proximamente";

export const metadata: Metadata = { title: "Propiedades" };

export default function PaginaPropiedades() {
  return (
    <Proximamente
      titulo="Propiedades"
      fase={2}
      descripcion="Alta, edición y fotos del catálogo que el agente recomienda a los prospectos."
    />
  );
}
