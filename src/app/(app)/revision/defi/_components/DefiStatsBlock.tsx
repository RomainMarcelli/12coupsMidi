"use client";

import { motion } from "framer-motion";
import { Calendar, Flame, Sparkles, Target, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";
import type { DailyStats } from "../actions";
// I1.1 (revisé) — Static imports pour limiter les passes de compile
// dev-mode (webpack n'aime pas les dynamic imports répétés). /defi est
// le seul consommateur de Recharts en révision → pas de gain prod
// significatif à passer en lazy.
import { EvolutionLineChart, RepartitionPieChart } from "./DefiCharts";

interface DefiStatsBlockProps {
  stats: DailyStats | null;
}

/**
 * Bloc de stats pour le Défi du jour.
 *
 * Si `stats` est null ou totalPlayed === 0 → état vide invitant à jouer.
 * Sinon affiche :
 *   - 4 stat blocks (total, streak actuel, meilleur streak, moyenne)
 *   - LineChart sur les 30 derniers jours joués
 *   - PieChart Parfaits/Réussis/Ratés (I3.2 — remplace l'ancienne heatmap)
 */
export function DefiStatsBlock({ stats }: DefiStatsBlockProps) {
  if (!stats || stats.totalPlayed === 0) {
    return (
      <section className="flex flex-col items-center justify-center gap-3 rounded-2xl border border-dashed border-border bg-card p-6 text-center glow-card">
        <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-gold/15 text-gold-warm">
          <Sparkles className="h-6 w-6" aria-hidden="true" />
        </div>
        <h3 className="font-display text-lg font-bold text-foreground">
          Pas encore de stats
        </h3>
        <p className="text-sm text-foreground/60">
          Joue ton premier défi pour voir tes stats apparaître ici.
        </p>
      </section>
    );
  }

  return (
    <section className="flex flex-col gap-4 rounded-2xl border border-border bg-card p-4 glow-card sm:p-5">
      <header>
        <h3 className="font-display text-base font-bold text-foreground sm:text-lg">
          Tes stats
        </h3>
        <p className="text-xs text-foreground/60">
          Basées sur tes 180 derniers défis joués.
        </p>
      </header>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        <StatBlock
          icon={Calendar}
          label="Joués"
          value={stats.totalPlayed.toString()}
          accent="navy"
        />
        <StatBlock
          icon={Flame}
          label="Streak"
          value={stats.currentStreak.toString()}
          accent="buzz"
        />
        <StatBlock
          icon={Trophy}
          label="Meilleur"
          value={stats.bestStreak.toString()}
          accent="gold"
        />
        <StatBlock
          icon={Target}
          label="Moyenne"
          value={`${stats.averagePercent}%`}
          accent="green"
        />
      </div>

      {/* LineChart 30 derniers jours */}
      {stats.last30.length >= 2 && (
        <div className="flex flex-col gap-2">
          <h4 className="font-display text-xs font-bold uppercase tracking-widest text-foreground/60">
            Score sur les 30 derniers jours
          </h4>
          <EvolutionLineChart data={stats.last30} />
        </div>
      )}

      {/* I3.2 — PieChart Parfaits / Réussis / Ratés (remplace la heatmap). */}
      <div className="flex flex-col gap-2">
        <h4 className="font-display text-xs font-bold uppercase tracking-widest text-foreground/60">
          Répartition des défis
        </h4>
        <RepartitionPieChart
          data={{
            perfectCount: stats.perfectCount,
            passedCount: stats.passedCount,
            failedCount: stats.failedCount,
          }}
        />
      </div>
    </section>
  );
}

function StatBlock({
  icon: Icon,
  label,
  value,
  accent,
}: {
  icon: typeof Trophy;
  label: string;
  value: string;
  accent: "navy" | "buzz" | "gold" | "green";
}) {
  const accentClass = {
    navy: "border-border bg-muted text-foreground",
    buzz: "border-buzz/30 bg-buzz/5 text-buzz",
    gold: "border-gold/30 bg-gold/5 text-gold-warm",
    green: "border-life-green/30 bg-life-green/5 text-life-green",
  }[accent];

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: "spring", stiffness: 200, damping: 18 }}
      className={cn(
        "flex items-center gap-2 rounded-xl border p-2.5",
        accentClass,
      )}
    >
      <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
      <div className="flex flex-col leading-tight">
        <span className="font-display text-lg font-extrabold">{value}</span>
        <span className="text-[10px] uppercase tracking-wider text-foreground/60">
          {label}
        </span>
      </div>
    </motion.div>
  );
}
