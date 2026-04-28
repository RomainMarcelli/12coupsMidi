"use client";

import { ArrowLeft, Check, Trophy, X } from "lucide-react";
import { motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { RevQuestion } from "@/lib/revision/types";
import type { ChallengeResult } from "../actions";

interface DefiResultViewerProps {
  result: ChallengeResult;
  questions: RevQuestion[];
  /** Date ISO du défi affiché (pour le titre). */
  date: string;
  onClose: () => void;
  /**
   * L1.2 — `true` quand l'utilisateur vient juste de terminer un défi.
   * Affiche un hero plus festif avec score en grand + couleur selon
   * le ratio. Sinon (consultation depuis le calendrier), header sobre.
   */
  justFinished?: boolean;
}

/**
 * Affiche les résultats d'un défi joué (lecture seule).
 *
 * Pour chaque question :
 *   - Énoncé
 *   - "Ta réponse" si présente (peut être vide en V1)
 *   - Bonne réponse en vert si correcte, en rouge si fausse
 *   - Explication si disponible
 *
 * L1.2 — Mode "justFinished" : hero festif + score XXL + bouton
 * "Retour au calendrier" très visible en bas (gold, lg).
 */
export function DefiResultViewer({
  result,
  questions,
  date,
  onClose,
  justFinished = false,
}: DefiResultViewerProps) {
  const ratio =
    result.totalCount > 0
      ? Math.round((result.correctCount / result.totalCount) * 100)
      : 0;

  const formattedDate = new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(new Date(date));

  // L1.2 — Couleur + libellé selon le score (uniquement utilisés en
  // mode justFinished pour le hero).
  const ratioStyle =
    ratio >= 100
      ? {
          label: "Parfait !",
          textClass: "text-life-green",
          bgClass: "bg-life-green/15 border-life-green/40",
          glow: "shadow-[0_0_48px_rgba(76,175,80,0.4)]",
        }
      : ratio >= 80
        ? {
            label: "Excellent !",
            textClass: "text-life-green",
            bgClass: "bg-life-green/10 border-life-green/30",
            glow: "shadow-[0_0_32px_rgba(76,175,80,0.25)]",
          }
        : ratio >= 60
          ? {
              label: "Bien joué !",
              textClass: "text-gold-warm",
              bgClass: "bg-gold/10 border-gold/30",
              glow: "shadow-[0_0_32px_rgba(245,183,0,0.25)]",
            }
          : ratio >= 40
            ? {
                label: "Pas mal…",
                textClass: "text-orange-500",
                bgClass: "bg-orange-500/10 border-orange-500/30",
                glow: "shadow-[0_0_24px_rgba(249,115,22,0.18)]",
              }
            : {
                label: "Tu peux faire mieux !",
                textClass: "text-buzz",
                bgClass: "bg-buzz/10 border-buzz/30",
                glow: "shadow-[0_0_24px_rgba(230,57,70,0.18)]",
              };

  // Index des réponses par questionId pour lookup O(1).
  const answersById = new Map(result.answers.map((a) => [a.questionId, a]));

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-4 sm:p-6">
      {justFinished ? (
        // L1.2 — Hero festif post-défi
        <motion.section
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ type: "spring", stiffness: 200, damping: 18 }}
          className={cn(
            "flex flex-col items-center gap-3 rounded-3xl border-2 p-6 text-center sm:p-8",
            ratioStyle.bgClass,
            ratioStyle.glow,
          )}
        >
          <Trophy
            className={cn("h-12 w-12", ratioStyle.textClass)}
            aria-hidden="true"
            fill={ratio >= 80 ? "currentColor" : "none"}
          />
          <h1 className="font-display text-2xl font-extrabold text-foreground sm:text-3xl">
            Défi du jour terminé !
          </h1>
          <p className="text-sm capitalize text-foreground/60">
            {formattedDate}
          </p>
          <p
            className={cn(
              "font-display text-5xl font-extrabold sm:text-7xl",
              ratioStyle.textClass,
            )}
          >
            {result.correctCount} / {result.totalCount}
          </p>
          <p className={cn("text-lg font-bold", ratioStyle.textClass)}>
            {ratio} % — {ratioStyle.label}
          </p>
        </motion.section>
      ) : (
        <header className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-xs font-bold uppercase tracking-widest text-gold-warm">
              Tes réponses
            </p>
            <h1 className="mt-0.5 font-display text-2xl font-extrabold capitalize text-foreground">
              {formattedDate}
            </h1>
            <p className="mt-1 text-sm text-foreground/65">
              Score :{" "}
              <strong className="text-foreground">
                {result.correctCount} / {result.totalCount}
              </strong>{" "}
              ({ratio} %)
            </p>
          </div>
          <Button variant="ghost-gold" size="lg" onClick={onClose}>
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Retour
          </Button>
        </header>
      )}

      <h2 className="mt-2 font-display text-base font-bold uppercase tracking-wider text-foreground/60">
        Détail des {questions.length} questions
      </h2>

      <ul className="flex flex-col gap-3">
        {questions.map((q, idx) => {
          const ans = answersById.get(q.questionId);
          // V1 : `userAnswer` n'est pas tracké côté QuizPlayer (vide).
          // On s'appuie uniquement sur `isCorrect`.
          const isCorrect = ans?.isCorrect === true;
          const correctText =
            q.bonneReponse || q.reponses.find((r) => r.correct)?.text || "—";

          return (
            <motion.li
              key={q.questionId}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: idx * 0.04 }}
              className={cn(
                "rounded-xl border bg-card p-4 glow-card",
                isCorrect ? "border-life-green/30" : "border-buzz/30",
              )}
            >
              <div className="mb-1 flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-wider text-foreground/50">
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-2 py-0.5",
                    isCorrect
                      ? "bg-life-green/15 text-life-green"
                      : "bg-buzz/15 text-buzz",
                  )}
                >
                  {isCorrect ? (
                    <Check className="h-3 w-3" aria-hidden="true" />
                  ) : (
                    <X className="h-3 w-3" aria-hidden="true" />
                  )}
                  {isCorrect ? "Correct" : "Faux"}
                </span>
                {q.category && (
                  <span
                    className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] text-on-color"
                    style={{
                      backgroundColor: q.category.couleur ?? "#F5B700",
                    }}
                  >
                    {q.category.nom}
                  </span>
                )}
                <span>Difficulté {q.difficulte}</span>
              </div>

              <p className="font-display text-lg font-bold text-foreground">
                {q.enonce}
              </p>

              {/* `userAnswer` reste vide en V1 — on commente plutôt
                  que de l'afficher avec un champ creux. */}
              {ans?.userAnswer && ans.userAnswer.trim() !== "" && (
                <p className="mt-2 text-sm text-foreground/70">
                  Ta réponse :{" "}
                  <strong
                    className={
                      isCorrect ? "text-life-green" : "text-buzz"
                    }
                  >
                    {ans.userAnswer}
                  </strong>
                </p>
              )}

              <p
                className={cn(
                  "mt-2 text-sm",
                  isCorrect ? "text-life-green" : "text-foreground",
                )}
              >
                Bonne réponse :{" "}
                <strong className="text-life-green">{correctText}</strong>
              </p>

              {q.explication && (
                <p className="mt-1 text-sm text-foreground/70">
                  {q.explication}
                </p>
              )}
            </motion.li>
          );
        })}
      </ul>

      {/* L1.2 — Bouton "Retour au calendrier" très visible en bas.
          Seul moyen de quitter la vue (avec celui en haut), pas de
          redirect auto. */}
      <div className="mt-4 flex justify-center pb-6">
        <Button
          variant="gold"
          size="lg"
          onClick={onClose}
          className="min-w-[260px]"
        >
          <ArrowLeft className="h-5 w-5" aria-hidden="true" />
          Retour au calendrier
        </Button>
      </div>
    </main>
  );
}
