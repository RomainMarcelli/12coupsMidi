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

const ORDER: LifeState[] = ["green", "yellow", "red"];

interface LifeBarProps {
  state: LifeState;
  className?: string;
}

/**
 * Barre de vie 3 pastilles vert/jaune/rouge.
 * Chaque pastille s'anime (scale + opacity) selon l'état courant :
 * - pastille active = gonflée, pleine couleur, glow
 * - pastilles au-delà = éteintes
 */
export function LifeBar({ state, className }: LifeBarProps) {
  const activeIndex = ORDER.indexOf(state);

  return (
    <div
      className={cn("flex items-center gap-2", className)}
      role="status"
      aria-label={`Vies : ${COLORS[state].label}`}
    >
      {ORDER.map((color, idx) => {
        const isActive = idx === activeIndex;
        const isDimmed = idx > activeIndex;
        const cfg = COLORS[color];

        return (
          <motion.span
            key={color}
            animate={{
              scale: isActive ? 1.25 : 1,
              opacity: isDimmed ? 0.15 : 1,
            }}
            transition={{ type: "spring", stiffness: 320, damping: 20 }}
            className={cn(
              "block h-4 w-4 rounded-full ring-1 ring-white/20",
              cfg.bg,
              isActive && cfg.glow,
            )}
            aria-hidden="true"
          />
        );
      })}
    </div>
  );
}
