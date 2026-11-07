import type { NextConfig } from "next";

// cacheComponents/partialPrefetching están desactivados a propósito: todo el
// panel depende de la sesión del usuario y de su inmobiliaria, así que no hay
// shell estático que aprovechar (ver docs/arquitectura.md, Decisiones).

const encabezadosSeguridad = [
  // Nadie puede incrustar el panel en un iframe (clickjacking).
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=()" },
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
];

const nextConfig: NextConfig = {
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    return [{ source: "/:ruta*", headers: encabezadosSeguridad }];
  },
};

export default nextConfig;
