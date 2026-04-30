"use client";

import { ALL_FAMILIES, FAMILY_STYLES, type PeriodicFamily } from "@/lib/periodic/types";
import { cn } from "@/lib/utils";

interface FamilyLegendProps {
  /** Famille active (filtrée) — visuel renforcé. Null = tout actif. */
  activeFamily?: PeriodicFamily | null;
  onPick?: (f: PeriodicFamily | null) => void;
}

/**
 * Légende des 10 familles d'éléments avec couleurs. Cliquable pour
 * filtrer le tableau (mode "apprendre" uniquement).
 */
export function FamilyLegend({ activeFamily, onPick }: FamilyLegendProps) {
  const interactive = !!onPick;
  return (
    <div className="flex flex-wrap items-center gap-2">
      {interactive && (
        <button
          type="button"
          onClick={() => onPick?.(null)}
          className={cn(
            "rounded-full border-2 px-3 py-1 text-xs font-bold transition-colors",
            activeFamily === null || activeFamily === undefined
              ? "border-foreground bg-foreground/10 text-foreground"
              : "border-border bg-card text-foreground/55 hover:border-foreground/40",
          )}
        >
          Toutes
        </button>
      )}
      {ALL_FAMILIES.map((f) => {
        const s = FAMILY_STYLES[f];
        const isActive = activeFamily === f;
        return (
          <button
            key={f}
            type="button"
            onClick={() => onPick?.(isActive ? null : f)}
            disabled={!interactive}
            className={cn(
              "inline-flex items-center gap-1.5 rounded-full border-2 px-2.5 py-1 text-[11px] font-bold text-on-color transition-all",
              interactive && "cursor-pointer hover:scale-[1.05]",
              !interactive && "cursor-default",
              isActive
                ? "border-foreground shadow-[0_0_12px_rgba(0,0,0,0.2)]"
                : "border-transparent",
            )}
            style={{ backgroundColor: s.bg }}
          >
            {s.label}
          </button>
        );
      })}
    </div>
  );
}
