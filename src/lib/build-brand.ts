/**
 * O — Lecture de la variable d'environnement `NEXT_PUBLIC_BRAND_MODE`
 * pour déterminer le branding STATIQUE du déploiement.
 *
 * Utilisé pour tout ce qui est rendu AVANT l'authentification :
 *   - title HTML (`<title>` dans `<head>`)
 *   - favicon
 *   - apple-touch-icon
 *   - manifest PWA (nom, icônes, couleurs)
 *   - description meta
 *
 * Pour le branding DYNAMIQUE côté UI (Navbar, Hero, Splash) qui dépend
 * de `is_owner` du profile connecté, continuer à utiliser
 * `getBranding(isOwner)` / `getCurrentBranding()` dans
 * `src/lib/branding.ts`.
 *
 * Voir docs/BRAND_MODE.md pour la procédure de déploiement.
 */

export type BuildBrandMode = "mahylan" | "generic";

export interface BuildBrand {
  mode: BuildBrandMode;
  /** Nom complet (title HTML, manifest.name). */
  appName: string;
  /** Nom court (manifest.short_name, max ~14 chars). */
  appShortName: string;
  description: string;
  /** Path public du logo principal du brand (PNG transparent). */
  logoPath: string;
  /** Path public du favicon .ico spécifique au brand. */
  faviconPath: string;
  /** Path public de l'apple-touch-icon (180×180, fond opaque). */
  appleTouchIconPath: string;
  /** Préfixe des icônes PWA (192/512 + maskable). */
  iconBasePath: string;
  /** Theme color (PWA + safari pinned tab). */
  themeColor: string;
  /** Background color (PWA splash screen). */
  backgroundColor: string;
}

const MAHYLAN_BRAND: BuildBrand = {
  mode: "mahylan",
  appName: "Les 12 coups de Mahylan",
  appShortName: "Mahylan",
  description: "Application personnelle de quiz pour Mahylan.",
  logoPath: "/logos/mahylan/logo.png",
  faviconPath: "/favicon-mahylan.ico",
  appleTouchIconPath: "/icons/mahylan/apple-touch-icon.png",
  iconBasePath: "/icons/mahylan",
  themeColor: "#0B1F4D",
  backgroundColor: "#FFF8E7",
};

const GENERIC_BRAND: BuildBrand = {
  mode: "generic",
  appName: "Coups de Midi Quiz",
  appShortName: "Coups de Midi",
  description:
    "Application de quiz multijoueur inspirée des 12 Coups de Midi.",
  logoPath: "/logos/generic/logo.png",
  faviconPath: "/favicon.ico",
  appleTouchIconPath: "/apple-touch-icon.png",
  iconBasePath: "",
  themeColor: "#0B1F4D",
  backgroundColor: "#FFF8E7",
};

/**
 * Retourne le branding statique du déploiement courant.
 * Lit dynamiquement `process.env` à chaque appel (pas de cache au
 * top-level) pour permettre les tests via `vi.stubEnv`.
 *
 * Fallback sur "generic" si la variable est absente, vide ou
 * inconnue — défaut sûr (le déploiement public reste publique).
 */
export function getBuildBrand(): BuildBrand {
  const mode = process.env.NEXT_PUBLIC_BRAND_MODE;
  if (mode === "mahylan") return MAHYLAN_BRAND;
  return GENERIC_BRAND;
}
