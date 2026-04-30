"use client";

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

/**
 * I1.1 — Bloc charts isolé pour /stats.
 *
 * Recharts 3.x logge un warning "width(-1) and height(-1)" pendant la
 * 1ʳᵉ frame avant que son ResizeObserver interne ne mesure le parent.
 * On suppresse via `minWidth={1}` — c'est exactement la condition que
 * Recharts vérifie : si minWidth > 0, pas de warning.
 *  (le `1` ne clippe rien : c'est juste un floor, le chart prend la
 *   vraie taille du parent dès que c'est mesuré).
 */

const MODE_COLORS = ["#F5C518", "#4DA3F0", "#51CF66", "#FF6B6B", "#A8B2D1", "#E89E00"];

interface EvolutionPoint {
  date: string;
  score: number | null;
}

export function EvolutionChart({ data }: { data: EvolutionPoint[] }) {
  return (
    <div className="h-56 w-full">
      <ResponsiveContainer width="100%" height="100%" minWidth={1}>
        <LineChart
          data={data.map((d) => ({
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
  );
}

interface CategoryPoint {
  nom: string;
  ratio: number;
  couleur: string | null;
  total: number;
}

export function PerCategoryChart({ data }: { data: CategoryPoint[] }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%" minWidth={1}>
        <BarChart
          layout="vertical"
          data={data.map((c) => ({
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
              const payload = (p as { payload?: { pct: number; total: number } })
                .payload;
              return [
                `${payload?.pct ?? 0} % (${payload?.total ?? 0} questions)`,
                "Réussite",
              ];
            }}
          />
          <Bar dataKey="pct" radius={[0, 6, 6, 0]}>
            {data.map((c) => (
              <Cell key={c.nom} fill={c.couleur ?? "#F5C518"} />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

interface ModePoint {
  name: string;
  count: number;
}

export function PerModeChart({ data }: { data: ModePoint[] }) {
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%" minWidth={1}>
        <PieChart>
          <Pie
            data={data.map((m) => ({ name: m.name, value: m.count }))}
            dataKey="value"
            nameKey="name"
            innerRadius={50}
            outerRadius={90}
            paddingAngle={2}
          >
            {data.map((_, idx) => (
              <Cell key={idx} fill={MODE_COLORS[idx % MODE_COLORS.length]} />
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
  );
}
