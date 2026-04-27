"use client";

import { useState } from "react";
import { Apple, Info, Smartphone, X } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { cn } from "@/lib/utils";

/**
 * Lien discret + modal d'aide pour installer plus de voix françaises
 * dans l'OS de l'utilisateur (Windows / macOS / Android).
 *
 * Le dropdown TTS est limité à ce que `speechSynthesis.getVoices()`
 * expose, donc enrichir le set passe par les paramètres système.
 */

type OS = "windows" | "mac" | "android";

const STEPS: Record<OS, { label: string; icon: typeof Smartphone; steps: string[] }> = {
  windows: {
    label: "Windows",
    icon: Info, // Pas d'icône Windows dans Lucide, on utilise Info générique
    steps: [
      "Paramètres → Heure et langue → Voix",
      'Cliquer "Gérer les voix" → "Ajouter des voix"',
      "Chercher \"français\" → installer une ou plusieurs voix",
      "Voix dispos : France, Belgique, Suisse, Canada (gratuit)",
      "Recharger Mahylan : les nouvelles voix apparaissent dans le dropdown",
    ],
  },
  mac: {
    label: "macOS",
    icon: Apple,
    steps: [
      "Réglages Système → Accessibilité → Contenu énoncé",
      'Section "Voix système" → "Personnaliser"',
      "Cocher les voix françaises souhaitées (Premium recommandées)",
      "Téléchargement automatique en arrière-plan",
      "Recharger Mahylan une fois l'installation terminée",
    ],
  },
  android: {
    label: "Android",
    icon: Smartphone,
    steps: [
      "Paramètres → Accessibilité → Sortie de synthèse vocale",
      "Choisir le moteur (Google TTS recommandé)",
      'Engrenage à côté du moteur → "Installer les données vocales"',
      "Sélectionner Français + variantes (FR, BE, CA…)",
      "Redémarrer le navigateur Mahylan",
    ],
  },
};

interface VoiceInstallHelpProps {
  /**
   * Si true, affiche en plus un encart proactif suggérant d'installer
   * plus de voix (à utiliser quand on a peu de voix FR détectées).
   */
  proactive?: boolean;
}

export function VoiceInstallHelp({ proactive = false }: VoiceInstallHelpProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={cn(
          "inline-flex items-center gap-1.5 text-xs font-semibold transition-colors",
          proactive
            ? "rounded-md border border-gold/40 bg-gold/10 px-3 py-1.5 text-gold-warm hover:border-gold hover:bg-gold/20"
            : "text-foreground/60 hover:text-gold-warm",
        )}
      >
        <Info className="h-3.5 w-3.5" aria-hidden="true" />
        {proactive
          ? "Pas assez de voix ? Installes-en d'autres"
          : "Comment installer plus de voix ?"}
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 z-[200] flex items-center justify-center bg-navy/60 p-4"
            onClick={() => setOpen(false)}
            role="dialog"
            aria-modal="true"
            aria-label="Installer plus de voix françaises"
          >
            <motion.div
              initial={{ scale: 0.95, y: 10 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.95, y: 10 }}
              transition={{ type: "spring", stiffness: 280, damping: 24 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-lg overflow-hidden rounded-2xl border border-border bg-card p-6 shadow-2xl"
            >
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fermer"
                className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background/40 text-foreground/60 hover:border-foreground/30 hover:text-foreground"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>

              <div className="flex flex-col gap-4">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold/20 text-gold-warm">
                    <Info className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <div>
                    <h2 className="font-display text-lg font-extrabold text-foreground">
                      Plus de voix françaises
                    </h2>
                    <p className="text-xs text-foreground/60">
                      Mahylan utilise la synthèse vocale du système — les
                      voix dispo dépendent de ton OS.
                    </p>
                  </div>
                </div>

                {(Object.keys(STEPS) as OS[]).map((os) => {
                  const cfg = STEPS[os];
                  const Icon = cfg.icon;
                  return (
                    <section
                      key={os}
                      className="rounded-xl border border-border bg-background/40 p-3"
                    >
                      <h3 className="mb-2 flex items-center gap-2 font-display text-sm font-bold text-foreground">
                        <Icon
                          className="h-4 w-4 text-gold-warm"
                          aria-hidden="true"
                        />
                        {cfg.label}
                      </h3>
                      <ol className="ml-5 list-decimal space-y-1 text-sm text-foreground/80">
                        {cfg.steps.map((s, i) => (
                          <li key={i}>{s}</li>
                        ))}
                      </ol>
                    </section>
                  );
                })}

                <p className="text-[11px] text-foreground/50">
                  Astuce : sur les navigateurs Chromium, les voix Google
                  Cloud (très naturelles) sont disponibles automatiquement
                  sans installation.
                </p>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
