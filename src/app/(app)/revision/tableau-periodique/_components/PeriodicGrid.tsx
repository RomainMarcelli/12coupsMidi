"use client";

import { motion } from "framer-motion";
import { getFamilyStyle, type PeriodicElement } from "@/lib/periodic/types";
import { cn } from "@/lib/utils";

interface PeriodicGridProps {
  elements: ReadonlyArray<PeriodicElement>;
  /**
   * Mode "apprendre" : toutes les cases sont remplies + clickable.
   * Mode "quizz" : seules les cases dans `revealed` sont remplies, les
   * autres sont vides (juste le numéro atomique en gris).
   */
  mode: "apprendre" | "quizz";
  revealed?: ReadonlySet<number>;
  /** Clic sur une case (mode "apprendre" uniquement). */
  onPick?: (e: PeriodicElement) => void;
  /** Filtre famille — les cases hors filtre sont grisées (mode apprendre). */
  filterFamille?: string | null;
  /**
   * Marquage spécial des cases "abandonnées" : on les affiche en gris
   * mais avec le bon nom (révèle après "Donner ma langue au chat").
   */
  abandoned?: ReadonlySet<number>;
  /** Élément récemment trouvé (pour animation glow). */
  justFound?: number | null;
}

/**
 * Grille du tableau périodique 18 colonnes × 9 lignes (lanthanides en
 * row 8, actinides en row 9).
 */
export function PeriodicGrid({
  elements,
  mode,
  revealed,
  onPick,
  filterFamille,
  abandoned,
  justFound,
}: PeriodicGridProps) {
  // Index par (row, col) pour tirage rapide
  const byPos = new Map<string, PeriodicElement>();
  for (const e of elements) byPos.set(`${e.grid_row}-${e.grid_col}`, e);

  // G3.3 — Pour la cascade d'animation post-abandon, on calcule
  // l'ordre dans lequel les éléments abandonnés se révèlent (par
  // numero_atomique croissant). Chaque élément a un index → délai.
  const abandonedOrder = new Map<number, number>();
  if (abandoned && abandoned.size > 0) {
    const sorted = [...abandoned].sort((a, b) => a - b);
    sorted.forEach((num, idx) => abandonedOrder.set(num, idx));
  }

  // G2.1 — 10 lignes maintenant : period 1-7 (rows 1-7), ununennium
  // seul (row 8 col 1), lanthanides (row 9), actinides (row 10).
  const ROWS = 10;
  const COLS = 18;

  return (
    <div className="w-full overflow-x-auto">
      <div
        className="grid w-full min-w-[760px] gap-1"
        style={{
          gridTemplateColumns: `repeat(${COLS}, minmax(0, 1fr))`,
        }}
      >
        {Array.from({ length: ROWS * COLS }).map((_, idx) => {
          const row = Math.floor(idx / COLS) + 1;
          const col = (idx % COLS) + 1;
          const el = byPos.get(`${row}-${col}`);
          const posKey = `pos-${idx}`;

          // Cellule vide (no element à cette position)
          if (!el) {
            // Indicateur "Lanthanides" / "Actinides" dans la grille principale
            // pour les rows 6 col 3 et row 7 col 3 (placeholders qui
            // pointent vers les blocs détachés rows 9/10).
            if (row === 6 && col === 3) {
              return (
                <PlaceholderCell key={posKey} label="57-71" tone="lanthanide" />
              );
            }
            if (row === 7 && col === 3) {
              return (
                <PlaceholderCell key={posKey} label="89-103" tone="actinide" />
              );
            }
            // Espace vide
            return <div key={posKey} aria-hidden="true" />;
          }

          const isAbandoned = abandoned?.has(el.numero_atomique) ?? false;
          // G3.3 — En mode quizz, un élément abandonné est aussi
          // "révélé" (on affiche son contenu, en gris, avec
          // animation cascade depuis l'abandon).
          const isRevealed =
            mode === "apprendre" ||
            (revealed?.has(el.numero_atomique) ?? false) ||
            isAbandoned;
          const isFiltered =
            filterFamille && el.famille !== filterFamille ? true : false;
          const isJustFound = justFound === el.numero_atomique;
          const abandonedIndex = abandonedOrder.get(el.numero_atomique);

          return (
            <ElementCell
              key={el.numero_atomique}
              element={el}
              revealed={isRevealed}
              abandoned={isAbandoned}
              dimmed={isFiltered}
              justFound={isJustFound}
              abandonedIndex={abandonedIndex}
              onClick={
                mode === "apprendre" && onPick ? () => onPick(el) : undefined
              }
            />
          );
        })}
      </div>
    </div>
  );
}

function ElementCell({
  element,
  revealed,
  abandoned,
  dimmed,
  justFound,
  abandonedIndex,
  onClick,
}: {
  element: PeriodicElement;
  revealed: boolean;
  abandoned: boolean;
  dimmed: boolean;
  justFound: boolean;
  /** G3.3 — index dans la cascade d'animation post-abandon (50 ms × idx). */
  abandonedIndex?: number;
  onClick?: () => void;
}) {
  const style = getFamilyStyle(element.famille);
  const interactive = !!onClick;
  const cascadeDelay =
    abandoned && abandonedIndex !== undefined ? abandonedIndex * 0.05 : 0;

  return (
    <motion.button
      type="button"
      onClick={onClick}
      disabled={!interactive}
      // G3.3 — Cascade reveal pour les abandonnés (fade-in + scale).
      // Pour les justFound (trouvés), conserve le flip card.
      initial={
        abandoned && abandonedIndex !== undefined
          ? { opacity: 0, scale: 0.8 }
          : undefined
      }
      animate={
        justFound
          ? { scale: [1, 1.15, 1], rotateY: [0, 180, 360] }
          : abandoned && abandonedIndex !== undefined
            ? { opacity: 0.6, scale: 1 }
            : undefined
      }
      transition={
        justFound
          ? { duration: 0.6 }
          : abandoned
            ? { delay: cascadeDelay, duration: 0.3 }
            : { duration: 0.2 }
      }
      className={cn(
        "relative aspect-square overflow-hidden rounded-md border text-left transition-all",
        revealed
          ? "border-foreground/15"
          : "border-foreground/10 bg-foreground/5",
        // L'opacity 60 est gérée par framer animate pour les abandonnés.
        abandoned && abandonedIndex === undefined && "opacity-60",
        dimmed && "opacity-25",
        interactive &&
          revealed &&
          "cursor-pointer hover:scale-110 hover:z-10 hover:shadow-lg",
        !interactive && "cursor-default",
      )}
      style={{
        // G3.3 — Les abandonnés gardent la couleur famille (avec
        // opacity-60 via framer) pour pouvoir lire le contexte
        // visuel de ce qu'on a manqué.
        backgroundColor: revealed ? style.bg : undefined,
        gridRow: element.grid_row,
        gridColumn: element.grid_col,
      }}
      data-element-num={element.numero_atomique}
      title={revealed ? `${element.nom} (${element.symbole})` : ""}
    >
      <div className="flex h-full flex-col p-0.5 text-on-color">
        <span className="text-[8px] leading-none opacity-70 sm:text-[9px]">
          {element.numero_atomique}
        </span>
        {revealed ? (
          <>
            <span className="mt-0.5 font-display text-xs font-extrabold leading-none sm:text-sm">
              {element.symbole}
            </span>
            <span className="mt-auto truncate text-[7px] leading-tight opacity-80 sm:text-[8px]">
              {element.nom}
            </span>
          </>
        ) : (
          <span className="m-auto text-[10px] text-foreground/30">?</span>
        )}
      </div>
    </motion.button>
  );
}

function PlaceholderCell({
  label,
  tone,
}: {
  label: string;
  tone: "lanthanide" | "actinide";
}) {
  const bg = tone === "lanthanide" ? "#FFADAD" : "#FFD6E0";
  return (
    <div
      className="flex aspect-square items-center justify-center rounded-md border border-dashed border-foreground/20 text-[8px] font-bold text-on-color sm:text-[10px]"
      style={{ backgroundColor: bg }}
      aria-hidden="true"
    >
      {label}
    </div>
  );
}
