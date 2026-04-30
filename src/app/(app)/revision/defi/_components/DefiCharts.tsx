"use client";

import {
  CartesianGrid,
  Cell,
  Legend,
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
 * I3.2 — Charts du Défi du jour.
 *
 * `minWidth={1}` sur ResponsiveContainer suppresse le warning
 * "width(-1) and height(-1)" qui spamait la console dev pendant la
 * 1ʳᵉ frame de mesure (Recharts 3.x).
 *
 * Contient :
 *   • EvolutionLineChart : score sur les 30 derniers jours.
 *   • RepartitionPieChart : Parfaits / Réussis / Ratés.
 */

function shortDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("fr-FR", {
    day: "2-digit",
    month: "2-digit",
  }).format(d);
}

interface EvolutionPoint {
  date: string;
  percent: number;
}

export function EvolutionLineChart({ data }: { data: EvolutionPoint[] }) {
  return (
    <div className="h-40 w-full">
      <ResponsiveContainer width="100%" height="100%" minWidth={1}>
        <LineChart
          data={data.map((d) => ({
            date: shortDate(d.date),
            percent: d.percent,
          }))}
          margin={{ top: 4, right: 4, left: -16, bottom: 0 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="rgba(11,31,77,0.08)"
          />
          <XAxis
            dataKey="date"
            fontSize={10}
            tickLine={false}
            axisLine={false}
            stroke="currentColor"
            className="text-foreground/50"
          />
          <YAxis
            domain={[0, 100]}
            fontSize={10}
            tickLine={false}
            axisLine={false}
            ticks={[0, 50, 100]}
            stroke="currentColor"
            className="text-foreground/50"
          />
          <Tooltip
            contentStyle={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
            }}
            labelStyle={{ color: "var(--foreground)" }}
            formatter={(value) => [`${value ?? 0}%`, "Score"]}
          />
          <Line
            type="monotone"
            dataKey="percent"
            stroke="#F5B700"
            strokeWidth={2.5}
            dot={{ r: 3, fill: "#F5B700" }}
            activeDot={{ r: 5 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}

interface RepartitionData {
  perfectCount: number;
  excellentCount: number;
  goodCount: number;
  averageCount: number;
  failedCount: number;
}

export function RepartitionPieChart({ data }: { data: RepartitionData }) {
  const total =
    data.perfectCount +
    data.excellentCount +
    data.goodCount +
    data.averageCount +
    data.failedCount;
  // J3.2 — 5 buckets pour mieux distinguer les performances. Les
  // tranches à 0 sont filtrées avant rendu pour ne pas polluer la
  // légende.
  const slices = [
    { name: "Parfaits (100 %)", value: data.perfectCount, color: "#10b981" },
    { name: "Excellents (80-99 %)", value: data.excellentCount, color: "#84cc16" },
    { name: "Bons (60-79 %)", value: data.goodCount, color: "#f59e0b" },
    { name: "Moyens (40-59 %)", value: data.averageCount, color: "#f97316" },
    { name: "Ratés (< 40 %)", value: data.failedCount, color: "#ef4444" },
  ].filter((s) => s.value > 0);

  return (
    <div className="h-64 w-full">
      <ResponsiveContainer width="100%" height="100%" minWidth={1}>
        <PieChart>
          <Pie
            data={slices}
            cx="50%"
            cy="50%"
            labelLine={false}
            outerRadius={80}
            dataKey="value"
            label={({ name, percent }) =>
              total > 0 && typeof percent === "number"
                ? `${name} : ${(percent * 100).toFixed(0)}%`
                : name
            }
          >
            {slices.map((slice) => (
              <Cell key={slice.name} fill={slice.color} />
            ))}
          </Pie>
          <Tooltip
            contentStyle={{
              background: "var(--card)",
              border: "1px solid var(--border)",
              borderRadius: 8,
              fontSize: 12,
            }}
            formatter={(value) => [`${value} défi(s)`, "Compte"]}
          />
          <Legend
            wrapperStyle={{ fontSize: 11 }}
            iconType="circle"
            verticalAlign="bottom"
          />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}
