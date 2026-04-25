"use client";

import {
  Activity,
  BarChart3,
  Calendar,
  Crown,
  Flame,
  Sparkles,
  Star,
  Timer,
  TrendingUp,
  Trophy,
} from "lucide-react";
import {
  Bar,
  BarChart,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

const MODE_LABEL: Record<string, string> = {
  jeu1: "Coup d'Envoi",
  coup_par_coup: "Coup par Coup",
  etoile: "Étoile",
  face_a_face: "Coup Fatal",
  coup_maitre: "Coup de Maître",
  parcours: "Parcours",
  revision: "Révision",
  douze_coups: "12 Coups",
};

const MODE_COLORS = ["#F5C518", "#4DA3F0", "#51CF66", "#FF6B6B", "#A8B2D1", "#E89E00"];

export interface StatsData {
  pseudo: string;
  xp: number;
  niveau: number;
  accuracy: number;
  streak: number;
  bestStreak: number;
  totalQuestions: number;
  avgResponseSec: number;
  bestFaf: number;
  totalCagnotte: number;
  favCount: number;
  wrongCount: number;
  evolution: Array<{ date: string; score: number | null }>;
  perCategory: Array<{
    nom: string;
    couleur: string | null;
    total: number;
    correct: number;
    ratio: number;
  }>;
  perMode: Array<{ mode: string; count: number }>;
  activity: Array<{ date: string; questions: number }>;
  badges: Array<{
    code: string;
    nom: string;
    description: string | null;
    icone: string | null;
    obtainedAt: string;
  }>;
  maitre: {
    score: number;
    breakdown: {
      accuracy: number;
      coverage: number;
      consistency: number;
      facePerf: number;
    };
    estimatedDays: number | null;
    weakest: Array<{ nom: string; couleur: string | null; ratio: number }>;
  };
}

export function StatsClient({ data }: { data: StatsData }) {
  const xpInLevel = data.xp % 1000;
  const xpProgress = Math.min(100, Math.round((xpInLevel / 1000) * 100));

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <header>
        <p className="text-xs font-bold uppercase tracking-widest text-gold-warm">
          Stats
        </p>
        <h1 className="font-display text-3xl font-extrabold text-foreground">
          Ta progression, {data.pseudo}
        </h1>
        <p className="mt-1 text-sm text-foreground/70">
          Données sur les 30 derniers jours.
        </p>
      </header>

      {/* Carte Maître de Midi (la plus visible) */}
      <MaitreCard
        score={data.maitre.score}
        breakdown={data.maitre.breakdown}
        estimatedDays={data.maitre.estimatedDays}
        weakest={data.maitre.weakest}
      />

      {/* KPIs */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <KpiCard
          icon={Crown}
          label="Niveau"
          value={String(data.niveau)}
          accent="gold"
          desc={`${xpInLevel} / 1000 XP`}
          footer={
            <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-foreground/10">
              <div
                className="h-full bg-gold transition-all"
                style={{ width: `${xpProgress}%` }}
              />
            </div>
          }
        />
        <KpiCard
          icon={Activity}
          label="Précision"
          value={`${data.accuracy} %`}
          accent="life-green"
          desc={`${data.totalQuestions} questions jouées`}
        />
        <KpiCard
          icon={Flame}
          label="Série"
          value={`${data.streak} j`}
          accent="buzz"
          desc={`Record : ${data.bestStreak} jours`}
        />
        <KpiCard
          icon={Star}
          label="Favoris / À revoir"
          value={`${data.favCount} · ${data.wrongCount}`}
          accent="sky"
        />
        <KpiCard
          icon={Timer}
          label="Temps moyen"
          value={`${data.avgResponseSec.toFixed(1)} s`}
          accent="sky"
        />
        <KpiCard
          icon={Trophy}
          label="Meilleur Face-à-Face"
          value={data.bestFaf > 0 ? `${data.bestFaf} pts` : "—"}
          accent="gold"
        />
        <KpiCard
          icon={Sparkles}
          label="Cagnotte 12 Coups"
          value={`${data.totalCagnotte.toLocaleString("fr-FR")} €`}
          accent="gold"
        />
        <KpiCard
          icon={TrendingUp}
          label="Score Maître"
          value={`${Math.round(data.maitre.score)} %`}
          accent="life-green"
        />
      </div>

      {/* Évolution sur 30 jours */}
      <Section title="Évolution du score" desc="Score moyen par jour sur 30 jours.">
        <div className="h-56 w-full">
          <ResponsiveContainer width="100%" height="100%">
            <LineChart
              data={data.evolution.map((d) => ({
                date: d.date.slice(5),
                score: d.score ?? 0,
                hasData: d.score !== null,
              }))}
              margin={{ top: 10, right: 16, left: -16, bottom: 0 }}
            >
              <XAxis
                dataKey="date"
                tick={{ fill: "currentColor", fontSize: 11, opacity: 0.6 }}
                stroke="currentColor"
                strokeOpacity={0.2}
              />
              <YAxis
                tick={{ fill: "currentColor", fontSize: 11, opacity: 0.6 }}
                stroke="currentColor"
                strokeOpacity={0.2}
              />
              <Tooltip
                contentStyle={{
                  background: "var(--popover)",
                  border: "1px solid var(--border)",
                  borderRadius: 8,
                  color: "var(--popover-foreground)",
                  fontSize: 12,
                }}
                formatter={(value) => [
                  `${Math.round(Number(value) || 0)} pts`,
                  "Score",
                ]}
              />
              <Line
                type="monotone"
                dataKey="score"
                stroke="#F5C518"
                strokeWidth={2}
                dot={{ r: 3, fill: "#F5C518" }}
                connectNulls={false}
              />
            </LineChart>
          </ResponsiveContainer>
        </div>
      </Section>

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Réussite par catégorie */}
        <Section
          title="Réussite par catégorie"
          desc="% de bonnes réponses sur 30 jours."
        >
          {data.perCategory.length === 0 ? (
            <EmptyChart>Joue quelques questions pour voir tes catégories.</EmptyChart>
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart
                  layout="vertical"
                  data={data.perCategory.map((c) => ({
                    nom: c.nom,
                    pct: Math.round(c.ratio * 100),
                    couleur: c.couleur ?? "#F5C518",
                    total: c.total,
                  }))}
                  margin={{ top: 4, right: 24, left: 12, bottom: 0 }}
                >
                  <XAxis
                    type="number"
                    domain={[0, 100]}
                    tick={{ fill: "currentColor", fontSize: 11, opacity: 0.6 }}
                    stroke="currentColor"
                    strokeOpacity={0.2}
                  />
                  <YAxis
                    type="category"
                    dataKey="nom"
                    width={90}
                    tick={{ fill: "currentColor", fontSize: 11 }}
                    stroke="currentColor"
                    strokeOpacity={0.2}
                  />
                  <Tooltip
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      color: "var(--popover-foreground)",
                      fontSize: 12,
                    }}
                    formatter={(_v, _n, p) => {
                      const payload = (p as { payload?: { pct: number; total: number } }).payload;
                      return [
                        `${payload?.pct ?? 0} % (${payload?.total ?? 0} questions)`,
                        "Réussite",
                      ];
                    }}
                  />
                  <Bar dataKey="pct" radius={[0, 6, 6, 0]}>
                    {data.perCategory.map((c) => (
                      <Cell
                        key={c.nom}
                        fill={c.couleur ?? "#F5C518"}
                      />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
        </Section>

        {/* Modes joués */}
        <Section title="Modes joués" desc="Répartition des parties.">
          {data.perMode.length === 0 ? (
            <EmptyChart>Aucune partie pour l&apos;instant.</EmptyChart>
          ) : (
            <div className="h-72 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie
                    data={data.perMode.map((m) => ({
                      name: MODE_LABEL[m.mode] ?? m.mode,
                      value: m.count,
                    }))}
                    dataKey="value"
                    nameKey="name"
                    innerRadius={50}
                    outerRadius={90}
                    paddingAngle={2}
                  >
                    {data.perMode.map((_, idx) => (
                      <Cell
                        key={idx}
                        fill={MODE_COLORS[idx % MODE_COLORS.length]}
                      />
                    ))}
                  </Pie>
                  <Tooltip
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: 8,
                      color: "var(--popover-foreground)",
                      fontSize: 12,
                    }}
                  />
                </PieChart>
              </ResponsiveContainer>
            </div>
          )}
        </Section>
      </div>

      {/* Heatmap d'activité */}
      <Section
        title="Activité (30 derniers jours)"
        desc="Plus la case est dorée, plus tu as joué de questions."
      >
        <ActivityHeatmap days={data.activity} />
      </Section>

      {/* Badges */}
      <Section title="Badges">
        {data.badges.length === 0 ? (
          <p className="text-sm text-foreground/60">
            Aucun badge encore. Joue régulièrement pour en débloquer.
          </p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
            {data.badges.map((b) => (
              <li
                key={b.code}
                className="flex items-center gap-3 rounded-xl border border-border bg-background/40 p-3"
              >
                <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gold/15 text-2xl text-gold-warm">
                  {b.icone ?? <Trophy className="h-6 w-6" aria-hidden="true" />}
                </div>
                <div className="flex-1">
                  <p className="font-display text-sm font-bold text-foreground">
                    {b.nom}
                  </p>
                  {b.description && (
                    <p className="text-xs text-foreground/60">
                      {b.description}
                    </p>
                  )}
                </div>
                <span className="text-xs text-foreground/40">
                  {new Date(b.obtainedAt).toLocaleDateString("fr-FR")}
                </span>
              </li>
            ))}
          </ul>
        )}
      </Section>
    </main>
  );
}

// ===========================================================================
// Carte "Maître de Midi"
// ===========================================================================

function MaitreCard({
  score,
  breakdown,
  estimatedDays,
  weakest,
}: {
  score: number;
  breakdown: {
    accuracy: number;
    coverage: number;
    consistency: number;
    facePerf: number;
  };
  estimatedDays: number | null;
  weakest: Array<{ nom: string; couleur: string | null; ratio: number }>;
}) {
  const pct = Math.round(score);
  return (
    <motion.section
      initial={{ opacity: 0, y: -10 }}
      animate={{ opacity: 1, y: 0 }}
      className="relative overflow-hidden rounded-3xl border border-gold/40 bg-gradient-to-br from-gold-pale via-cream to-sky-pale p-6 glow-sun sm:p-8"
    >
      <div className="absolute -right-12 -top-12 h-56 w-56 rounded-full bg-gold/30 blur-3xl" />
      <div className="absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-sky/15 blur-3xl" />
      <div className="relative flex flex-col gap-5 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-gold-warm">
            <Trophy
              className="inline h-3 w-3 align-text-bottom"
              aria-hidden="true"
              fill="currentColor"
            />{" "}
            Tableau de bord Maître de Midi
          </p>
          <p className="mt-2 font-display text-6xl font-extrabold leading-none text-navy sm:text-7xl">
            {pct}
            <span className="text-3xl font-bold text-gold-warm">%</span>
          </p>
          <p className="mt-2 max-w-md text-sm text-navy/75">
            {pct >= 90
              ? "Tu es à un cheveu du titre. Continue !"
              : pct >= 60
                ? "Tu es sur la bonne voie. Persévère !"
                : pct >= 30
                  ? "Encore un peu de travail. Joue chaque jour."
                  : "Lance-toi : chaque partie compte."}
          </p>

          <div className="mt-4 flex flex-wrap gap-3 text-xs">
            <Pill
              label="Date estimée"
              value={
                estimatedDays === null
                  ? "Continue à t'entraîner"
                  : estimatedDays === 0
                    ? "Atteint !"
                    : estimatedDays >= 365
                      ? "Plus d'un an"
                      : `Dans ~${estimatedDays} j`
              }
            />
            {weakest.length > 0 && (
              <Pill
                label="Catégories à renforcer"
                value={weakest.map((w) => w.nom).join(", ")}
              />
            )}
          </div>
        </div>

        <div className="flex w-full max-w-xs flex-col gap-2 rounded-2xl border border-gold/30 bg-white/60 p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-navy/60">
            Détail
          </p>
          <Bar2
            label="Précision"
            value={Math.round(breakdown.accuracy)}
            color="#51CF66"
          />
          <Bar2
            label="Couverture"
            value={Math.round(breakdown.coverage)}
            color="#F5C518"
          />
          <Bar2
            label="Consistance"
            value={Math.round(breakdown.consistency)}
            color="#4DA3F0"
          />
          <Bar2
            label="Face-à-Face"
            value={Math.round(breakdown.facePerf)}
            color="#FF6B6B"
          />
        </div>
      </div>
    </motion.section>
  );
}

function Pill({ label, value }: { label: string; value: string }) {
  return (
    <span className="inline-flex items-center gap-1.5 rounded-full border border-navy/15 bg-white/70 px-3 py-1 text-navy">
      <span className="text-navy/50">{label} :</span>
      <strong>{value}</strong>
    </span>
  );
}

function Bar2({
  label,
  value,
  color,
}: {
  label: string;
  value: number;
  color: string;
}) {
  return (
    <div>
      <div className="flex items-center justify-between text-xs">
        <span className="text-navy/70">{label}</span>
        <span className="font-bold text-navy tabular-nums">{value} %</span>
      </div>
      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-navy/10">
        <div
          className="h-full transition-all"
          style={{ width: `${value}%`, backgroundColor: color }}
        />
      </div>
    </div>
  );
}

// ===========================================================================
// KPI card + Section + Heatmap
// ===========================================================================

function KpiCard({
  icon: Icon,
  label,
  value,
  desc,
  footer,
  accent,
}: {
  icon: typeof BarChart3;
  label: string;
  value: string;
  desc?: string;
  footer?: React.ReactNode;
  accent: "gold" | "sky" | "buzz" | "life-green";
}) {
  const accentClass = {
    gold: "bg-gold/15 text-gold-warm",
    sky: "bg-sky/15 text-sky",
    buzz: "bg-buzz/15 text-buzz",
    "life-green": "bg-life-green/15 text-life-green",
  }[accent];

  return (
    <div className="flex flex-col gap-2 rounded-2xl border border-border bg-card p-4 glow-card">
      <div className="flex items-center gap-2">
        <div
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-lg",
            accentClass,
          )}
        >
          <Icon className="h-5 w-5" aria-hidden="true" />
        </div>
        <span className="text-xs font-bold uppercase tracking-widest text-foreground/60">
          {label}
        </span>
      </div>
      <p className="font-display text-2xl font-extrabold text-foreground sm:text-3xl">
        {value}
      </p>
      {desc && <p className="text-xs text-foreground/60">{desc}</p>}
      {footer}
    </div>
  );
}

function Section({
  title,
  desc,
  children,
}: {
  title: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 glow-card">
      <div>
        <h2 className="font-display text-lg font-bold text-foreground">
          {title}
        </h2>
        {desc && <p className="text-xs text-foreground/60">{desc}</p>}
      </div>
      {children}
    </section>
  );
}

function EmptyChart({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-32 items-center justify-center text-sm text-foreground/50">
      {children}
    </div>
  );
}

function ActivityHeatmap({
  days,
}: {
  days: Array<{ date: string; questions: number }>;
}) {
  const max = Math.max(1, ...days.map((d) => d.questions));
  // Affichage en grille 6×5 (30 cases)
  return (
    <div className="grid grid-cols-10 gap-1.5 sm:grid-cols-15">
      {days.map((d) => {
        const ratio = d.questions / max;
        const opacity = ratio === 0 ? 0.06 : 0.15 + ratio * 0.85;
        const dt = new Date(d.date);
        return (
          <div
            key={d.date}
            title={`${dt.toLocaleDateString("fr-FR")} — ${d.questions} questions`}
            className="aspect-square rounded-md border border-border"
            style={{
              backgroundColor: `rgba(245, 197, 24, ${opacity})`,
            }}
          />
        );
      })}
    </div>
  );
}
