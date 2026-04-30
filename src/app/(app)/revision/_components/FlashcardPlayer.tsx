"use client";

import { useState, useTransition } from "react";
import { ArrowRight, BookOpen, RotateCcw, ThumbsDown, ThumbsUp, Trophy } from "lucide-react";
import { motion } from "framer-motion";
import { SpeakerButton } from "@/components/game/SpeakerButton";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { RevQuestion } from "@/lib/revision/types";
import { markRevisionResult } from "../actions";

interface FlashcardPlayerProps {
  questions: RevQuestion[];
}

export function FlashcardPlayer({ questions }: FlashcardPlayerProps) {
  const [idx, setIdx] = useState(0);
  const [flipped, setFlipped] = useState(false);
  const [, startTransition] = useTransition();
  const [stats, setStats] = useState({ acquis: 0, aRevoir: 0 });
  const [done, setDone] = useState(false);

  const q = questions[idx];

  function next(rating: "acquis" | "aRevoir") {
    const isCorrect = rating === "acquis";
    if (q) {
      startTransition(async () => {
        await markRevisionResult(q.questionId, isCorrect);
      });
    }
    setStats((s) =>
      rating === "acquis"
        ? { ...s, acquis: s.acquis + 1 }
        : { ...s, aRevoir: s.aRevoir + 1 },
    );
    setFlipped(false);
    if (idx + 1 >= questions.length) {
      setDone(true);
    } else {
      setIdx(idx + 1);
    }
  }

  if (done) {
    return (
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-5 p-8 text-center">
        <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-gold/20 text-gold-warm shadow-[0_0_64px_rgba(245,183,0,0.45)]">
          <Trophy className="h-12 w-12" aria-hidden="true" fill="currentColor" />
        </div>
        <h1 className="font-display text-3xl font-extrabold text-foreground">
          Paquet terminé
        </h1>
        <p className="text-foreground/70">
          <span className="text-life-green">{stats.acquis} acquise{stats.acquis > 1 ? "s" : ""}</span>
          {" · "}
          <span className="text-buzz">{stats.aRevoir} à revoir</span>
        </p>
        <Button
          variant="gold"
          size="lg"
          onClick={() => {
            setIdx(0);
            setStats({ acquis: 0, aRevoir: 0 });
            setDone(false);
            setFlipped(false);
          }}
        >
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          Recommencer
        </Button>
      </main>
    );
  }

  if (!q) return null;

  const correct = q.bonneReponse || q.reponses.find((r) => r.correct)?.text || "—";
  const progress = Math.round(((idx + 1) / questions.length) * 100);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <p className="text-xs font-bold uppercase tracking-widest text-foreground/60">
          {idx + 1} / {questions.length}
        </p>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-foreground/10">
          <div
            className="h-full bg-gold transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="flex justify-between gap-2">
        {q.category && (
          <span
            className="inline-flex items-center rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide text-on-color"
            style={{ backgroundColor: q.category.couleur ?? "#F5B700" }}
          >
            {q.category.nom}
          </span>
        )}
        <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-xs font-bold text-foreground/60">
          Difficulté {q.difficulte}
        </span>
      </div>

      {/* Flashcard */}
      <button
        type="button"
        onClick={() => setFlipped((f) => !f)}
        className={cn(
          "group relative min-h-[220px] w-full overflow-hidden rounded-3xl border-2 p-6 text-left transition-all",
          flipped
            ? "border-life-green/40 bg-life-green/10"
            : "border-gold/40 bg-card hover:border-gold",
        )}
      >
        <div className="absolute right-3 top-3 flex items-center gap-1.5 rounded-full bg-foreground/5 px-2 py-1 text-[10px] font-bold uppercase tracking-wider text-foreground/60">
          <BookOpen className="h-3 w-3" aria-hidden="true" />
          {flipped ? "Réponse" : "Question"}
        </div>
        <motion.div
          key={flipped ? "back" : "front"}
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-4"
        >
          {flipped ? (
            <>
              <p className="text-xs uppercase tracking-widest text-foreground/50">
                {q.enonce}
              </p>
              <h2 className="font-display text-2xl font-extrabold text-life-green sm:text-3xl">
                {correct}
              </h2>
              {q.explication && (
                <p className="text-sm text-foreground/70">{q.explication}</p>
              )}
            </>
          ) : (
            <h2 className="font-display text-2xl font-extrabold text-foreground sm:text-3xl">
              {q.enonce}
            </h2>
          )}
        </motion.div>
        {!flipped && (
          <p className="mt-4 text-xs text-foreground/50">
            Clique la carte pour voir la réponse.
          </p>
        )}
      </button>

      <div className="flex justify-center">
        <SpeakerButton text={flipped ? `${q.enonce}. La réponse : ${correct}.` : q.enonce} />
      </div>

      {/* Boutons rating (visibles seulement après flip) */}
      {flipped && (
        <div className="grid gap-3 sm:grid-cols-2">
          <button
            type="button"
            onClick={() => next("aRevoir")}
            className="flex items-center justify-center gap-2 rounded-xl border-2 border-buzz/40 bg-buzz/10 px-4 py-3 text-base font-bold text-buzz hover:border-buzz hover:bg-buzz/20"
          >
            <ThumbsDown className="h-5 w-5" aria-hidden="true" />À revoir
          </button>
          <button
            type="button"
            onClick={() => next("acquis")}
            className="flex items-center justify-center gap-2 rounded-xl border-2 border-life-green/40 bg-life-green/10 px-4 py-3 text-base font-bold text-life-green hover:border-life-green hover:bg-life-green/20"
          >
            <ThumbsUp className="h-5 w-5" aria-hidden="true" />
            Acquise
          </button>
        </div>
      )}
      {!flipped && (
        <div className="flex justify-center">
          <Button
            variant="gold"
            size="lg"
            onClick={() => setFlipped(true)}
          >
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
            Voir la réponse
          </Button>
        </div>
      )}
    </main>
  );
}
