"use client";

import { useState } from "react";
import { ArrowLeft, BookOpen } from "lucide-react";
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
  // J2.1 — Panel latéral : ouverture/fermeture pilotée UNIQUEMENT par
  // la languette latérale (cliquer sur une famille filtre les couleurs
  // du tableau, mais ne touche pas à l'état du panel — c'est l'user
  // qui décide quand le panel apparaît). Default fermé.
  const [panelOpen, setPanelOpen] = useState(false);

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
          en cliquant sur la légende. Le panneau de droite (languette)
          ouvre la liste détaillée des éléments.
        </p>
      </header>

      <FamilyLegend activeFamily={filterFamily} onPick={setFilterFamily} />

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
        onToggle={() => setPanelOpen((v) => !v)}
        onClose={() => setPanelOpen(false)}
        onPickElement={(el) => setSelected(el)}
      />
    </main>
  );
}
