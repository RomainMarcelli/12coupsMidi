"use client";

import { useEffect, useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Search, X } from "lucide-react";
import {
  FAMILY_STYLES,
  type PeriodicElement,
  type PeriodicFamily,
} from "@/lib/periodic/types";
import { cn } from "@/lib/utils";

interface ElementsListPanelProps {
  elements: PeriodicElement[];
  /**
   * Famille active. `null` = panel ouvert avec tous les éléments
   * triés par numéro atomique (= état "ouvert sans filtre").
   * Si pas de famille ET pas ouvert manuellement → panel masqué.
   */
  activeFamily: PeriodicFamily | null;
  /** Permet de fermer le panel (croix ou clic en dehors). */
  onClose: () => void;
  /** Au clic sur un élément, ouvre la modal de détail (parent gère). */
  onPickElement: (el: PeriodicElement) => void;
  /** Si true, le panel est rendu (même sans famille active). */
  open: boolean;
}

/**
 * I2.2 — Panel latéral droit listant les éléments du tableau périodique.
 *
 *   • Desktop : fixé à droite, hauteur écran, 360 px de large, slide-in.
 *   • Mobile  : bottom sheet plein écran (animation depuis le bas).
 *
 * Filtres :
 *   • Si `activeFamily` est posée → on affiche uniquement les éléments
 *     de cette famille.
 *   • Sinon → tous les éléments triés par numéro atomique.
 *   • Champ search permet de filtrer par nom ou symbole (case/accent
 *     insensitive) — combiné au filtre famille s'il est posé.
 */
export function ElementsListPanel({
  elements,
  activeFamily,
  onClose,
  onPickElement,
  open,
}: ElementsListPanelProps) {
  const [search, setSearch] = useState("");

  // Reset le champ search quand le panel se ferme/rouvre.
  useEffect(() => {
    if (!open) setSearch("");
  }, [open]);

  // Échap pour fermer.
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
    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (e) =>
          e.nom.toLowerCase().includes(q) ||
          e.symbole.toLowerCase().includes(q),
      );
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
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop : clic = fermer. Mobile only (sm:hidden) — sur
              desktop on laisse le contenu visible derrière. */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="fixed inset-0 z-40 bg-black/40 backdrop-blur-sm sm:hidden"
            aria-hidden="true"
          />
          <motion.aside
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "spring", stiffness: 220, damping: 28 }}
            className={cn(
              "fixed inset-y-0 right-0 z-50 flex w-full flex-col border-l border-border bg-card shadow-2xl",
              // Desktop : largeur fixe.
              "sm:w-[360px] lg:w-[400px]",
            )}
            role="dialog"
            aria-label="Liste des éléments"
          >
            {/* Header */}
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

            {/* Search */}
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
                  placeholder="Rechercher (nom ou symbole)…"
                  className="w-full rounded-md border border-border bg-background py-2 pl-9 pr-3 text-sm text-foreground placeholder:text-foreground/40 focus:border-gold/60 focus:outline-none focus:ring-2 focus:ring-gold/30"
                />
              </label>
            </div>

            {/* List */}
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
        </>
      )}
    </AnimatePresence>
  );
}
