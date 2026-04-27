"use client";

import { useEffect } from "react";
import { motion } from "framer-motion";
import { Crown } from "lucide-react";
import { playSound } from "@/lib/sounds";

interface IntroScreenProps {
  onEnd: () => void;
  /** Durée totale avant transition automatique (ms). */
  duration?: number;
}

/**
 * Intro cinématique des 12 Coups de Midi.
 *  - Flash gold / logo couronne
 *  - Gros titre "LES 12 COUPS DE MIDI"
 *  - Sous-titre "1er Jeu : Le Coup d'Envoi"
 *  - Jingle (son "win" existant, jouable post-interaction)
 *  - Auto-transition après `duration` ms
 */
export function DcIntroScreen({ onEnd, duration = 3200 }: IntroScreenProps) {
  useEffect(() => {
    playSound("win");
    const t = window.setTimeout(onEnd, duration);
    return () => window.clearTimeout(t);
  }, [onEnd, duration]);

  return (
    <main className="relative mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-6 overflow-hidden p-6 text-center">
      <motion.div
        className="absolute inset-0 -z-10 bg-gradient-to-br from-gold-pale via-cream to-sky-pale"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 1, 0.8] }}
        transition={{ duration: 0.8 }}
      />
      <motion.div
        className="absolute -right-16 -top-16 -z-10 h-64 w-64 rounded-full bg-gold/35 blur-3xl"
        animate={{ scale: [1, 1.2, 1] }}
        transition={{ duration: 2, repeat: Infinity }}
      />

      <motion.div
        initial={{ scale: 0.4, rotate: -20, opacity: 0 }}
        animate={{ scale: 1, rotate: 0, opacity: 1 }}
        transition={{ type: "spring", stiffness: 180, damping: 14 }}
        className="flex h-28 w-28 items-center justify-center rounded-3xl bg-gold/30 shadow-[0_0_64px_rgba(245,183,0,0.6)]"
      >
        <Crown
          className="h-16 w-16 text-gold-warm"
          aria-hidden="true"
          fill="currentColor"
        />
      </motion.div>

      <motion.h1
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4, duration: 0.6 }}
        className="font-display text-4xl font-extrabold uppercase tracking-widest text-foreground sm:text-5xl"
      >
        Les 12 Coups
        <br />
        <span className="text-gold-warm">de Midi</span>
      </motion.h1>

      <motion.p
        initial={{ opacity: 0, scale: 0.7 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 1.6, type: "spring", stiffness: 220, damping: 18 }}
        className="rounded-full border-2 border-gold bg-card/80 px-4 py-2 font-display text-sm font-bold uppercase tracking-wider text-foreground sm:text-base"
      >
        1<sup>er</sup>  Jeu · Le Coup d&apos;Envoi
      </motion.p>
    </main>
  );
}
