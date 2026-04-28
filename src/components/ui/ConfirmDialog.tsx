"use client";

import { useEffect } from "react";
import { AlertTriangle, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";

export type ConfirmVariant = "danger" | "primary" | "gold";

export interface ConfirmDialogProps {
  open: boolean;
  onClose: () => void;
  onConfirm: () => void;
  title: string;
  description?: string;
  confirmLabel?: string;
  confirmVariant?: ConfirmVariant;
  cancelLabel?: string;
  /** Si true, désactive le bouton confirmer (transition en cours). */
  isPending?: boolean;
}

/**
 * H4.3 — Modal de confirmation stylée, remplace toutes les
 * `window.confirm()` natives.
 *
 * Usage typique via le hook `useConfirm()` (cf. `useConfirm.ts`),
 * mais peut aussi être utilisé en composant contrôlé classique.
 *
 * Échap ferme le dialog. Clic sur l'overlay ferme aussi.
 */
export function ConfirmDialog({
  open,
  onClose,
  onConfirm,
  title,
  description,
  confirmLabel = "Confirmer",
  confirmVariant = "primary",
  cancelLabel = "Annuler",
  isPending = false,
}: ConfirmDialogProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !isPending) onClose();
      if (e.key === "Enter" && !isPending) onConfirm();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, onConfirm, isPending]);

  const confirmCls = {
    danger:
      "bg-buzz text-white shadow-[0_4px_0_0_#a32634] hover:-translate-y-px",
    primary:
      "bg-foreground text-background shadow-[0_4px_0_0_rgba(0,0,0,0.3)] hover:-translate-y-px",
    gold: "bg-gold text-on-color shadow-[0_4px_0_0_#e89e00] hover:-translate-y-px",
  }[confirmVariant];

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => !isPending && onClose()}
          className="fixed inset-0 z-[300] flex items-center justify-center bg-foreground/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-labelledby="confirm-title"
        >
          <motion.div
            initial={{ scale: 0.9, y: 10 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.9, y: 10 }}
            transition={{ type: "spring", stiffness: 280, damping: 24 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
          >
            <div className="flex items-start gap-3 p-5">
              {confirmVariant === "danger" && (
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-buzz/15 text-buzz">
                  <AlertTriangle className="h-5 w-5" aria-hidden="true" />
                </div>
              )}
              <div className="flex-1">
                <h2
                  id="confirm-title"
                  className="font-display text-lg font-extrabold text-foreground"
                >
                  {title}
                </h2>
                {description && (
                  <p className="mt-1.5 text-sm text-foreground/70">
                    {description}
                  </p>
                )}
              </div>
              <button
                type="button"
                onClick={onClose}
                disabled={isPending}
                aria-label="Fermer"
                className="flex h-8 w-8 shrink-0 items-center justify-center rounded-md text-foreground/55 hover:bg-foreground/10 disabled:opacity-50"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-border bg-muted/40 px-5 py-3">
              <button
                type="button"
                onClick={onClose}
                disabled={isPending}
                className="inline-flex h-10 items-center rounded-md border border-border bg-card px-4 text-sm font-bold text-foreground/80 transition-colors hover:bg-foreground/5 disabled:opacity-50"
              >
                {cancelLabel}
              </button>
              <button
                type="button"
                onClick={onConfirm}
                disabled={isPending}
                className={cn(
                  "inline-flex h-10 items-center rounded-md px-4 text-sm font-bold transition-all disabled:opacity-50",
                  confirmCls,
                )}
              >
                {confirmLabel}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
