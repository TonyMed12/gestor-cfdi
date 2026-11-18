import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  poweredByHeader: false,
  // OCR y lectura de PDF corren en el servidor, con sus propios archivos (modelo en español, wasm).
  serverExternalPackages: ["tesseract.js", "pdfjs-dist"],
  // El envío por enlace sube hasta 20 XML en una sola acción; el límite por defecto (1 MB) es menor.
  experimental: { serverActions: { bodySizeLimit: "25mb" } },
  // Cabeceras básicas de seguridad para todas las rutas. La política de contenido (CSP) se define al desplegar.
  async headers() {
    return [
      {
        source: "/(.*)",
        headers: [
          { key: "X-Frame-Options", value: "DENY" },
          { key: "X-Content-Type-Options", value: "nosniff" },
          { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
          { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=()" },
        ],
      },
    ];
  },
};

export default nextConfig;
