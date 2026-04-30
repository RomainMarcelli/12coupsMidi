import type { MetadataRoute } from "next";

/**
 * L+ — robots.txt généré dynamiquement par Next (App Router).
 *
 * App à usage personnel/familial — pas pour le référencement public.
 * On bloque l'indexation par défaut et on autorise les pages
 * publiques (login, /play pour la PWA mode TV).
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: ["/", "/login", "/play"],
        disallow: [
          "/admin",
          "/parametres",
          "/api",
          "/jouer",
          "/revision",
          "/stats",
          "/tv",
        ],
      },
    ],
  };
}
