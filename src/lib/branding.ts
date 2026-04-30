/**
 * K4 — Branding conditionnel Mahylan vs générique.
 *
 * L'utilisateur "owner" (Mahylan, marqué `profiles.is_owner = TRUE`)
 * voit le branding personnalisé. Tous les autres voient le branding
 * générique "Coups de Midi Quiz".
 *
 * Cette fonction est PURE — pas de hook React. Elle est appelée :
 *   - Côté serveur : dans `(app)/layout.tsx` (qui lit `profiles.is_owner`)
 *     et passe le résultat aux composants client.
 *   - Côté pages publiques (login, not-found, manifest) : on appelle
 *     directement `getBranding(false)` pour avoir le générique.
 *
 * Note : le manifest.json reste statique (générique) car il est servi
 * AVANT l'auth. Le compte owner accepte de voir "Coups de Midi Quiz"
 * dans l'icône d'install PWA — limitation acceptée.
 */

export interface AppBranding {
  /** Nom complet affiché (Navbar, header, page title). */
  appName: string;
  /** Nom court (max ~14 chars) pour les contextes étroits. */
  shortName: string;
  /** URL du logo principal (utilisée en navbar, favicons inline). */
  logoUrl: string;
  /**
   * L2.2 — URL du logo "grand format" (hero, splash). Pour Mahylan
   * c'est le même fichier mais on l'affichera plus grand côté UI ;
   * pour le générique c'est aussi le même fichier (pas de version
   * dédiée).
   */
  logoLargeUrl: string;
  /** Couleur d'accent du nom dans la Navbar (cf. <span>{accentWord}</span>). */
  accentWord: string;
  /** Mot précédant l'accent (ex. "Les" dans "Les 12 coups de Mahylan"). */
  prefixWord: string;
  /** Mot suivant l'accent (ex. "de Mahylan"). */
  suffixWord: string;
  /**
   * L2.2 — Flag exposé pour permettre aux composants d'adapter
   * largeur/halo/animations sans avoir à comparer les URLs ou les
   * appName. Source de vérité = `profiles.is_owner`.
   */
  isOwner: boolean;
}

const MAHYLAN: AppBranding = {
  appName: "Les 12 coups de Mahylan",
  shortName: "Mahylan",
  logoUrl: "/logos/mahylan/logo.png",
  logoLargeUrl: "/logos/mahylan/logo.png",
  prefixWord: "Les",
  accentWord: "12 coups",
  suffixWord: "de Mahylan",
  isOwner: true,
};

const GENERIC: AppBranding = {
  appName: "Coups de Midi Quiz",
  shortName: "Coups de Midi",
  logoUrl: "/logos/generic/logo.png",
  logoLargeUrl: "/logos/generic/logo.png",
  prefixWord: "Coups",
  accentWord: "de Midi",
  suffixWord: "Quiz",
  isOwner: false,
};

export function getBranding(isOwner: boolean | null | undefined): AppBranding {
  return isOwner === true ? MAHYLAN : GENERIC;
}

/**
 * Helper server-only : charge le branding du user courant à partir
 * de `profiles.is_owner`. Retourne le générique si pas connecté.
 *
 * Utilisé par les server components qui ne sont pas dans `(app)/layout.tsx`
 * (typiquement `(app)/page.tsx`) — évite d'avoir à drill la prop
 * branding partout.
 */
export async function getCurrentBranding(): Promise<AppBranding> {
  const { createClient } = await import("@/lib/supabase/server");
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return GENERIC;
  const { data } = await supabase
    .from("profiles")
    .select("is_owner")
    .eq("id", user.id)
    .single();
  return getBranding(data?.is_owner === true);
}
