"use client";

import { ArrowDown, ArrowUp, Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useState, useTransition } from "react";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { deleteQuestion } from "./actions";
import {
  getDisplayedAnswer,
  truncate,
} from "./questions-table-helpers";
import type { Database } from "@/types/database";

/**
 * N2.1 — Table admin questions avec colonne "Bonne réponse" pour
 * relire l'énoncé + la réponse en un coup d'œil sans cliquer dans
 * chaque question.
 *
 * Responsive :
 *   - desktop (md+) : `<table>` classique avec sémantique correcte
 *     pour screen readers
 *   - mobile (< md) : liste de cards verticales avec les infos
 *     essentielles (énoncé, réponse, méta)
 *
 * Les 2 versions cohabitent dans le DOM, on switch via media queries
 * Tailwind (`md:hidden` / `hidden md:block`). Volontairement pas de
 * `useMediaQuery` JS pour éviter les flashs SSR.
 */

type QuestionRow = Pick<
  Database["public"]["Tables"]["questions"]["Row"],
  | "id"
  | "type"
  | "difficulte"
  | "enonce"
  | "category_id"
  | "created_at"
  | "reponses"
  | "bonne_reponse"
>;

type Category = Pick<
  Database["public"]["Tables"]["categories"]["Row"],
  "id" | "nom" | "couleur"
>;

interface QuestionsTableProps {
  questions: QuestionRow[];
  categories: Category[];
  /** Direction du tri par date d'ajout. Défaut "desc" (plus récentes en haut). */
  sort?: "asc" | "desc";
  /** Params actuels de l'URL pour construire le href du toggle de tri. */
  currentParams?: Record<string, string | undefined>;
}

/**
 * Construit l'URL avec un param `sort` togglé entre asc/desc, en
 * préservant tous les autres filtres (q, type, category, difficulte).
 * Reset systématiquement la `page` à 1 — le tri change l'ordre, donc
 * la page courante n'a plus de sens.
 */
function buildSortHref(
  current: Record<string, string | undefined> | undefined,
  nextSort: "asc" | "desc",
): string {
  const params = new URLSearchParams();
  if (current) {
    for (const [k, v] of Object.entries(current)) {
      if (v == null || v === "" || k === "sort" || k === "page") continue;
      params.set(k, v);
    }
  }
  params.set("sort", nextSort);
  const qs = params.toString();
  return qs ? `/admin/questions?${qs}` : "/admin/questions";
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  // Format court "30/04/2026" — la cellule reste compacte.
  return d.toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

const TYPE_LABELS: Record<string, string> = {
  quizz_2: "Quizz 1/2",
  quizz_4: "Quizz 1/4",
  etoile: "Étoile",
  face_a_face: "Face-à-Face",
  coup_maitre: "Coup de Maître",
  coup_par_coup: "Coup par Coup",
};

export function QuestionsTable({
  questions,
  categories,
  sort = "desc",
  currentParams,
}: QuestionsTableProps) {
  const catById = new Map(categories.map((c) => [c.id, c]));
  const [isPending, startTransition] = useTransition();
  const [pendingDelete, setPendingDelete] = useState<string | null>(null);

  // Toggle : si on est en desc, le clic suivant passe en asc, et vice-versa.
  const nextSort: "asc" | "desc" = sort === "asc" ? "desc" : "asc";
  const sortHref = buildSortHref(currentParams, nextSort);
  const SortIcon = sort === "asc" ? ArrowUp : ArrowDown;

  if (questions.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card/30 p-10 text-center text-foreground/60">
        Aucune question pour ces filtres.
      </div>
    );
  }

  return (
    <>
      {/* Desktop : <table> sémantique, visible à partir de md */}
      <div className="hidden overflow-x-auto rounded-xl border border-border md:block">
        <table className="w-full divide-y divide-border text-sm">
          <thead className="bg-muted text-xs uppercase tracking-wider text-foreground/60">
            <tr>
              <th scope="col" className="px-4 py-3 text-left">
                Énoncé
              </th>
              <th scope="col" className="px-4 py-3 text-left">
                Bonne réponse
              </th>
              <th scope="col" className="px-4 py-3 text-left">
                Catégorie
              </th>
              <th scope="col" className="px-4 py-3 text-left">
                Type
              </th>
              <th scope="col" className="px-4 py-3 text-left">
                Diff.
              </th>
              <th scope="col" className="px-4 py-3 text-left">
                <Link
                  href={sortHref}
                  aria-label={
                    sort === "asc"
                      ? "Trier par date décroissante"
                      : "Trier par date croissante"
                  }
                  className="inline-flex items-center gap-1 transition-colors hover:text-gold"
                >
                  Date
                  <SortIcon className="h-3 w-3" aria-hidden="true" />
                </Link>
              </th>
              <th scope="col" className="px-4 py-3 text-right">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/60 bg-card text-foreground">
            {questions.map((q) => {
              const cat = q.category_id ? catById.get(q.category_id) : null;
              const answer = getDisplayedAnswer({
                type: q.type,
                bonne_reponse: q.bonne_reponse,
                reponses: q.reponses,
              });
              return (
                <tr
                  key={q.id}
                  className="transition-colors hover:bg-muted/50"
                >
                  <td className="px-4 py-3 align-top">
                    <span title={q.enonce} className="text-foreground">
                      {truncate(q.enonce, 90)}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-top">
                    <span
                      title={answer}
                      className="font-semibold text-life-green"
                    >
                      {truncate(answer, 60)}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-top whitespace-nowrap">
                    {cat ? (
                      <span
                        className="inline-flex rounded-md px-2 py-0.5 text-xs font-semibold text-midnight"
                        style={{ backgroundColor: cat.couleur ?? "#F5C518" }}
                      >
                        {cat.nom}
                      </span>
                    ) : (
                      <span className="text-foreground/40">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 align-top whitespace-nowrap">
                    <span className="inline-flex rounded-md bg-gold/15 px-2 py-0.5 text-xs font-semibold text-gold">
                      {TYPE_LABELS[q.type] ?? q.type}
                    </span>
                  </td>
                  <td className="px-4 py-3 align-top whitespace-nowrap text-gold">
                    {"★".repeat(q.difficulte)}
                  </td>
                  <td className="px-4 py-3 align-top whitespace-nowrap font-mono text-xs text-foreground/70">
                    {formatDate(q.created_at)}
                  </td>
                  <td className="px-4 py-3 align-top">
                    <Actions
                      id={q.id}
                      enonce={q.enonce}
                      isPending={isPending}
                      onDelete={() => setPendingDelete(q.id)}
                    />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Mobile : liste de cards, visible jusqu'à md */}
      <div className="flex flex-col gap-3 md:hidden">
        <div className="flex items-center justify-end">
          <Link
            href={sortHref}
            aria-label={
              sort === "asc"
                ? "Trier par date décroissante"
                : "Trier par date croissante"
            }
            className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-semibold text-foreground/70 transition-colors hover:border-gold/50 hover:bg-gold/10 hover:text-foreground"
          >
            Date
            <SortIcon className="h-3 w-3" aria-hidden="true" />
          </Link>
        </div>
        <ul className="flex flex-col gap-3">
          {questions.map((q) => {
            const cat = q.category_id ? catById.get(q.category_id) : null;
            const answer = getDisplayedAnswer({
              type: q.type,
              bonne_reponse: q.bonne_reponse,
              reponses: q.reponses,
            });
            return (
              <li
                key={q.id}
                className="flex flex-col gap-2 rounded-xl border border-border bg-card p-4"
                aria-label={`Question : ${truncate(q.enonce, 60)}`}
              >
                <p className="font-display text-sm font-bold text-foreground">
                  {q.enonce}
                </p>
                <p className="text-sm">
                  <span className="text-foreground/60">→ </span>
                  <span className="font-semibold text-life-green">
                    {answer}
                  </span>
                </p>
                <div className="flex flex-wrap items-center gap-2 text-xs">
                  {cat && (
                    <span
                      className="inline-flex rounded-md px-2 py-0.5 font-semibold text-midnight"
                      style={{ backgroundColor: cat.couleur ?? "#F5C518" }}
                    >
                      {cat.nom}
                    </span>
                  )}
                  <span className="inline-flex rounded-md bg-gold/15 px-2 py-0.5 font-semibold text-gold">
                    {TYPE_LABELS[q.type] ?? q.type}
                  </span>
                  <span className="text-gold">{"★".repeat(q.difficulte)}</span>
                  <span className="font-mono text-foreground/50">
                    {formatDate(q.created_at)}
                  </span>
                </div>
                <div className="flex justify-end">
                  <Actions
                    id={q.id}
                    enonce={q.enonce}
                    isPending={isPending}
                    onDelete={() => setPendingDelete(q.id)}
                  />
                </div>
              </li>
            );
          })}
        </ul>
      </div>

      <ConfirmDialog
        open={pendingDelete !== null}
        onClose={() => !isPending && setPendingDelete(null)}
        onConfirm={() => {
          const id = pendingDelete;
          if (!id) return;
          startTransition(async () => {
            await deleteQuestion(id);
            setPendingDelete(null);
          });
        }}
        isPending={isPending}
        title="Supprimer cette question ?"
        description="Cette action est irréversible. La question sera retirée de la base et toutes les sessions futures."
        confirmLabel={isPending ? "Suppression…" : "Supprimer"}
        confirmVariant="danger"
      />
    </>
  );
}

function Actions({
  id,
  enonce,
  isPending,
  onDelete,
}: {
  id: string;
  enonce: string;
  isPending: boolean;
  onDelete: () => void;
}) {
  const shortLabel = truncate(enonce, 40);
  return (
    <div className="flex items-center justify-end gap-2">
      <Link
        href={`/admin/questions/${id}`}
        aria-label={`Modifier la question : ${shortLabel}`}
        className="rounded-md border border-border p-1.5 text-foreground/70 transition-colors hover:border-gold hover:text-gold"
        title="Éditer"
      >
        <Pencil className="h-4 w-4" aria-hidden="true" />
      </Link>
      <button
        type="button"
        disabled={isPending}
        onClick={onDelete}
        aria-label={`Supprimer la question : ${shortLabel}`}
        className="rounded-md border border-border p-1.5 text-foreground/70 transition-colors hover:border-buzz hover:text-buzz disabled:opacity-50"
        title="Supprimer"
      >
        <Trash2 className="h-4 w-4" aria-hidden="true" />
      </button>
    </div>
  );
}

