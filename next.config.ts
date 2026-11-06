import type { NextConfig } from "next";

// cacheComponents/partialPrefetching están desactivados a propósito: todo el
// panel depende de la sesión del usuario y de su inmobiliaria, así que no hay
// shell estático que aprovechar (ver docs/arquitectura.md, Decisiones).
const nextConfig: NextConfig = {
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
