"use client";

import { Search, X } from "lucide-react";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { QUESTION_TYPES } from "@/lib/schemas/question";
import { Input } from "@/components/ui/input";

interface Category {
  id: number;
  nom: string;
  slug: string;
  couleur: string | null;
}

interface FiltersProps {
  categories: Category[];
  current: {
    q?: string;
    type?: string;
    category?: string;
    difficulte?: string;
  };
}

export function Filters({ categories, current }: FiltersProps) {
  const router = useRouter();
  const searchParams = useSearchParams();
  const [isPending, startTransition] = useTransition();
  const [q, setQ] = useState(current.q ?? "");

  // Debounce recherche texte
  useEffect(() => {
    const trimmed = q.trim();
    const currentQ = (current.q ?? "").trim();
    if (trimmed === currentQ) return;

    const t = setTimeout(() => {
      pushWith({ q: trimmed });
    }, 300);
    return () => clearTimeout(t);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [q]);

  function pushWith(changes: Record<string, string | undefined>) {
    const next = new URLSearchParams(searchParams.toString());
    for (const [k, v] of Object.entries(changes)) {
      if (v === undefined || v === "" || v === "all") next.delete(k);
      else next.set(k, v);
    }
    next.delete("page"); // reset page à chaque changement de filtre
    startTransition(() => {
      router.push(`/admin/questions?${next.toString()}`);
    });
  }

  const hasAny =
    (current.q && current.q !== "") ||
    current.type ||
    current.category ||
    current.difficulte;

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-card/50 p-4 sm:flex-row sm:flex-wrap sm:items-end">
      <label className="flex flex-1 min-w-[200px] flex-col gap-1">
        <span className="text-xs font-semibold uppercase tracking-wider text-foreground/60">
          Recherche
        </span>
        <div className="relative">
          <Search
            className="pointer-events-none absolute left-2.5 top-1/2 h-4 w-4 -translate-y-1/2 opacity-60"
            aria-hidden="true"
          />
          <Input
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Texte dans l'énoncé…"
            className="pl-8"
          />
        </div>
      </label>

      <Select
        label="Type"
        value={current.type ?? "all"}
        onChange={(v) => pushWith({ type: v })}
        options={[
          { value: "all", label: "Tous" },
          ...QUESTION_TYPES.map((t) => ({ value: t, label: t })),
        ]}
      />

      <Select
        label="Catégorie"
        value={current.category ?? "all"}
        onChange={(v) => pushWith({ category: v })}
        options={[
          { value: "all", label: "Toutes" },
          ...categories.map((c) => ({ value: String(c.id), label: c.nom })),
        ]}
      />

      <Select
        label="Difficulté"
        value={current.difficulte ?? "all"}
        onChange={(v) => pushWith({ difficulte: v })}
        options={[
          { value: "all", label: "Toutes" },
          ...[1, 2, 3, 4, 5].map((d) => ({
            value: String(d),
            label: `★`.repeat(d),
          })),
        ]}
      />

      {hasAny && (
        <button
          type="button"
          onClick={() => {
            setQ("");
            startTransition(() => router.push("/admin/questions"));
          }}
          className="flex items-center gap-1 self-end rounded-md border border-border px-3 py-2 text-sm text-foreground/80 transition-colors hover:border-buzz hover:text-buzz"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
          Réinitialiser
        </button>
      )}

      {isPending && (
        <span className="self-end text-xs text-foreground/50">Mise à jour…</span>
      )}
    </div>
  );
}

function Select({
  label,
  value,
  onChange,
  options,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: { value: string; label: string }[];
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-semibold uppercase tracking-wider text-foreground/60">
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 rounded-md border border-border bg-card px-3 text-sm text-foreground focus:border-gold focus:outline-none"
      >
        {options.map((o) => (
          <option key={o.value} value={o.value} className="bg-muted">
            {o.label}
          </option>
        ))}
      </select>
    </label>
  );
}
