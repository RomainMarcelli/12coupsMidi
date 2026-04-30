"use client";

import { useState, useTransition } from "react";
import { Star } from "lucide-react";
import { cn } from "@/lib/utils";
import { toggleFavorite } from "@/app/(app)/favoris/actions";

interface FavoriteStarProps {
  questionId: string;
  /** État initial (true si question déjà en favoris). */
  initial?: boolean;
  className?: string;
}

/**
 * Bouton étoile : ajoute/retire la question des favoris du user.
 * Optimiste : on bascule l'UI immédiatement, puis on synchronise.
 */
export function FavoriteStar({
  questionId,
  initial = false,
  className,
}: FavoriteStarProps) {
  const [active, setActive] = useState(initial);
  const [, startTransition] = useTransition();

  function onClick(e: React.MouseEvent) {
    e.preventDefault();
    e.stopPropagation();
    const optimistic = !active;
    setActive(optimistic);
    startTransition(async () => {
      const res = await toggleFavorite(questionId);
      if (res.status === "error") {
        setActive(!optimistic); // rollback
      } else {
        setActive(res.status === "added");
      }
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      title={active ? "Retirer des favoris" : "Ajouter aux favoris"}
      aria-label={active ? "Retirer des favoris" : "Ajouter aux favoris"}
      className={cn(
        "inline-flex items-center justify-center rounded-full border p-1.5 transition-colors",
        active
          ? "border-gold/60 bg-gold/15 text-gold-warm"
          : "border-border bg-card text-foreground/40 hover:border-gold/50 hover:text-gold-warm",
        className,
      )}
    >
      <Star
        className="h-4 w-4"
        aria-hidden="true"
        fill={active ? "currentColor" : "none"}
      />
    </button>
  );
}
