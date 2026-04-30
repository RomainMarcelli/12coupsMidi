"use client";

import { Download, Loader2 } from "lucide-react";
import { useState, useTransition } from "react";
import { exportQuestions } from "./actions";
import type { QuestionType } from "@/lib/schemas/question";

interface CategoryOption {
  id: number;
  nom: string;
  slug: string;
}

interface ExportClientProps {
  categories: CategoryOption[];
  totalCount: number;
  questionTypes: QuestionType[];
}

/**
 * M6.1 — UI pour les 3 modes d'export. Le téléchargement est déclenché
 * côté client en construisant un Blob à partir des données retournées
 * par la server action.
 */
export function ExportClient({
  categories,
  totalCount,
  questionTypes,
}: ExportClientProps) {
  return (
    <div className="grid gap-4 lg:grid-cols-3">
      <ExportAllCard totalCount={totalCount} />
      <ExportByCategoryCard categories={categories} />
      <ExportSampleCard
        categories={categories}
        questionTypes={questionTypes}
      />
    </div>
  );
}

// =============================================================================
// 1) Tout exporter
// =============================================================================

function ExportAllCard({ totalCount }: { totalCount: number }) {
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(
    null,
  );

  function onClick() {
    setMsg(null);
    startTransition(async () => {
      const res = await exportQuestions({ mode: "all" });
      if (!res.success) {
        setMsg({ kind: "err", text: res.message });
        return;
      }
      downloadJSON(res.data, `questions-export-${todayStamp()}.json`);
      setMsg({ kind: "ok", text: `${res.count} questions exportées.` });
    });
  }

  return (
    <Card title="Tout exporter">
      <p className="text-sm text-foreground/70">
        Télécharge l&apos;intégralité des questions de la base
        ({totalCount} questions).
      </p>
      <ExportButton onClick={onClick} pending={pending} label="Exporter tout" />
      <Feedback msg={msg} />
    </Card>
  );
}

// =============================================================================
// 2) Par catégorie
// =============================================================================

function ExportByCategoryCard({
  categories,
}: {
  categories: CategoryOption[];
}) {
  const [selected, setSelected] = useState<Set<number>>(new Set());
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(
    null,
  );

  function toggle(id: number) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function onClick() {
    if (selected.size === 0) {
      setMsg({ kind: "err", text: "Sélectionne au moins une catégorie." });
      return;
    }
    setMsg(null);
    const ids = Array.from(selected);
    startTransition(async () => {
      const res = await exportQuestions({
        mode: "by-category",
        categoryIds: ids,
      });
      if (!res.success) {
        setMsg({ kind: "err", text: res.message });
        return;
      }
      const filename =
        ids.length === 1
          ? `questions-${
              categories.find((c) => c.id === ids[0])?.slug ?? "cat"
            }-${todayStamp()}.json`
          : `questions-multi-cats-${todayStamp()}.json`;
      downloadJSON(res.data, filename);
      setMsg({ kind: "ok", text: `${res.count} questions exportées.` });
    });
  }

  return (
    <Card title="Par catégorie">
      <p className="text-sm text-foreground/70">
        Sélectionne une ou plusieurs catégories.
      </p>
      <div className="flex max-h-48 flex-col gap-1 overflow-y-auto rounded-md border border-border bg-background/30 p-2">
        {categories.map((c) => (
          <label
            key={c.id}
            className="flex cursor-pointer items-center gap-2 rounded px-2 py-1 text-sm hover:bg-foreground/5"
          >
            <input
              type="checkbox"
              checked={selected.has(c.id)}
              onChange={() => toggle(c.id)}
              className="h-4 w-4 rounded border-border accent-gold"
            />
            <span className="text-foreground/90">{c.nom}</span>
            <span className="ml-auto font-mono text-xs text-foreground/40">
              {c.slug}
            </span>
          </label>
        ))}
      </div>
      <ExportButton
        onClick={onClick}
        pending={pending}
        label={`Exporter ${selected.size} catégorie${selected.size > 1 ? "s" : ""}`}
        disabled={selected.size === 0}
      />
      <Feedback msg={msg} />
    </Card>
  );
}

// =============================================================================
// 3) Échantillon
// =============================================================================

function ExportSampleCard({
  categories,
  questionTypes,
}: {
  categories: CategoryOption[];
  questionTypes: QuestionType[];
}) {
  const [count, setCount] = useState(20);
  const [categoryId, setCategoryId] = useState<number | "">("");
  const [type, setType] = useState<QuestionType | "">("");
  const [difficulte, setDifficulte] = useState<number | "">("");
  const [pending, startTransition] = useTransition();
  const [msg, setMsg] = useState<{ kind: "ok" | "err"; text: string } | null>(
    null,
  );

  function onClick() {
    if (!Number.isFinite(count) || count <= 0) {
      setMsg({ kind: "err", text: "Indique un nombre > 0." });
      return;
    }
    setMsg(null);
    startTransition(async () => {
      const res = await exportQuestions({
        mode: "sample",
        count,
        filters: {
          categoryId: categoryId === "" ? undefined : categoryId,
          type: type === "" ? undefined : type,
          difficulte: difficulte === "" ? undefined : difficulte,
        },
      });
      if (!res.success) {
        setMsg({ kind: "err", text: res.message });
        return;
      }
      downloadJSON(res.data, `questions-sample-${count}-${todayStamp()}.json`);
      setMsg({ kind: "ok", text: `${res.count} questions exportées.` });
    });
  }

  return (
    <Card title="Échantillon aléatoire">
      <p className="text-sm text-foreground/70">
        Tirage aléatoire avec filtres optionnels.
      </p>
      <label className="flex flex-col gap-1 text-xs">
        <span className="font-semibold uppercase tracking-wider text-foreground/60">
          Nombre
        </span>
        <input
          type="number"
          min={1}
          value={count}
          onChange={(e) => setCount(Number(e.target.value))}
          className="h-9 rounded-md border border-border bg-card px-2 text-sm"
        />
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="font-semibold uppercase tracking-wider text-foreground/60">
          Catégorie (optionnel)
        </span>
        <select
          value={categoryId}
          onChange={(e) =>
            setCategoryId(e.target.value === "" ? "" : Number(e.target.value))
          }
          className="h-9 rounded-md border border-border bg-card px-2 text-sm"
        >
          <option value="">— Toutes —</option>
          {categories.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nom}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="font-semibold uppercase tracking-wider text-foreground/60">
          Type (optionnel)
        </span>
        <select
          value={type}
          onChange={(e) => setType(e.target.value as QuestionType | "")}
          className="h-9 rounded-md border border-border bg-card px-2 text-sm"
        >
          <option value="">— Tous —</option>
          {questionTypes.map((t) => (
            <option key={t} value={t}>
              {t}
            </option>
          ))}
        </select>
      </label>
      <label className="flex flex-col gap-1 text-xs">
        <span className="font-semibold uppercase tracking-wider text-foreground/60">
          Difficulté (optionnel)
        </span>
        <select
          value={difficulte}
          onChange={(e) =>
            setDifficulte(e.target.value === "" ? "" : Number(e.target.value))
          }
          className="h-9 rounded-md border border-border bg-card px-2 text-sm"
        >
          <option value="">— Toutes —</option>
          {[1, 2, 3, 4, 5].map((d) => (
            <option key={d} value={d}>
              {d}
            </option>
          ))}
        </select>
      </label>
      <ExportButton
        onClick={onClick}
        pending={pending}
        label={`Exporter ${count}`}
      />
      <Feedback msg={msg} />
    </Card>
  );
}

// =============================================================================
// Helpers
// =============================================================================

function Card({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5 glow-card">
      <h2 className="font-display text-lg font-bold text-foreground">{title}</h2>
      {children}
    </section>
  );
}

function ExportButton({
  onClick,
  pending,
  label,
  disabled,
}: {
  onClick: () => void;
  pending: boolean;
  label: string;
  disabled?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending || disabled}
      className="mt-auto inline-flex items-center justify-center gap-2 rounded-md bg-gold px-4 py-2 text-sm font-bold text-on-color shadow-[0_3px_0_0_#e89e00] transition-all hover:-translate-y-px hover:shadow-[0_5px_16px_rgba(245,183,0,0.45)] disabled:cursor-not-allowed disabled:opacity-50"
    >
      {pending ? (
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      ) : (
        <Download className="h-4 w-4" aria-hidden="true" />
      )}
      {label}
    </button>
  );
}

function Feedback({
  msg,
}: {
  msg: { kind: "ok" | "err"; text: string } | null;
}) {
  if (!msg) return null;
  return (
    <p
      className={
        msg.kind === "ok"
          ? "text-xs font-semibold text-life-green"
          : "text-xs font-semibold text-buzz"
      }
    >
      {msg.text}
    </p>
  );
}

function downloadJSON(data: unknown, filename: string) {
  const blob = new Blob([JSON.stringify(data, null, 2)], {
    type: "application/json",
  });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function todayStamp() {
  const d = new Date();
  return d.toISOString().slice(0, 10);
}
