"use client";

import { Pencil, Trash2 } from "lucide-react";
import Link from "next/link";
import { useTransition } from "react";
import { deleteQuestion } from "./actions";
import type { Database } from "@/types/database";

type QuestionRow = Pick<
  Database["public"]["Tables"]["questions"]["Row"],
  "id" | "type" | "difficulte" | "enonce" | "category_id" | "created_at"
>;

type Category = Pick<
  Database["public"]["Tables"]["categories"]["Row"],
  "id" | "nom" | "couleur"
>;

interface QuestionsTableProps {
  questions: QuestionRow[];
  categories: Category[];
}

const TYPE_LABELS: Record<string, string> = {
  quizz_2: "Quizz 1/2",
  quizz_4: "Quizz 1/4",
  etoile: "Étoile",
  face_a_face: "Face-à-Face",
  coup_maitre: "Coup de Maître",
};

export function QuestionsTable({ questions, categories }: QuestionsTableProps) {
  const catById = new Map(categories.map((c) => [c.id, c]));
  const [isPending, startTransition] = useTransition();

  if (questions.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card/30 p-10 text-center text-navy/60">
        Aucune question pour ces filtres.
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-xl border border-border">
      <table className="w-full divide-y divide-border text-sm">
        <thead className="bg-cream-deep text-xs uppercase tracking-wider text-navy/60">
          <tr>
            <th className="px-4 py-3 text-left">Type</th>
            <th className="px-4 py-3 text-left">Cat.</th>
            <th className="px-4 py-3 text-left">Diff.</th>
            <th className="px-4 py-3 text-left">Énoncé</th>
            <th className="px-4 py-3 text-right">Actions</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-border/60 bg-card text-navy">
          {questions.map((q) => {
            const cat = q.category_id ? catById.get(q.category_id) : null;
            return (
              <tr key={q.id} className="transition-colors hover:bg-cream-deep/50">
                <td className="px-4 py-3 whitespace-nowrap">
                  <span className="inline-flex rounded-md bg-gold/15 px-2 py-0.5 text-xs font-semibold text-gold">
                    {TYPE_LABELS[q.type] ?? q.type}
                  </span>
                </td>
                <td className="px-4 py-3 whitespace-nowrap">
                  {cat ? (
                    <span
                      className="inline-flex rounded-md px-2 py-0.5 text-xs font-semibold text-midnight"
                      style={{ backgroundColor: cat.couleur ?? "#F5C518" }}
                    >
                      {cat.nom}
                    </span>
                  ) : (
                    <span className="text-navy/40">—</span>
                  )}
                </td>
                <td className="px-4 py-3 whitespace-nowrap text-gold">
                  {"★".repeat(q.difficulte)}
                </td>
                <td className="max-w-md px-4 py-3 truncate" title={q.enonce}>
                  {q.enonce}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-2">
                    <Link
                      href={`/admin/questions/${q.id}`}
                      className="rounded-md border border-border p-1.5 text-navy/70 transition-colors hover:border-gold hover:text-gold"
                      title="Éditer"
                    >
                      <Pencil className="h-4 w-4" aria-hidden="true" />
                      <span className="sr-only">Éditer</span>
                    </Link>
                    <button
                      type="button"
                      disabled={isPending}
                      onClick={() => {
                        if (!confirm("Supprimer cette question ?")) return;
                        startTransition(async () => {
                          await deleteQuestion(q.id);
                        });
                      }}
                      className="rounded-md border border-border p-1.5 text-navy/70 transition-colors hover:border-buzz hover:text-buzz disabled:opacity-50"
                      title="Supprimer"
                    >
                      <Trash2 className="h-4 w-4" aria-hidden="true" />
                      <span className="sr-only">Supprimer</span>
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
