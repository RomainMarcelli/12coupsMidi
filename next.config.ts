import withSerwistInit from "@serwist/next";
import type { NextConfig } from "next";

const withSerwist = withSerwistInit({
  swSrc: "src/app/sw.ts",
  swDest: "public/sw.js",
  disable: process.env.NODE_ENV === "development",
});

// L1.1 — Version string injectée au build, accessible côté client via
// `process.env.NEXT_PUBLIC_BUILD_VERSION`. Aide à savoir quelle build
// tourne dans le navigateur après un refresh (utile quand le SW cache
// fait douter de la fraîcheur).
const BUILD_VERSION =
  process.env.NEXT_PUBLIC_BUILD_VERSION ??
  new Date()
    .toISOString()
    .replace(/[:T]/g, "-")
    .replace(/\..+$/, "");

// L+ — Headers de sécurité globaux. Couvrent les recommandations
// OWASP basiques :
//   - Strict-Transport-Security : force HTTPS sur 2 ans
//   - X-Content-Type-Options    : empêche le MIME sniffing
//   - X-Frame-Options           : bloque l'embedding (clickjacking)
//   - Referrer-Policy           : limite la fuite d'URL inter-origines
//   - Permissions-Policy        : désactive les API navigateur non
//                                 utilisées (camera/mic/geo) sauf
//                                 pour notre origine — la caméra est
//                                 utilisée par PhotoChoiceDialog donc
//                                 'self' la garde autorisée
const SECURITY_HEADERS = [
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "SAMEORIGIN" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  {
    key: "Permissions-Policy",
    value: "camera=(self), microphone=(self), geolocation=()",
  },
];

const nextConfig: NextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_BUILD_VERSION: BUILD_VERSION,
  },
  async headers() {
    return [
      {
        // Applique partout sauf aux assets statiques (Next gère leur
        // cache lui-même).
        source: "/:path*",
        headers: SECURITY_HEADERS,
      },
    ];
  },
};

export default withSerwist(nextConfig);
