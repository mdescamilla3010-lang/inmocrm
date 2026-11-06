import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "InmoCRM", template: "%s · InmoCRM" },
  description: "Del anuncio a la visita agendada, sin calificar leads a mano.",
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es-MX" className="h-full">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
