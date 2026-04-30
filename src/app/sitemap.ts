import type { MetadataRoute } from "next";

/**
 * L+ — Sitemap XML généré dynamiquement (App Router).
 *
 * Liste les URL publiques uniquement (pas le contenu auth-protected).
 * `lastModified` à la date du build pour rester simple — pas de vraie
 * granularité par page car le contenu n'est pas indexable
 * publiquement.
 */
export default function sitemap(): MetadataRoute.Sitemap {
  const base = process.env.NEXT_PUBLIC_SITE_URL ?? "https://localhost:3000";
  const now = new Date();
  return [
    {
      url: `${base}/`,
      lastModified: now,
      changeFrequency: "weekly",
      priority: 1,
    },
    {
      url: `${base}/login`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
    {
      url: `${base}/play`,
      lastModified: now,
      changeFrequency: "monthly",
      priority: 0.5,
    },
  ];
}
