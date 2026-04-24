import {
  Atom,
  BookOpen,
  BrainCircuit,
  Drama,
  FlaskConical,
  Gamepad2,
  Globe2,
  Landmark,
  Leaf,
  Music,
  Newspaper,
  Palette,
  Trophy,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";

/**
 * Mapping slug catégorie → icône Lucide.
 *
 * La colonne `categories.emoji` en base contient un emoji de référence, mais
 * l'UI Midi Master n'affiche PAS d'emoji (règle projet) — on utilise cette
 * table pour retomber sur une icône Lucide cohérente.
 */
export const CATEGORY_ICONS: Record<string, LucideIcon> = {
  histoire: Landmark,
  geographie: Globe2,
  sport: Trophy,
  art: Palette,
  litterature: BookOpen,
  svt: Leaf,
  chimie: FlaskConical,
  physique: Atom,
  "jeu-video": Gamepad2,
  actualite: Newspaper,
  "cinema-tv": Drama,
  musique: Music,
  gastronomie: UtensilsCrossed,
  "culture-g": BrainCircuit,
};

export function iconForCategorySlug(slug: string | null | undefined): LucideIcon {
  if (!slug) return BrainCircuit;
  return CATEGORY_ICONS[slug] ?? BrainCircuit;
}
