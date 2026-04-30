"use client";

import { useEffect, useMemo, useState } from "react";
import { Atom, ChevronLeft, ChevronRight, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { getFamilyStyle, type PeriodicElement } from "@/lib/periodic/types";

interface ElementDetailModalProps {
  element: PeriodicElement | null;
  /**
   * G3.1 — Liste complète pour permettre la navigation ←/→ dans la
   * modal sans fermer/rouvrir. Optionnel : si non fourni, les
   * boutons précédent/suivant sont masqués.
   */
  allElements?: ReadonlyArray<PeriodicElement>;
  onClose: () => void;
  /** Callback quand on navigue vers un autre élément. */
  onNavigate?: (element: PeriodicElement) => void;
}

/**
 * Modal de détail d'un élément (mode Apprendre).
 */
export function ElementDetailModal({
  element,
  allElements,
  onClose,
  onNavigate,
}: ElementDetailModalProps) {
  // G3.1 — Direction de la dernière nav (-1 ou +1) pour animer le
  // slide depuis la gauche/droite via framer motion.
  const [navDir, setNavDir] = useState<1 | -1>(1);

  // Cherche les voisins (par numéro atomique croissant) pour griser
  // les boutons aux extrémités.
  const { prev, next } = useMemo(() => {
    if (!element || !allElements || allElements.length === 0) {
      return { prev: null, next: null };
    }
    const sorted = [...allElements].sort(
      (a, b) => a.numero_atomique - b.numero_atomique,
    );
    const idx = sorted.findIndex(
      (e) => e.numero_atomique === element.numero_atomique,
    );
    if (idx === -1) return { prev: null, next: null };
    return {
      prev: idx > 0 ? sorted[idx - 1] ?? null : null,
      next: idx < sorted.length - 1 ? sorted[idx + 1] ?? null : null,
    };
  }, [element, allElements]);

  function go(dir: 1 | -1) {
    const target = dir === -1 ? prev : next;
    if (!target || !onNavigate) return;
    setNavDir(dir);
    onNavigate(target);
  }

  useEffect(() => {
    if (!element) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
      // G3.1 — Navigation flèches dans la modal.
      if (e.key === "ArrowLeft" && prev) {
        e.preventDefault();
        go(-1);
      } else if (e.key === "ArrowRight" && next) {
        e.preventDefault();
        go(1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [element, onClose, prev, next]);

  return (
    <AnimatePresence>
      {element && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-foreground/60 p-4"
          onClick={onClose}
          role="dialog"
          aria-modal="true"
        >
          {/* G3.1 — Wrapper flex pour pouvoir placer les flèches en
              dehors de la card. La card garde max-w-md, les flèches
              sont des siblings (visibles uniquement si onNavigate). */}
          <div
            onClick={(e) => e.stopPropagation()}
            className="flex w-full max-w-2xl items-center justify-center gap-2 sm:gap-4"
          >
            {onNavigate && allElements && (
              <button
                type="button"
                onClick={() => go(-1)}
                disabled={!prev}
                aria-label={prev ? `Précédent : ${prev.nom}` : "Aucun précédent"}
                title={prev ? `← ${prev.nom}` : ""}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-lg transition-all hover:bg-foreground/10 hover:scale-110 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                <ChevronLeft className="h-6 w-6" aria-hidden="true" />
              </button>
            )}
          <motion.div
            initial={{ scale: 0.92, y: 12 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.92, y: 12 }}
            transition={{ type: "spring", stiffness: 280, damping: 24 }}
            className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
          >
            {/* G3.1 — Slide animée entre éléments quand on navigue
                avec ←/→. Le `key` sur AnimatePresence force un
                remount à chaque numero_atomique. */}
            <AnimatePresence mode="wait" custom={navDir}>
              <motion.div
                key={element.numero_atomique}
                custom={navDir}
                initial={{ opacity: 0, x: navDir * 40 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: navDir * -40 }}
                transition={{ duration: 0.18 }}
              >
                {/* Header coloré famille */}
                <div
                  className="relative flex items-center gap-4 p-6 text-on-color"
                  style={{
                    backgroundColor: getFamilyStyle(element.famille).bg,
                  }}
                >
                  <button
                    type="button"
                    onClick={onClose}
                    aria-label="Fermer"
                    className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-full bg-foreground/10 text-on-color hover:bg-foreground/20"
                  >
                    <X className="h-4 w-4" aria-hidden="true" />
                  </button>
                  <div className="flex flex-col">
                    <span className="text-xs font-bold uppercase tracking-widest opacity-70">
                      N° {element.numero_atomique}
                    </span>
                    <span className="font-display text-5xl font-extrabold leading-none">
                      {element.symbole}
                    </span>
                    <span className="mt-1 font-display text-xl font-extrabold">
                      {element.nom}
                    </span>
                    <span className="mt-1 text-xs font-bold uppercase tracking-wider opacity-80">
                      {getFamilyStyle(element.famille).label}
                    </span>
                  </div>
                </div>

                {/* Détails */}
                <div className="grid grid-cols-2 gap-3 p-5">
                  <DetailRow
                    label="Période"
                    value={element.periode.toString()}
                  />
                  <DetailRow
                    label="Groupe"
                    value={element.groupe?.toString() ?? "—"}
                  />
                  <DetailRow
                    label="Masse atomique"
                    value={
                      element.masse_atomique !== null
                        ? `${element.masse_atomique} u`
                        : "—"
                    }
                  />
                  <DetailRow
                    label="État"
                    value={element.etat_standard ?? "—"}
                    capitalize
                  />
                </div>

                {/* Petit paragraphe info généré */}
                <div className="border-t border-border bg-card px-5 py-4">
                  <div className="flex items-start gap-2">
                    <Atom
                      className="mt-0.5 h-4 w-4 shrink-0 text-foreground/55"
                      aria-hidden="true"
                    />
                    <p className="text-sm text-foreground/75">
                      {generateBlurb(element)}
                    </p>
                  </div>
                </div>
              </motion.div>
            </AnimatePresence>

          </motion.div>
            {onNavigate && allElements && (
              <button
                type="button"
                onClick={() => go(1)}
                disabled={!next}
                aria-label={next ? `Suivant : ${next.nom}` : "Aucun suivant"}
                title={next ? `${next.nom} →` : ""}
                className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full border border-border bg-card text-foreground shadow-lg transition-all hover:bg-foreground/10 hover:scale-110 disabled:opacity-30 disabled:cursor-not-allowed disabled:hover:scale-100"
              >
                <ChevronRight className="h-6 w-6" aria-hidden="true" />
              </button>
            )}
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function DetailRow({
  label,
  value,
  capitalize,
}: {
  label: string;
  value: string;
  capitalize?: boolean;
}) {
  return (
    <div className="rounded-md border border-border bg-background/40 p-2.5">
      <p className="text-[10px] font-bold uppercase tracking-wider text-foreground/55">
        {label}
      </p>
      <p
        className={
          capitalize
            ? "mt-0.5 font-display text-sm font-extrabold capitalize text-foreground"
            : "mt-0.5 font-display text-sm font-extrabold text-foreground"
        }
      >
        {value}
      </p>
    </div>
  );
}

/**
 * Génère un petit paragraphe d'info contextuel à partir des champs
 * connus, sans faire d'appel externe.
 */
function generateBlurb(e: PeriodicElement): string {
  const fam = getFamilyStyle(e.famille).label.toLowerCase();
  const periode = `de la période ${e.periode}`;
  const groupe = e.groupe ? `, groupe ${e.groupe}` : "";
  const etat = e.etat_standard
    ? `Il est ${e.etat_standard} dans les conditions standards.`
    : "";
  return `${e.nom} (${e.symbole}, n°${e.numero_atomique}) est un ${fam} ${periode}${groupe}. ${etat}`.trim();
}
