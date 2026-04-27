"use client";

import { useState, useTransition } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { BookOpen, Check, Loader2, Star, Trophy } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import type { RevQuestion } from "@/lib/revision/types";
import { markErrorAsReviewed } from "../actions";

interface ErrorsReaderProps {
  questions: RevQuestion[];
}

/**
 * G1.2 — Mode "Voir mes erreurs" en lecture seule.
 *
 * Affiche la liste des questions ratées avec :
 *   - Énoncé
 *   - Bonne réponse (en vert)
 *   - Explication si disponible
 *   - Bouton "Marquer comme révisé" qui supprime la ligne
 *     `wrong_answers` côté serveur via {@link markErrorAsReviewed}.
 *
 * Différent du mode "Refaire" (`RetravaillerMode` → `QuizPlayer`) qui
 * fait rejouer les questions et n'efface qu'après
 * REVISION_MASTERY_THRESHOLD bonnes réponses successives.
 *
 * Cas vide : si toutes les erreurs ont été révisées dans la même
 * session, on affiche un état "Bravo, tu as révisé toutes tes
 * erreurs !" avec un retour vers le hub.
 */
export function ErrorsReader({ questions }: ErrorsReaderProps) {
  // Liste locale qu'on retire optimistement quand l'utilisateur valide.
  const [items, setItems] = useState<RevQuestion[]>(questions);
  // ID en cours de suppression (pour disabled / spinner) — on ne fait
  // qu'une seule suppression à la fois pour rester simple.
  const [pendingId, setPendingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  function handleReviewed(questionId: string) {
    setError(null);
    setPendingId(questionId);
    startTransition(async () => {
      const res = await markErrorAsReviewed(questionId);
      setPendingId(null);
      if (res.status === "error") {
        setError(res.message);
        return;
      }
      setItems((prev) => prev.filter((q) => q.questionId !== questionId));
    });
  }

  if (items.length === 0) {
    return (
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
        <Trophy
          className="h-14 w-14 text-life-green"
          aria-hidden="true"
          fill="currentColor"
        />
        <h1 className="font-display text-2xl font-extrabold text-foreground">
          Bravo, tu as révisé toutes tes erreurs !
        </h1>
        <p className="text-foreground/70">
          Reviens plus tard après avoir joué de nouvelles parties pour
          retravailler tes nouveaux points faibles.
        </p>
        <Link
          href="/revision"
          className="inline-flex items-center gap-2 rounded-md bg-gold px-5 py-2.5 font-bold text-on-color shadow-[0_4px_0_0_#e89e00] transition-all hover:-translate-y-px"
        >
          <BookOpen className="h-4 w-4" aria-hidden="true" />
          Retour au hub révision
        </Link>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-4 sm:p-6">
      <header className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-buzz">
            Mes erreurs
          </p>
          <h1 className="mt-0.5 font-display text-2xl font-extrabold text-foreground">
            {items.length} question{items.length > 1 ? "s" : ""} à relire
          </h1>
          <p className="mt-1 text-sm text-foreground/65">
            Lecture seule. Marque comme révisé pour retirer de la liste,
            ou bascule en mode &laquo;&nbsp;Refaire&nbsp;&raquo; pour
            rejouer les questions.
          </p>
        </div>
      </header>

      {error && (
        <p
          role="alert"
          className="rounded-md border border-buzz/40 bg-buzz/10 px-3 py-2 text-sm text-buzz"
        >
          {error}
        </p>
      )}

      <ul className="flex flex-col gap-3">
        <AnimatePresence initial={false}>
          {items.map((q) => {
            const correct =
              q.bonneReponse || q.reponses.find((r) => r.correct)?.text || "—";
            const isPending = pendingId === q.questionId;
            return (
              <motion.li
                key={q.questionId}
                layout
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: 60, scale: 0.95 }}
                transition={{ type: "spring", stiffness: 280, damping: 24 }}
                className="rounded-xl border border-border bg-card p-4 shadow-sm glow-card"
              >
                <div className="mb-1 flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-foreground/50">
                  {q.category && (
                    <span
                      className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] text-on-color"
                      style={{ backgroundColor: q.category.couleur ?? "#F5B700" }}
                    >
                      {q.category.nom}
                    </span>
                  )}
                  <span>Difficulté {q.difficulte}</span>
                </div>
                <p className="font-display text-lg font-bold text-foreground">
                  {q.enonce}
                </p>
                <p className="mt-2 text-life-green">
                  <Star
                    className="mr-1 inline h-4 w-4"
                    aria-hidden="true"
                    fill="currentColor"
                  />
                  <strong>{correct}</strong>
                </p>
                {q.explication && (
                  <p className="mt-1 text-sm text-foreground/70">
                    {q.explication}
                  </p>
                )}
                <div className="mt-3 flex justify-end">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleReviewed(q.questionId)}
                    disabled={isPending}
                    className="border border-life-green/40 bg-life-green/5 text-life-green hover:bg-life-green/15"
                  >
                    {isPending ? (
                      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    ) : (
                      <Check className="h-4 w-4" aria-hidden="true" />
                    )}
                    Marquer comme révisé
                  </Button>
                </div>
              </motion.li>
            );
          })}
        </AnimatePresence>
      </ul>
    </main>
  );
}
