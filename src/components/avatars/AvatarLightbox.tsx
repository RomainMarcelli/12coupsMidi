"use client";

import { useEffect } from "react";
import { motion, AnimatePresence, type PanInfo } from "framer-motion";
import Image from "next/image";
import { ChevronLeft, ChevronRight, Trash2, X } from "lucide-react";
import { cn } from "@/lib/utils";

export interface LightboxAvatar {
  url: string;
  tags?: string[];
  uploadedAtIso?: string | null;
}

interface AvatarLightboxProps {
  open: boolean;
  /**
   * J4.1 — Liste des avatars de la collection (pour navigation
   * fléchée/swipe). Si non fourni, le lightbox affiche juste l'avatar
   * `current` sans flèches.
   */
  avatars?: ReadonlyArray<LightboxAvatar>;
  /** Index courant dans `avatars`. Si avatars non fourni, ignoré. */
  currentIndex?: number;
  /** Avatar isolé (mode "preview unique"). Préfère `avatars`+`currentIndex`. */
  current?: LightboxAvatar | null;
  /** Naviguer dans la collection. */
  onNavigate?: (newIndex: number) => void;
  onClose: () => void;
  /** Si fourni, affiche le bouton "Supprimer" en bas. */
  onDelete?: () => void;
}

const SWIPE_THRESHOLD = 80;

/**
 * I4.1 + J4.1 — Lightbox d'aperçu d'avatar.
 *
 * Évolutions J4.1 :
 *   • Card 480 × 480 max (au lieu de 80vw × 80vh) → moins envahissant.
 *   • Navigation : boutons flèches gauche/droite + raccourcis ←/→.
 *   • Swipe horizontal (drag framer-motion) → précédent/suivant.
 *   • Swipe vers le bas → ferme.
 *   • Indicateur "N / total" en bas.
 *   • Boutons grisés aux extrémités (1ʳᵉ/dernière image).
 */
export function AvatarLightbox({
  open,
  avatars,
  currentIndex,
  current,
  onNavigate,
  onClose,
  onDelete,
}: AvatarLightboxProps) {
  const total = avatars?.length ?? 0;
  const idx = currentIndex ?? 0;
  const display: LightboxAvatar | null =
    avatars && currentIndex != null && currentIndex >= 0
      ? avatars[currentIndex] ?? null
      : current ?? null;

  const canPrev = avatars != null && idx > 0;
  const canNext = avatars != null && idx < total - 1;

  function goPrev() {
    if (canPrev && onNavigate) onNavigate(idx - 1);
  }
  function goNext() {
    if (canNext && onNavigate) onNavigate(idx + 1);
  }

  // J4.1 — Raccourcis clavier : ← / → / Échap.
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      else if (e.key === "ArrowLeft") goPrev();
      else if (e.key === "ArrowRight") goNext();
    }
    window.addEventListener("keydown", onKey);
    const prevOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = prevOverflow;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, onClose, idx, total]);

  function handleDragEnd(_e: unknown, info: PanInfo) {
    const { offset, velocity } = info;
    // Swipe vers le bas → ferme.
    if (offset.y > SWIPE_THRESHOLD || velocity.y > 600) {
      onClose();
      return;
    }
    // Swipe horizontal → navigation.
    if (Math.abs(offset.x) > SWIPE_THRESHOLD || Math.abs(velocity.x) > 500) {
      if (offset.x < 0) goNext();
      else goPrev();
    }
  }

  return (
    <AnimatePresence>
      {open && display && (
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
          {/* Bouton précédent — desktop seulement (mobile = swipe). */}
          {avatars && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                goPrev();
              }}
              disabled={!canPrev}
              aria-label="Avatar précédent"
              title="Précédent (←)"
              className={cn(
                "absolute left-2 top-1/2 z-10 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/40 text-white transition-all hover:bg-black/60 disabled:cursor-not-allowed disabled:opacity-30 sm:flex",
              )}
            >
              <ChevronLeft className="h-6 w-6" aria-hidden="true" />
            </button>
          )}

          <motion.div
            key={display.url}
            initial={{ scale: 0.92, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            exit={{ scale: 0.94, opacity: 0 }}
            transition={{ type: "spring", stiffness: 240, damping: 24 }}
            drag={avatars ? true : "y"}
            dragElastic={0.2}
            dragMomentum={false}
            onDragEnd={handleDragEnd}
            onClick={(e) => e.stopPropagation()}
            className="relative flex w-full max-w-[480px] flex-col items-center gap-3 rounded-2xl border border-border bg-card p-4 shadow-2xl"
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer"
              title="Fermer (Échap)"
              className="absolute right-2 top-2 z-10 inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background text-foreground/70 transition-colors hover:border-buzz/50 hover:text-buzz"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>

            <div className="relative flex h-[360px] w-full max-w-[420px] items-center justify-center">
              <Image
                src={display.url}
                alt="Avatar agrandi"
                fill
                sizes="(max-width: 640px) 90vw, 420px"
                className="rounded-xl object-contain"
                unoptimized
                priority
                draggable={false}
              />
            </div>

            {((display.tags?.length ?? 0) > 0 || display.uploadedAtIso) && (
              <div className="flex w-full flex-col gap-2 text-center text-xs text-foreground/70">
                {display.tags && display.tags.length > 0 && (
                  <div className="flex flex-wrap items-center justify-center gap-1.5">
                    {display.tags.map((t) => (
                      <span
                        key={t}
                        className="rounded-full bg-foreground/10 px-2 py-0.5 text-[11px] font-bold text-foreground/80"
                      >
                        {t}
                      </span>
                    ))}
                  </div>
                )}
                {display.uploadedAtIso && (
                  <p className="text-[11px] text-foreground/55">
                    Importé le{" "}
                    {new Intl.DateTimeFormat("fr-FR", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    }).format(new Date(display.uploadedAtIso))}
                  </p>
                )}
              </div>
            )}

            {avatars && total > 1 && (
              <p className="text-[11px] font-bold text-foreground/50">
                {idx + 1} / {total}
              </p>
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

          {avatars && (
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                goNext();
              }}
              disabled={!canNext}
              aria-label="Avatar suivant"
              title="Suivant (→)"
              className={cn(
                "absolute right-2 top-1/2 z-10 hidden h-12 w-12 -translate-y-1/2 items-center justify-center rounded-full border border-white/20 bg-black/40 text-white transition-all hover:bg-black/60 disabled:cursor-not-allowed disabled:opacity-30 sm:flex",
              )}
            >
              <ChevronRight className="h-6 w-6" aria-hidden="true" />
            </button>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
}
