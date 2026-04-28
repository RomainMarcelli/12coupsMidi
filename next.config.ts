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

const nextConfig: NextConfig = {
  reactStrictMode: true,
  env: {
    NEXT_PUBLIC_BUILD_VERSION: BUILD_VERSION,
  },
};

export default withSerwist(nextConfig);
