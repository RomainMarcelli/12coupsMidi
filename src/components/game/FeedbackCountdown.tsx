"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface FeedbackCountdownProps {
  /** Durée totale du compte à rebours en secondes. */
  seconds?: number;
  /** Callback quand on passe à la suivante (timer écoulé OU clic bouton). */
  onSkip: () => void;
  /** Texte du bouton (défaut : "Passer à la suite"). */
  label?: string;
  /** Désactive le bouton et le timer (utile pendant un bot turn par exemple). */
  paused?: boolean;
  className?: string;
}

/**
 * Compteur visuel + gros bouton "Passer à la suite" affiché après le feedback
 * d'une question. À 0, déclenche `onSkip` automatiquement.
 *
 * Tap target : 48 px de hauteur (au-dessus des 44 px iOS recommandés).
 * Le compte à rebours est arrondi à la seconde inférieure pour rester lisible.
 */
export function FeedbackCountdown({
  seconds = 30,
  onSkip,
  label = "Passer à la suite",
  paused = false,
  className,
}: FeedbackCountdownProps) {
  const [remaining, setRemaining] = useState(seconds);
  const firedRef = useRef(false);

  // Reset si la durée change (changement de question).
  useEffect(() => {
    setRemaining(seconds);
    firedRef.current = false;
  }, [seconds]);

  useEffect(() => {
    if (paused) return;
    if (remaining <= 0) {
      if (!firedRef.current) {
        firedRef.current = true;
        onSkip();
      }
      return;
    }
    const id = window.setInterval(() => {
      setRemaining((r) => Math.max(0, r - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [paused, remaining, onSkip]);

  function handleClick() {
    if (firedRef.current) return;
    firedRef.current = true;
    onSkip();
  }

  // Pourcentage écoulé pour la barre de progression discrète sous le bouton.
  const ratio = Math.max(0, Math.min(1, 1 - remaining / seconds));

  return (
    <div className={cn("flex flex-col items-end gap-2", className)}>
      <button
        type="button"
        onClick={handleClick}
        disabled={paused}
        aria-label={label}
        className={cn(
          // Tap target 48×48 minimum (recommandation iOS 44, on prend large)
          "group inline-flex h-12 min-w-[44px] items-center gap-2 rounded-xl bg-gold px-5 font-bold text-navy shadow-[0_4px_0_0_#e89e00] transition-all",
          "hover:-translate-y-px hover:shadow-[0_6px_18px_rgba(245,183,0,0.55)]",
          "active:translate-y-px active:shadow-[0_2px_0_0_#e89e00]",
          "disabled:cursor-not-allowed disabled:opacity-60",
        )}
      >
        <span>{label}</span>
        <ArrowRight
          className="h-5 w-5 transition-transform group-hover:translate-x-0.5"
          aria-hidden="true"
        />
      </button>
      <div className="flex items-center gap-2">
        <div
          className="h-1 w-24 overflow-hidden rounded-full bg-foreground/10"
          aria-hidden="true"
        >
          <div
            className="h-full bg-gold/70 transition-all duration-1000 ease-linear"
            style={{ width: `${ratio * 100}%` }}
          />
        </div>
        <span
          className="text-xs tabular-nums text-foreground/60"
          aria-live="polite"
        >
          Suite dans {remaining} s…
        </span>
      </div>
    </div>
  );
}
