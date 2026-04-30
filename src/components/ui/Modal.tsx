"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  /** Largeur max — défaut "max-w-md". */
  size?: "sm" | "md" | "lg";
  children: React.ReactNode;
}

const SIZE_CLASS: Record<NonNullable<ModalProps["size"]>, string> = {
  sm: "max-w-sm",
  md: "max-w-md",
  lg: "max-w-lg",
};

/**
 * Modal réutilisable basique : overlay sombre + carte centrée +
 * fermeture au clic extérieur, sur la croix, ou avec Échap.
 *
 * Volontairement minimaliste (pas de dep externe) — pour les usages
 * complexes (forms, tabs internes), composer dedans.
 */
export function Modal({
  open,
  onClose,
  title,
  size = "md",
  children,
}: ModalProps) {
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
          className="fixed inset-0 z-[200] flex items-center justify-center bg-navy/60 p-4"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
          aria-label={title}
        >
          <motion.div
            initial={{ scale: 0.95, y: 10 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 10 }}
            transition={{ type: "spring", stiffness: 280, damping: 24 }}
            onClick={(e) => e.stopPropagation()}
            className={cn(
              "relative w-full overflow-hidden rounded-2xl border border-border bg-card p-5 shadow-2xl",
              SIZE_CLASS[size],
            )}
          >
            <div className="mb-4 flex items-center justify-between gap-2">
              <h2 className="font-display text-lg font-extrabold text-foreground">
                {title}
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Fermer"
                className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-background/40 text-foreground/60 hover:border-foreground/30 hover:text-foreground"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            {children}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
