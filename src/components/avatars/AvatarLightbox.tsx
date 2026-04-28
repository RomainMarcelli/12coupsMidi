"use client";

import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import Image from "next/image";
import { X, Trash2 } from "lucide-react";

interface AvatarLightboxProps {
  open: boolean;
  url: string | null;
  tags?: string[];
  uploadedAtIso?: string | null;
  onClose: () => void;
  /** Si fourni, affiche le bouton "Supprimer" en bas. */
  onDelete?: () => void;
}

/**
 * I4.1 — Lightbox d'aperçu d'avatar.
 *
 *   • Image agrandie centrée, max 80 % du viewport.
 *   • Fond noir semi-transparent (clic = fermer).
 *   • Croix en haut à droite + Échap = fermer.
 *   • Tags + date d'upload + bouton "Supprimer" optionnel.
 *
 * Composant générique : utilisable depuis n'importe quel listing
 * d'avatars (pas seulement admin) en passant ou non `onDelete`.
 */
export function AvatarLightbox({
  open,
  url,
  tags = [],
  uploadedAtIso = null,
  onClose,
  onDelete,
}: AvatarLightboxProps) {
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    // Bloque le scroll du body pendant que le modal est ouvert.
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && url && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/75 p-4 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-label="Aperçu de l'avatar"
        >
          <motion.div
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.94, opacity: 0 }}
            transition={{ type: "spring", stiffness: 240, damping: 24 }}
            onClick={(e) => e.stopPropagation()}
            className="relative flex max-h-[80vh] w-full max-w-[80vw] flex-col items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-2xl sm:p-6"
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer"
              title="Fermer (Échap)"
              className="absolute right-2 top-2 inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background text-foreground/70 transition-colors hover:border-buzz/50 hover:text-buzz"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>

            <div className="relative flex h-[50vh] w-full max-w-[60vh] items-center justify-center">
              <Image
                src={url}
                alt="Avatar agrandi"
                fill
                sizes="(max-width: 640px) 80vw, 60vh"
                className="rounded-xl object-contain"
                unoptimized
                priority
              />
            </div>

            {(tags.length > 0 || uploadedAtIso) && (
              <div className="flex w-full flex-col gap-2 text-center text-xs text-foreground/70">
                {tags.length > 0 && (
                  <div className="flex flex-wrap items-center justify-center gap-1.5">
                    {tags.map((t) => (
                      <span
                        key={t}
                        className="rounded-full bg-foreground/10 px-2 py-0.5 text-[11px] font-bold text-foreground/80"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
                {uploadedAtIso && (
                  <p className="text-[11px] text-foreground/55">
                    Importé le{" "}
                    {new Intl.DateTimeFormat("fr-FR", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    }).format(new Date(uploadedAtIso))}
                  </p>
                )}
              </div>
            )}

            {onDelete && (
              <button
                type="button"
                onClick={onDelete}
                className="inline-flex items-center gap-1.5 rounded-md border border-buzz/40 bg-buzz/10 px-4 py-2 text-sm font-bold text-buzz transition-colors hover:bg-buzz/20"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Supprimer cet avatar
              </button>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
