"use client";

import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

export type LifeState = "green" | "yellow" | "red";

const COLORS: Record<LifeState, { bg: string; glow: string; label: string }> = {
  green: {
    bg: "bg-life-green",
    glow: "shadow-[0_0_16px_rgba(46,204,113,0.7)]",
    label: "plein",
  },
  yellow: {
    bg: "bg-life-yellow",
    glow: "shadow-[0_0_16px_rgba(245,197,24,0.7)]",
    label: "attention",
  },
  red: {
    bg: "bg-life-red",
    glow: "shadow-[0_0_16px_rgba(230,57,70,0.7)]",
    label: "critique",
  },
};

interface LifeBarProps {
  state: LifeState;
  className?: string;
}

/**
 * Indicateur de vie : une SEULE pastille colorée selon l'état courant.
 * Vert = plein, Jaune = attention, Rouge = critique.
 * Anime un changement d'état avec une petite pulsation + crossfade entre
 * couleurs (la `key={state}` force le remount → nouveau spring).
 */
export function LifeBar({ state, className }: LifeBarProps) {
  const cfg = COLORS[state];

  return (
    <div
      className={cn("flex items-center", className)}
      role="status"
      aria-label={`Vies : ${cfg.label}`}
    >
      <motion.span
        key={state}
        initial={{ scale: 0.6, opacity: 0 }}
        animate={{ scale: 1.1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 18 }}
        className={cn(
          "block h-4 w-4 rounded-full ring-1 ring-navy/20",
          cfg.bg,
          cfg.glow,
        )}
        aria-hidden="true"
      />
    </div>
  );
}
