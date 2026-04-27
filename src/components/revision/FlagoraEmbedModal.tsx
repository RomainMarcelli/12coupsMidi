"use client";

import { useEffect, useState } from "react";
import { ExternalLink, Globe, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

const FLAGORA_URL = "https://flagora-eight.vercel.app/";

interface FlagoraEmbedModalProps {
  open: boolean;
  onClose: () => void;
}

/**
 * Modal qui embarque l'app externe Flagora (Drapeaux & Capitales) dans
 * un iframe (F2.2). Si le navigateur refuse l'iframe (CSP / X-Frame-
 * Options), on bascule automatiquement sur "Ouvrir dans un nouvel
 * onglet" et on affiche un message clair.
 *
 * Détection du blocage : on observe le `onLoad` de l'iframe avec un
 * timer de 4 s. Si onLoad n'a pas été déclenché dans ce délai, on
 * suppose qu'il y a blocage et on affiche le fallback.
 */
export function FlagoraEmbedModal({ open, onClose }: FlagoraEmbedModalProps) {
  const [iframeLoaded, setIframeLoaded] = useState(false);
  const [iframeBlocked, setIframeBlocked] = useState(false);

  // Reset à chaque ouverture
  useEffect(() => {
    if (!open) {
      setIframeLoaded(false);
      setIframeBlocked(false);
      return;
    }
    // Timer pour détecter un blocage CSP / X-Frame-Options
    const t = window.setTimeout(() => {
      if (!iframeLoaded) setIframeBlocked(true);
    }, 4000);
    return () => window.clearTimeout(t);
  }, [open, iframeLoaded]);

  // Échap = ferme
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-foreground/60 p-4"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label="Drapeaux & Capitales — Flagora"
        >
          <motion.div
            initial={{ scale: 0.95, y: 10 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 10 }}
            transition={{ type: "spring", stiffness: 280, damping: 24 }}
            onClick={(e) => e.stopPropagation()}
            className="relative flex h-[90vh] w-full max-w-6xl flex-col overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
          >
            {/* Header */}
            <header className="flex items-center justify-between gap-3 border-b border-border bg-card px-4 py-3">
              <div className="flex items-center gap-2">
                <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-sky/15 text-sky">
                  <Globe className="h-5 w-5" aria-hidden="true" />
                </div>
                <div>
                  <h2 className="font-display text-base font-extrabold text-foreground">
                    Drapeaux &amp; Capitales
                  </h2>
                  <p className="text-[11px] text-foreground/55">
                    propulsé par Flagora
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <a
                  href={FLAGORA_URL}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-bold text-foreground/80 transition-colors hover:border-gold/50 hover:bg-gold/10"
                >
                  <ExternalLink className="h-3.5 w-3.5" aria-hidden="true" />
                  Nouvel onglet
                </a>
                <button
                  type="button"
                  onClick={onClose}
                  aria-label="Fermer"
                  className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card text-foreground/60 hover:border-foreground/30 hover:text-foreground"
                >
                  <X className="h-4 w-4" aria-hidden="true" />
                </button>
              </div>
            </header>

            {/* Corps : iframe + overlay loading + fallback si bloqué */}
            <div className="relative flex-1 overflow-hidden bg-background">
              {!iframeBlocked && (
                <iframe
                  src={FLAGORA_URL}
                  title="Flagora"
                  className={cn(
                    "h-full w-full border-0 transition-opacity",
                    iframeLoaded ? "opacity-100" : "opacity-0",
                  )}
                  onLoad={() => setIframeLoaded(true)}
                  // Permissions raisonnables pour une app de quiz
                  sandbox="allow-scripts allow-same-origin allow-popups allow-forms"
                />
              )}
              {!iframeLoaded && !iframeBlocked && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 text-foreground/55">
                  <div className="h-10 w-10 animate-spin rounded-full border-4 border-gold/30 border-t-gold" />
                  <p className="text-sm">Chargement de Flagora…</p>
                </div>
              )}
              {iframeBlocked && (
                <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
                  <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-buzz/15 text-buzz">
                    <Globe className="h-8 w-8" aria-hidden="true" />
                  </div>
                  <div>
                    <h3 className="font-display text-lg font-extrabold text-foreground">
                      Embed bloqué par le site
                    </h3>
                    <p className="mt-1 max-w-md text-sm text-foreground/65">
                      Flagora refuse d&apos;être affiché en iframe. Pas
                      grave — tu peux l&apos;ouvrir dans un nouvel
                      onglet.
                    </p>
                  </div>
                  <a
                    href={FLAGORA_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-2 rounded-xl bg-gold px-6 py-3 font-display text-base font-extrabold uppercase tracking-wide text-on-color shadow-[0_4px_0_0_#e89e00] transition-all hover:-translate-y-0.5"
                  >
                    <ExternalLink className="h-5 w-5" aria-hidden="true" />
                    Ouvrir Flagora
                  </a>
                </div>
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
