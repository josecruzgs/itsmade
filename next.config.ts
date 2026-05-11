import type { NextConfig } from "next";
import path from "node:path";

const nextConfig: NextConfig = {
  reactStrictMode: true,
  output: "standalone",
  // Forzar el root al directorio del proyecto. Sin esto Next.js detecta el
  // lockfile global de %USERPROFILE% y resuelve los paths de tracing desde ahi.
  outputFileTracingRoot: path.join(__dirname),
  // Empaquetar archivos no-JS que se leen con fs en runtime (ej: el conocimiento
  // de la empresa que usa el agente `info`). Sin esto, Vercel los excluye del
  // bundle de la function y `readFileSync` falla en produccion.
  outputFileTracingIncludes: {
    "/api/webhook/evolution": ["./src/lib/agents/info/company-knowledge.md"],
    // El logo se embebe en el PDF de hoja de servicio. Lo necesitan tanto
    // la API de descarga como el server action de envio por WhatsApp (que
    // se bundle con la pagina /services).
    "/api/services/[id]/pdf": ["./public/logo.png"],
    "/services": ["./public/logo.png"],
  },
  experimental: {
    serverActions: {
      bodySizeLimit: "10mb",
    },
  },
};

export default nextConfig;
