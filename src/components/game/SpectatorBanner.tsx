"use client";

import { Eye, RotateCcw } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface SpectatorBannerProps {
  /** Affiche le bouton "Recommencer" (= aucun autre humain en jeu). */
  canRestart: boolean;
  onRestart: () => void;
  onContinueWatching: () => void;
  className?: string;
}

/**
 * Encart "tu as été éliminé" affiché en haut de l'écran après élimination
 * du joueur humain dans une partie vs Bots.
 *
 * Si `canRestart === false` (autres humains encore en jeu), seul le bouton
 * "Continuer à regarder" est proposé — on ne peut pas couper la partie des
 * autres.
 */
export function SpectatorBanner({
  canRestart,
  onRestart,
  onContinueWatching,
  className,
}: SpectatorBannerProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: -16 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -16 }}
      transition={{ type: "spring", stiffness: 220, damping: 20 }}
      role="status"
      className={cn(
        "mx-auto flex w-full max-w-3xl flex-col gap-3 rounded-2xl border border-buzz/40 bg-buzz/10 p-4 text-foreground sm:flex-row sm:items-center",
        className,
      )}
    >
      <div className="flex flex-1 items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-buzz/20 text-buzz">
          <Eye className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <p className="font-display text-base font-bold text-buzz">
            Tu as été éliminé !
          </p>
          <p className="text-sm text-foreground/70">
            {canRestart
              ? "Tu peux observer les bots jouer ou recommencer la partie."
              : "Tu peux observer la fin de la partie sans déranger les autres joueurs."}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        {canRestart && (
          <Button variant="gold" size="sm" onClick={onRestart}>
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Recommencer
          </Button>
        )}
        <button
          type="button"
          onClick={onContinueWatching}
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-sm font-semibold text-foreground/80 hover:border-gold/50 hover:bg-gold/10"
        >
          <Eye className="h-4 w-4" aria-hidden="true" />
          Continuer à regarder
        </button>
      </div>
    </motion.div>
  );
}

/**
 * Bouton flottant "↻ Recommencer" en bas à droite, visible quand l'humain
 * a choisi de continuer à regarder mais peut toujours abandonner.
 * Ne s'affiche pas si `canRestart === false`.
 */
export function FloatingRestartButton({
  visible,
  onRestart,
}: {
  visible: boolean;
  onRestart: () => void;
}) {
  if (!visible) return null;
  return (
    <button
      type="button"
      onClick={onRestart}
      title="Recommencer la partie"
      aria-label="Recommencer la partie"
      className="fixed bottom-4 right-4 z-40 inline-flex h-12 items-center gap-1.5 rounded-full border border-buzz/50 bg-card px-4 font-bold text-buzz shadow-[0_4px_18px_rgba(0,0,0,0.3)] transition-all hover:-translate-y-px hover:bg-buzz/15"
    >
      <RotateCcw className="h-4 w-4" aria-hidden="true" />
      Recommencer
    </button>
  );
}
