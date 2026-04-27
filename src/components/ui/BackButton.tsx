"use client";

import { ChevronLeft } from "lucide-react";
import Link from "next/link";
import { cn } from "@/lib/utils";

interface BackButtonProps {
  /** URL de destination. */
  href: string;
  /** Texte affiché à côté du chevron. Défaut "Retour". */
  label?: string;
  className?: string;
}

/**
 * Bouton "retour" réutilisable, harmonisé partout dans l'app.
 *  - Icône ChevronLeft (Lucide)
 *  - Style ghost or : transparent au repos, fond doré subtil au hover
 *  - Léger scale au hover pour un feedback haptique discret
 *
 * Utilisation : <BackButton href="/parametres" label="Paramètres" />
 */
export function BackButton({
  href,
  label = "Retour",
  className,
}: BackButtonProps) {
  return (
    <Link
      href={href}
      aria-label={label}
      className={cn(
        "group inline-flex h-9 items-center gap-1 rounded-lg border border-transparent px-2 text-sm font-semibold text-foreground/70 transition-all",
        "hover:scale-[1.02] hover:border-gold/40 hover:bg-gold/10 hover:text-gold-warm hover:shadow-[0_2px_12px_rgba(245,183,0,0.2)]",
        className,
      )}
    >
      <ChevronLeft
        className="h-4 w-4 transition-transform group-hover:-translate-x-0.5"
        aria-hidden="true"
      />
      <span>{label}</span>
    </Link>
  );
}
