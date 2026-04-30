import type { MetadataRoute } from "next";
import { getBuildBrand } from "@/lib/build-brand";

/**
 * O2 — Manifest PWA généré dynamiquement selon `NEXT_PUBLIC_BRAND_MODE`.
 *
 * Cette fonction est appelée au build de Next.js et exposée sur
 * `/manifest.webmanifest`. La valeur de `NEXT_PUBLIC_BRAND_MODE` est
 * figée au build → un déploiement = un manifest figé.
 *
 * Pour des manifests différents par déploiement Vercel, configurer
 * `NEXT_PUBLIC_BRAND_MODE` séparément sur chaque projet Vercel
 * (voir docs/BRAND_MODE.md).
 *
 * IMPORTANT : `public/manifest.json` a été supprimé pour éviter toute
 * confusion. Next.js privilégie ce fichier `app/manifest.ts` quand les
 * deux existent, mais on retire le statique pour rendre la source de
 * vérité unique.
 */
export default function manifest(): MetadataRoute.Manifest {
  const brand = getBuildBrand();
  // Préfixe les paths d'icônes selon le mode :
  //   - mahylan → "/icons/mahylan/icon-*.png"
  //   - generic → "/icon-*.png" (racine public/)
  const base = brand.iconBasePath;

  return {
    name: brand.appName,
    short_name: brand.appShortName,
    description: brand.description,
    start_url: "/",
    scope: "/",
    display: "standalone",
    orientation: "portrait-primary",
    background_color: brand.backgroundColor,
    theme_color: brand.themeColor,
    lang: "fr-FR",
    categories: ["games", "education", "entertainment"],
    icons: [
      {
        src: `${base}/icon-192.png`,
        sizes: "192x192",
        type: "image/png",
        purpose: "any",
      },
      {
        src: `${base}/icon-512.png`,
        sizes: "512x512",
        type: "image/png",
        purpose: "any",
      },
      {
        src: `${base}/icon-maskable-192.png`,
        sizes: "192x192",
        type: "image/png",
        purpose: "maskable",
      },
      {
        src: `${base}/icon-maskable-512.png`,
        sizes: "512x512",
        type: "image/png",
        purpose: "maskable",
      },
    ],
  };
}
