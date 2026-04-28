"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, Search, X } from "lucide-react";
import {
  FAMILY_STYLES,
  type PeriodicElement,
  type PeriodicFamily,
} from "@/lib/periodic/types";
import { cn } from "@/lib/utils";

interface ElementsListPanelProps {
  elements: PeriodicElement[];
  /**
   * Famille active. Si posée, le panel filtre la liste à cette famille
   * (mais l'ouverture du panel reste pilotée uniquement par la languette).
   */
  activeFamily: PeriodicFamily | null;
  /** True = panel visible, false = collapse (languette seule visible). */
  open: boolean;
  /** Toggle ouvert ↔ fermé (cliqué sur la languette). */
  onToggle: () => void;
  /** Fermeture explicite (croix dans le header, Échap). */
  onClose: () => void;
  /** Au clic sur un élément, ouvre la modal de détail (parent gère). */
  onPickElement: (el: PeriodicElement) => void;
}

/**
 * J2.1 — Panel latéral droit avec languette d'ouverture persistante.
 *
 *   • La LANGUETTE (40 px de large, fixée au bord droit, mi-hauteur) est
 *     toujours visible, même panel fermé. Au clic → toggle.
 *   • Quand le panel est fermé, seule la languette dépasse à droite.
 *   • Quand ouvert, le panel slide depuis la droite (360-400 px) ; sur
 *     desktop il vient se poser à côté du tableau, sur écran moyen il
 *     overlay (z-index élevé). La languette reste sur le bord du panel.
 *   • Au clic sur une famille de la légende, on n'ouvre PAS le panel —
 *     juste le filtre de couleur du tableau. Si l'user est dans le panel,
 *     la liste se met à jour selon le filtre actif.
 *
 * J2.2 — Recherche améliorée : symbole, nom, OU numéro atomique
 * (input purement numérique → match strict sur `numero_atomique`).
 */
export function ElementsListPanel({
  elements,
  activeFamily,
  open,
  onToggle,
  onClose,
  onPickElement,
}: ElementsListPanelProps) {
  const [search, setSearch] = useState("");

  useEffect(() => {
    if (!open) setSearch("");
  }, [open]);

  // Échap pour fermer (uniquement si ouvert).
  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  const filtered = useMemo(() => {
    let list = activeFamily
      ? elements.filter((e) => e.famille === activeFamily)
      : elements.slice();
    const q = search.trim();
    if (q) {
      // J2.2 — Si tout-numérique → match strict sur numero_atomique.
      if (/^\d+$/.test(q)) {
        const num = parseInt(q, 10);
        list = list.filter((e) => e.numero_atomique === num);
      } else {
        const lower = q.toLowerCase();
        list = list.filter(
          (e) =>
            e.nom.toLowerCase().includes(lower) ||
            e.symbole.toLowerCase().includes(lower),
        );
      }
    }
    list.sort((a, b) => a.numero_atomique - b.numero_atomique);
    return list;
  }, [activeFamily, elements, search]);

  const headerLabel = activeFamily
    ? `${FAMILY_STYLES[activeFamily].label} · ${filtered.length} élément${
        filtered.length > 1 ? "s" : ""
      }`
    : `Tous les éléments · ${filtered.length}`;

  return (
    <>
      {/* J2.1 — LANGUETTE persistante. Fixe au bord droit, suit le panel
          quand il s'ouvre (translate sur le wrapper). Toujours cliquable. */}
      <button
        type="button"
        onClick={onToggle}
        aria-label={open ? "Masquer la liste des éléments" : "Afficher la liste des éléments"}
        title={open ? "Masquer la liste" : "Afficher la liste des éléments"}
        className={cn(
          "fixed top-1/2 z-40 flex h-24 w-9 -translate-y-1/2 flex-col items-center justify-center gap-1 rounded-l-xl border border-r-0 border-border bg-card text-foreground/70 shadow-md transition-all hover:bg-gold/10 hover:text-gold",
          // Position : sur le bord droit du viewport quand fermé,
          // décalé vers la gauche d'autant que la largeur du panel ouvert.
          open ? "right-[var(--panel-w,360px)]" : "right-0",
        )}
        style={
          {
            // Variable CSS pour que le decal du bouton suive la largeur
            // responsive du panel (sm = 360, lg = 400).
            "--panel-w":
              typeof window !== "undefined" && window.innerWidth >= 1024
                ? "400px"
                : "360px",
          } as React.CSSProperties
        }
      >
        {open ? (
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        ) : (
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        )}
        <span className="rotate-180 text-[9px] font-bold uppercase tracking-wider [writing-mode:vertical-rl]">
          Liste
        </span>
      </button>

      <AnimatePresence>
        {open && (
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 220, damping: 28 }}
            className="fixed inset-y-0 right-0 z-30 flex w-full flex-col border-l border-border bg-card shadow-2xl sm:w-[360px] lg:w-[400px]"
            role="dialog"
            aria-label="Liste des éléments"
          >
            <header className="flex items-center justify-between gap-2 border-b border-border px-4 py-3">
              <div className="flex flex-col">
                <p className="text-[10px] font-bold uppercase tracking-widest text-foreground/50">
                  Éléments
                </p>
                <h3 className="font-display text-base font-bold text-foreground">
                  {headerLabel}
                </h3>
              </div>
              <button
                type="button"
                onClick={onClose}
                title="Fermer"
                aria-label="Fermer le panel"
                className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-border bg-background text-foreground/70 transition-colors hover:border-buzz/50 hover:text-buzz"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </header>

            <div className="border-b border-border px-4 py-2">
              <label className="relative flex items-center">
                <Search
                  className="pointer-events-none absolute left-3 h-4 w-4 text-foreground/40"
                  aria-hidden="true"
                />
                <input
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Nom, symbole ou n° atomique"
                  className="w-full rounded-md border border-border bg-background py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-foreground/40 focus:border-gold/60 focus:outline-none focus:ring-2 focus:ring-gold/30"
                />
              </label>
            </div>

            <ul className="flex-1 overflow-y-auto">
              {filtered.length === 0 ? (
                <li className="px-4 py-6 text-center text-sm text-foreground/60">
                  Aucun élément ne correspond.
                </li>
              ) : (
                filtered.map((el) => {
                  const style = FAMILY_STYLES[el.famille];
                  return (
                    <li key={el.numero_atomique}>
                      <button
                        type="button"
                        onClick={() => onPickElement(el)}
                        className="flex w-full items-center gap-3 border-b border-border/40 px-4 py-2.5 text-left transition-colors hover:bg-gold/5"
                      >
                        <span
                          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-md font-display text-sm font-bold text-on-color"
                          style={{ backgroundColor: style?.bg ?? "#9ca3af" }}
                        >
                          {el.symbole}
                        </span>
                        <span className="flex flex-1 flex-col leading-tight">
                          <span className="font-display text-sm font-bold text-foreground">
                            {el.nom}
                          </span>
                          <span className="text-[11px] text-foreground/55">
                            n°{el.numero_atomique}
                            {typeof el.masse_atomique === "number" && (
                              <>
                                {" "}
                                — {el.masse_atomique.toFixed(3)} u
                              </>
                            )}
                          </span>
                        </span>
                      </button>
                    </li>
                  );
                })
              )}
            </ul>
          </motion.aside>
        )}
      </AnimatePresence>
    </>
  );
}
