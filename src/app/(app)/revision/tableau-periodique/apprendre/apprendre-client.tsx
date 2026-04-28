"use client";

import { useState } from "react";
import { ArrowLeft, BookOpen, List } from "lucide-react";
import Link from "next/link";
import { PeriodicGrid } from "../_components/PeriodicGrid";
import { FamilyLegend } from "../_components/FamilyLegend";
import { ElementDetailModal } from "../_components/ElementDetailModal";
import { ElementsListPanel } from "../_components/ElementsListPanel";
import type { PeriodicElement, PeriodicFamily } from "@/lib/periodic/types";

interface Props {
  elements: PeriodicElement[];
}

export function ApprendreClient({ elements }: Props) {
  const [filterFamily, setFilterFamily] = useState<PeriodicFamily | null>(null);
  const [selected, setSelected] = useState<PeriodicElement | null>(null);
  // I2.2 — Panel latéral droit (liste filtrée). S'ouvre auto au clic
  // sur une famille de la légende ; peut aussi être ouvert manuellement
  // via le bouton "Liste" pour voir tous les éléments triés.
  const [panelOpen, setPanelOpen] = useState(false);

  function handlePickFamily(f: PeriodicFamily | null) {
    setFilterFamily(f);
    // Ouverture auto quand on choisit une famille (même si re-clic
    // pour réactiver une famille déjà active). Si on désélectionne
    // (`null`), on ferme — sauf si l'user l'a ouvert manuellement.
    setPanelOpen(f !== null);
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 p-3 sm:p-6 lg:p-8">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Link
          href="/revision/tableau-periodique"
          className="inline-flex w-fit items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-semibold text-foreground/80 hover:border-gold/50 hover:bg-gold/10"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Retour
        </Link>
        <button
          type="button"
          onClick={() => setPanelOpen((v) => !v)}
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-sky/40 bg-sky/5 px-3 text-sm font-bold text-sky transition-colors hover:border-sky hover:bg-sky/10"
        >
          <List className="h-4 w-4" aria-hidden="true" />
          {panelOpen ? "Masquer la liste" : "Afficher la liste"}
        </button>
      </div>

      <header className="flex flex-col gap-2">
        <div className="inline-flex items-center gap-2 self-start rounded-full bg-sky/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-sky">
          <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
          Apprendre — Tableau complet
        </div>
        <h1 className="font-display text-2xl font-extrabold text-foreground sm:text-3xl">
          {elements.length} éléments à découvrir
        </h1>
        <p className="text-sm text-foreground/65">
          Clique sur une case pour voir les détails. Filtre par famille
          en cliquant sur la légende — la liste latérale s&apos;ouvrira
          automatiquement.
        </p>
      </header>

      <FamilyLegend activeFamily={filterFamily} onPick={handlePickFamily} />

      <PeriodicGrid
        elements={elements}
        mode="apprendre"
        onPick={setSelected}
        filterFamille={filterFamily}
      />

      <ElementDetailModal
        element={selected}
        allElements={elements}
        onNavigate={setSelected}
        onClose={() => setSelected(null)}
      />

      <ElementsListPanel
        elements={elements}
        activeFamily={filterFamily}
        open={panelOpen}
        onClose={() => setPanelOpen(false)}
        onPickElement={(el) => setSelected(el)}
      />
    </main>
  );
}
