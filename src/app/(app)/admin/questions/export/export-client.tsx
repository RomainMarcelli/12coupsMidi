"use client";

import { Database, Dices, Download, Loader2, Tags } from "lucide-react";
import { useState, useTransition } from "react";
import { exportQuestions } from "./actions";
import type { QuestionType } from "@/lib/schemas/question";

interface CategoryOption {
  id: number;
  nom: string;
  slug: string;
  questionCount: number;
}

interface ExportClientProps {
  categories: CategoryOption[];
  totalCount: number;
  questionTypes: QuestionType[];
}

/**
 * N3.1 — UI repensée pour les 3 modes d'export :
 *   - 3 cards en grille responsive (1 col mobile, 2 cols tablette,
 *     3 cols desktop), avec padding aéré et `min-h` pour aligner
 *     visuellement les hauteurs
 *   - Icône en haut de chaque card pour identifier visuellement le mode
 *   - Bouton CTA gold en bas (push-to-bottom via flex-1)
 *   - Card "Par catégorie" : affiche le count entre parenthèses
 *     (ex. "Histoire (89)"), désactive les catégories à 0 questions
 */
export function ExportClient({
  categories,
  totalCount,
  questionTypes,
}: ExportClientProps) {
  return (
    <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
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
    <Card icon={<Database className="h-7 w-7" aria-hidden="true" />} title="Tout exporter">
      <p className="text-sm text-foreground/70">
        Télécharge l&apos;intégralité de la base en un seul fichier JSON.
      </p>
      <div className="mt-2 rounded-lg border border-border/60 bg-background/40 px-3 py-2 text-center">
        <p className="text-2xl font-extrabold text-gold-warm font-mono">
          {totalCount}
        </p>
        <p className="text-xs uppercase tracking-wider text-foreground/50">
          questions
        </p>
      </div>
      <div className="flex-1" />
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

  // Total de questions sélectionnées pour info dans le bouton.
  const selectedTotal = categories
    .filter((c) => selected.has(c.id))
    .reduce((acc, c) => acc + c.questionCount, 0);

  return (
    <Card
      icon={<Tags className="h-7 w-7" aria-hidden="true" />}
      title="Par catégorie"
    >
      <p className="text-sm text-foreground/70">
        Sélectionne une ou plusieurs catégories.
      </p>
      <div className="flex max-h-64 min-h-[8rem] flex-col gap-0.5 overflow-y-auto rounded-md border border-border bg-background/30 p-1">
        {categories.length === 0 && (
          <p className="px-2 py-3 text-center text-xs text-foreground/50">
            Aucune catégorie.
          </p>
        )}
        {categories.map((c) => {
          const empty = c.questionCount === 0;
          return (
            <label
              key={c.id}
              className={
                empty
                  ? "flex cursor-not-allowed items-center justify-between gap-2 rounded px-2 py-1.5 text-sm opacity-50"
                  : "flex cursor-pointer items-center justify-between gap-2 rounded px-2 py-1.5 text-sm transition-colors hover:bg-foreground/5"
              }
            >
              <span className="flex min-w-0 items-center gap-2">
                <input
                  type="checkbox"
                  checked={selected.has(c.id)}
                  onChange={() => toggle(c.id)}
                  disabled={empty}
                  className="h-4 w-4 shrink-0 rounded border-border accent-gold"
                />
                <span className="truncate text-foreground/90">{c.nom}</span>
              </span>
              <span className="font-mono text-xs text-foreground/50">
                ({c.questionCount})
              </span>
            </label>
          );
        })}
      </div>
      <div className="flex-1" />
      <ExportButton
        onClick={onClick}
        pending={pending}
        label={
          selected.size === 0
            ? "Exporter"
            : `Exporter ${selected.size} catégorie${selected.size > 1 ? "s" : ""} (${selectedTotal})`
        }
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
    <Card
      icon={<Dices className="h-7 w-7" aria-hidden="true" />}
      title="Échantillon aléatoire"
    >
      <p className="text-sm text-foreground/70">
        Tirage au sort avec filtres optionnels.
      </p>
      <div className="flex flex-col gap-3">
        <FilterField label="Nombre">
          <input
            type="number"
            min={1}
            value={count}
            onChange={(e) => setCount(Number(e.target.value))}
            className="h-9 w-full rounded-md border border-border bg-card px-2 text-sm"
          />
        </FilterField>
        <FilterField label="Catégorie">
          <select
            value={categoryId}
            onChange={(e) =>
              setCategoryId(e.target.value === "" ? "" : Number(e.target.value))
            }
            className="h-9 w-full rounded-md border border-border bg-card px-2 text-sm"
          >
            <option value="">— Toutes —</option>
            {categories
              .filter((c) => c.questionCount > 0)
              .map((c) => (
                <option key={c.id} value={c.id}>
                  {c.nom} ({c.questionCount})
                </option>
              ))}
          </select>
        </FilterField>
        <FilterField label="Type">
          <select
            value={type}
            onChange={(e) => setType(e.target.value as QuestionType | "")}
            className="h-9 w-full rounded-md border border-border bg-card px-2 text-sm"
          >
            <option value="">— Tous —</option>
            {questionTypes.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </FilterField>
        <FilterField label="Difficulté">
          <select
            value={difficulte}
            onChange={(e) =>
              setDifficulte(e.target.value === "" ? "" : Number(e.target.value))
            }
            className="h-9 w-full rounded-md border border-border bg-card px-2 text-sm"
          >
            <option value="">— Toutes —</option>
            {[1, 2, 3, 4, 5].map((d) => (
              <option key={d} value={d}>
                {d}
              </option>
            ))}
          </select>
        </FilterField>
      </div>
      <div className="flex-1" />
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
  icon,
  title,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section className="flex min-h-[420px] flex-col gap-3 rounded-2xl border border-border bg-card p-6 glow-card transition-all hover:border-gold/40 hover:shadow-[0_0_24px_rgba(245,183,0,0.12)]">
      <div className="flex items-center gap-3">
        <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-gold/15 text-gold-warm">
          {icon}
        </span>
        <h2 className="font-display text-lg font-bold text-foreground">
          {title}
        </h2>
      </div>
      {children}
    </section>
  );
}

function FilterField({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1 text-xs">
      <span className="font-semibold uppercase tracking-wider text-foreground/60">
        {label}
      </span>
      {children}
    </label>
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
      className="inline-flex items-center justify-center gap-2 rounded-md bg-gold px-4 py-2.5 text-sm font-bold text-on-color shadow-[0_3px_0_0_#e89e00] transition-all hover:-translate-y-px hover:shadow-[0_5px_16px_rgba(245,183,0,0.45)] disabled:cursor-not-allowed disabled:opacity-50"
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
