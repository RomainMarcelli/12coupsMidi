"use client";

import { useEffect, useState, useTransition } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight, Loader2, Lock } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSetting, useSettingsStore } from "@/lib/settings";
import { fetchMonthChallenges } from "../actions";
import { saveUserSettings } from "@/app/(app)/parametres/actions";
import {
  buildMonthGrid,
  localIso,
  monthLabel,
  nextMonth,
  prevMonth,
} from "./calendar-helpers";

interface DefiCalendarProps {
  /** Callback : l'utilisateur a cliqué sur un jour cliquable. */
  onPickDate: (isoDate: string) => void;
  /**
   * I3.1 — Date de création du compte (YYYY-MM-DD). Les jours
   * antérieurs ne seront jamais marqués en rouge.
   */
  accountCreatedAtIso: string | null;
}

type DayMap = Record<
  string,
  { played: boolean; percent?: number; hasChallenge: boolean }
>;

const WEEKDAYS = ["L", "M", "M", "J", "V", "S", "D"] as const;

/**
 * Calendrier mensuel interactif pour le Défi du jour.
 *
 * - Header : nom du mois en FR + flèches précédent/suivant.
 * - Grille 7 colonnes (lun→dim).
 * - Coloration :
 *     vert (intensité ∝ score) si joué
 *     gris si défi disponible mais non joué
 *     opacity-30 si futur ou hors mois
 * - Clic → `onPickDate(iso)`. Bloqué pour : futur, jours non disponibles.
 */
export function DefiCalendar({
  onPickDate,
  accountCreatedAtIso,
}: DefiCalendarProps) {
  const today = localIso(new Date());
  const todayDate = new Date();
  const [year, setYear] = useState(todayDate.getFullYear());
  const [month, setMonth] = useState(todayDate.getMonth() + 1);
  const [days, setDays] = useState<DayMap>({});
  const [isPending, startTransition] = useTransition();
  // I3.1 — Toggle "Afficher les jours manqués en rouge" (default true).
  const showMissedDays = useSetting("defiShowMissedDays");
  const updateSettings = useSettingsStore((s) => s.update);

  useEffect(() => {
    startTransition(async () => {
      const res = await fetchMonthChallenges({ year, month });
      if (res.status === "ok") setDays(res.days);
      else setDays({});
    });
  }, [year, month]);

  const grid = buildMonthGrid(year, month, today);

  function handlePrev() {
    const p = prevMonth(year, month);
    setYear(p.year);
    setMonth(p.month);
  }
  function handleNext() {
    const n = nextMonth(year, month);
    setYear(n.year);
    setMonth(n.month);
  }

  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-4 glow-card sm:p-5">
      <header className="flex items-center justify-between">
        <button
          type="button"
          onClick={handlePrev}
          aria-label="Mois précédent"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card text-foreground/70 hover:border-gold/50 hover:bg-gold/10"
        >
          <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        </button>
        <h3 className="font-display text-base font-bold capitalize text-foreground sm:text-lg">
          {monthLabel(year, month)}
          {isPending && (
            <Loader2
              className="ml-2 inline h-3.5 w-3.5 animate-spin text-foreground/40"
              aria-hidden="true"
            />
          )}
        </h3>
        <button
          type="button"
          onClick={handleNext}
          aria-label="Mois suivant"
          className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card text-foreground/70 hover:border-gold/50 hover:bg-gold/10"
        >
          <ChevronRight className="h-4 w-4" aria-hidden="true" />
        </button>
      </header>

      <div className="grid grid-cols-7 gap-1 text-center text-[10px] font-bold uppercase tracking-wider text-foreground/40">
        {WEEKDAYS.map((d, i) => (
          <span key={i}>{d}</span>
        ))}
      </div>

      <div className="grid grid-cols-7 gap-1">
        {grid.map((cell, i) => {
          const meta = days[cell.iso];
          const played = meta?.played === true;
          const hasChallenge = meta?.hasChallenge === true;
          const percent = meta?.percent;

          // Disabled si : futur, hors mois affiché, ou pas de défi (passé non couvert).
          const disabled =
            cell.isFuture || !cell.inMonth || (!hasChallenge && !played);

          // I3.1 — Un jour est "manqué" si :
          //   - dans le mois affiché ET passé (pas aujourd'hui, pas futur)
          //   - ≥ date de création du compte (pas de rouge avant l'inscription)
          //   - défi disponible CE jour-là (hasChallenge)
          //   - non joué
          //   - toggle settings actif
          const isMissed =
            !played &&
            hasChallenge &&
            cell.inMonth &&
            !cell.isFuture &&
            !cell.isToday &&
            showMissedDays &&
            (accountCreatedAtIso === null || cell.iso >= accountCreatedAtIso);

          // Coloration. Pour `played` on intensifie le vert selon le pourcentage.
          let bgClass = "bg-foreground/5 text-foreground/40";
          if (played && typeof percent === "number") {
            if (percent >= 80)
              bgClass = "bg-life-green text-on-color shadow-sm";
            else if (percent >= 60)
              bgClass = "bg-life-green/70 text-on-color";
            else if (percent >= 40)
              bgClass = "bg-life-green/45 text-foreground";
            else bgClass = "bg-life-green/25 text-foreground";
          } else if (isMissed) {
            // I3.1 — Jour passé non joué : rouge clair pour signaler à
            // l'utilisateur qu'il a "manqué" ce jour-là, mais cliquable
            // pour rattraper.
            bgClass = "bg-buzz/20 text-buzz hover:bg-buzz/30";
          } else if (hasChallenge && cell.inMonth && !cell.isFuture) {
            bgClass = "bg-foreground/10 text-foreground/70 hover:bg-gold/20";
          }

          if (cell.isFuture || !cell.inMonth) {
            bgClass = cn(bgClass, "opacity-30");
          }

          // I3.3 — Tooltip natif au survol : date FR + score si joué.
          const dayLabelFr = formatDayFr(cell.iso);
          const tooltip = played
            ? `${dayLabelFr} — ${percent}% (clic pour voir tes réponses)`
            : isMissed
              ? `${dayLabelFr} — manqué (clic pour rattraper)`
              : hasChallenge && cell.inMonth && !cell.isFuture
                ? `${dayLabelFr} — non joué (clic pour jouer)`
                : cell.isFuture
                  ? `${dayLabelFr} — défi à venir`
                  : dayLabelFr;
          return (
            <motion.button
              key={`${cell.iso}-${i}`}
              type="button"
              disabled={disabled}
              onClick={() => !disabled && onPickDate(cell.iso)}
              whileHover={!disabled ? { scale: 1.08 } : undefined}
              whileTap={!disabled ? { scale: 0.94 } : undefined}
              title={tooltip}
              className={cn(
                "relative flex aspect-square items-center justify-center rounded-md text-xs font-bold transition-colors",
                bgClass,
                cell.isToday && "ring-2 ring-gold ring-offset-1 ring-offset-card",
                disabled
                  ? "cursor-not-allowed"
                  : "cursor-pointer",
              )}
              aria-label={tooltip}
            >
              <span>{cell.day}</span>
              {cell.isFuture && cell.inMonth && (
                <Lock
                  className="absolute right-0.5 top-0.5 h-2.5 w-2.5 text-foreground/40"
                  aria-hidden="true"
                />
              )}
            </motion.button>
          );
        })}
      </div>

      {/* Légende */}
      <div className="flex flex-wrap items-center justify-center gap-3 pt-1 text-[10px] font-bold uppercase tracking-wider text-foreground/50">
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-life-green" /> ≥ 80 %
        </span>
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-life-green/45" /> 40-79 %
        </span>
        {showMissedDays && (
          <span className="inline-flex items-center gap-1">
            <span className="h-2.5 w-2.5 rounded-sm bg-buzz/20" /> Manqué
          </span>
        )}
        <span className="inline-flex items-center gap-1">
          <span className="h-2.5 w-2.5 rounded-sm bg-foreground/10" /> Non joué
        </span>
      </div>

      {/* I3.1 — Toggle "Afficher les jours manqués en rouge". */}
      <label className="flex cursor-pointer items-center justify-center gap-2 pt-1 text-[11px] text-foreground/60 hover:text-foreground/80">
        <input
          type="checkbox"
          checked={showMissedDays}
          onChange={(e) => {
            const next = e.target.checked;
            updateSettings({ defiShowMissedDays: next });
            // Best-effort sync BDD ; pas de gestion d'erreur visible
            // (le store local reste optimiste, une 2ᵉ tentative se
            // fera au prochain changement de réglage).
            void saveUserSettings({ defiShowMissedDays: next });
          }}
          className="h-3.5 w-3.5 cursor-pointer rounded border-border accent-gold"
        />
        <span>Afficher les jours manqués en rouge</span>
      </label>
    </section>
  );
}

/**
 * I3.3 — Formatage français lisible pour les tooltips ("lundi 27 avril").
 * Volontairement sans année (le calendrier affiche déjà le mois et
 * l'année dans son header).
 */
function formatDayFr(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
  }).format(d);
}
