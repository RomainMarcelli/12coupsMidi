"use client";

import { useEffect, useRef, useState } from "react";
import { Swords } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface TransitionDuelOverlayProps {
  /** Pseudo du joueur qui passe au rouge (affiché dans l'encart). */
  pseudo: string;
  /** Durée du sas en secondes (défaut 20 s). */
  seconds?: number;
  /** Callback quand le countdown arrive à 0 OU clic sur le bouton. */
  onStartDuel: () => void;
  className?: string;
}

/**
 * Encart d'avertissement affiché pendant la phase `transition_duel` du
 * parcours 12 Coups. Apparaît en bas du Jeu 1 ou Jeu 2 (qui continuent
 * d'afficher la question + le feedback de l'erreur fatale + l'explication).
 *
 * Compte à rebours de 20 s par défaut, avec un bouton "Passer au duel"
 * pour accélérer manuellement. Le countdown ET le bouton appellent le
 * MÊME callback (`onStartDuel`), idempotent.
 *
 * Animation : slide depuis le bas + halo rouge subtil pour matérialiser
 * le passage au rouge.
 */
export function TransitionDuelOverlay({
  pseudo,
  seconds = 20,
  onStartDuel,
  className,
}: TransitionDuelOverlayProps) {
  const [remaining, setRemaining] = useState(seconds);
  const firedRef = useRef(false);

  useEffect(() => {
    setRemaining(seconds);
    firedRef.current = false;
  }, [seconds]);

  useEffect(() => {
    if (remaining <= 0) {
      if (!firedRef.current) {
        firedRef.current = true;
        onStartDuel();
      }
      return;
    }
    const id = window.setInterval(() => {
      setRemaining((r) => Math.max(0, r - 1));
    }, 1000);
    return () => window.clearInterval(id);
  }, [remaining, onStartDuel]);

  function handleClick() {
    if (firedRef.current) return;
    firedRef.current = true;
    onStartDuel();
  }

  const ratio = Math.max(0, Math.min(1, 1 - remaining / seconds));

  return (
    <motion.div
      role="alert"
      initial={{ opacity: 0, y: 24 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 280, damping: 24 }}
      className={cn(
        "relative overflow-hidden rounded-2xl border-2 border-buzz/60 bg-buzz/10 p-5 shadow-[0_8px_32px_rgba(230,57,70,0.25)]",
        className,
      )}
    >
      {/* Halo rouge pulsant en arrière-plan */}
      <motion.div
        aria-hidden="true"
        className="absolute inset-0 -z-10 bg-buzz/15"
        initial={{ opacity: 0.2 }}
        animate={{ opacity: [0.2, 0.45, 0.2] }}
        transition={{ duration: 1.6, repeat: Infinity }}
      />

      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-buzz/25 text-buzz">
          <Swords className="h-5 w-5" aria-hidden="true" />
        </div>
        <div className="flex-1">
          <p className="font-display text-lg font-extrabold uppercase tracking-wide text-buzz">
            {pseudo} passe au rouge
          </p>
          <p className="mt-1 text-sm text-navy/80">
            Préparation du duel. Tu peux relire la bonne réponse et
            l&apos;explication, le duel démarre dans{" "}
            <strong className="tabular-nums text-buzz">{remaining} s</strong>.
          </p>
        </div>
      </div>

      <div className="mt-4 flex flex-col items-stretch gap-3 sm:flex-row sm:items-center sm:justify-between">
        <button
          type="button"
          onClick={handleClick}
          aria-label="Passer au duel"
          className={cn(
            "inline-flex h-12 items-center justify-center gap-2 rounded-xl bg-buzz px-6 font-bold uppercase tracking-wide text-cream shadow-[0_4px_0_0_#a32634] transition-all",
            "hover:-translate-y-px hover:shadow-[0_6px_18px_rgba(230,57,70,0.55)]",
            "active:translate-y-px active:shadow-[0_2px_0_0_#a32634]",
          )}
        >
          <span>Passer au duel</span>
          <Swords className="h-5 w-5" aria-hidden="true" />
        </button>

        <div className="flex items-center gap-2 sm:flex-1 sm:justify-end">
          <div
            className="h-1.5 w-full max-w-[160px] overflow-hidden rounded-full bg-buzz/20"
            aria-hidden="true"
          >
            <div
              className="h-full bg-buzz transition-all duration-1000 ease-linear"
              style={{ width: `${ratio * 100}%` }}
            />
          </div>
          <span
            className="text-xs tabular-nums text-buzz/80"
            aria-live="polite"
          >
            {remaining}s
          </span>
        </div>
      </div>
    </motion.div>
  );
}
