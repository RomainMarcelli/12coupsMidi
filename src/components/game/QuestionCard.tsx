"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface QuestionCardProps {
  enonce: string;
  category?: string;
  categoryColor?: string;
  difficulte?: number;
  className?: string;
  /** Clé unique pour re-déclencher l'animation d'entrée à chaque question. */
  keyId?: string | number;
}

/**
 * Carte de question — catégorie en badge coloré en haut, énoncé gros et lisible.
 * Animation d'entrée : slide-up + fade, ré-jouée quand `keyId` change.
 */
export function QuestionCard({
  enonce,
  category,
  categoryColor,
  difficulte,
  className,
  keyId,
}: QuestionCardProps) {
  return (
    <motion.article
      key={keyId}
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -24 }}
      transition={{ duration: 0.35, ease: "easeOut" }}
      className={cn(
        "flex flex-col gap-5 rounded-2xl border border-border bg-card p-6 text-card-foreground glow-card sm:p-8",
        className,
      )}
    >
      {(category ?? difficulte) !== undefined && (
        <div className="flex items-center gap-2">
          {category && (
            <span
              className="inline-flex items-center rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-wide text-midnight"
              style={{ backgroundColor: categoryColor ?? "var(--color-gold)" }}
            >
              {category}
            </span>
          )}
          {difficulte !== undefined && (
            <span
              className="inline-flex items-center gap-0.5 text-xs text-muted-foreground"
              aria-label={`Difficulté ${difficulte} sur 5`}
            >
              {Array.from({ length: 5 }, (_, i) => (
                <span
                  key={i}
                  className={cn(
                    "block h-1.5 w-3 rounded-sm",
                    i < difficulte ? "bg-gold" : "bg-navy/10",
                  )}
                  aria-hidden="true"
                />
              ))}
            </span>
          )}
        </div>
      )}

      <h2 className="font-display text-2xl font-bold leading-tight text-foreground sm:text-3xl md:text-4xl">
        {enonce}
      </h2>
    </motion.article>
  );
}
