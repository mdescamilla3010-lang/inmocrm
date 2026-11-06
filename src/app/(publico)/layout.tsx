import { TarjetaCentrada } from "@/components/ui/tarjeta-centrada";

export default function LayoutPublico({ children }: LayoutProps<"/">) {
  return <TarjetaCentrada>{children}</TarjetaCentrada>;
}
