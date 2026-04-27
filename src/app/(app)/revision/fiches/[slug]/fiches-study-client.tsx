"use client";

import { useEffect, useRef, useState, useTransition } from "react";
import {
  ArrowLeft,
  Check,
  Eye,
  Layers,
  RotateCcw,
  Trophy,
  X,
} from "lucide-react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { SpeakerButton } from "@/components/game/SpeakerButton";
import { resolveCorrectAnswerLabel } from "@/lib/game-logic/answer-display";
import { cn } from "@/lib/utils";
import { useAutoPlayTTS } from "@/lib/tts-helpers";
import type { RevQuestion } from "@/lib/revision/types";
import { markRevisionResult } from "../../actions";

interface Props {
  questions: RevQuestion[];
  categoryName: string | null;
  categoryColor: string | null;
}

/**
 * Système d'étude carte par carte (E3.1).
 *
 * Flow par fiche :
 *   1. Énoncé seul + bouton « Afficher la réponse » + Speaker.
 *   2. Clic / Espace / Entrée : révèle la bonne réponse + l'explication
 *      avec animation slide-down.
 *   3. L'utilisateur s'auto-évalue : bouton « J'ai bon » (B / 1) ou
 *      « J'ai eu faux » (M / 2). « J'ai eu faux » → markRevisionResult
 *      pour alimenter wrong_answers.
 *   4. Passage à la fiche suivante (animation fade).
 *
 * Fin de session : récap simple avec score + bouton recommencer.
 */
export function FichesStudyClient({
  questions,
  categoryName,
  categoryColor,
}: Props) {
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [stats, setStats] = useState({ good: 0, bad: 0 });
  const [done, setDone] = useState(false);
  const [, startTransition] = useTransition();
  const lastActionAtRef = useRef<number>(0);

  const q = questions[idx];

  // TTS auto : énoncé au mount, explication à la révélation
  useAutoPlayTTS({
    enonce: q?.enonce ?? "",
    feedbackText:
      revealed && q?.explication
        ? `${q.bonneReponse}. ${q.explication}`
        : null,
  });

  if (questions.length === 0) {
    return (
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
        <Layers
          className="h-12 w-12 text-foreground/40"
          aria-hidden="true"
        />
        <h1 className="font-display text-2xl font-extrabold text-foreground">
          Aucune fiche disponible
        </h1>
        <Link
          href="/revision/fiches"
          className="inline-flex items-center gap-2 rounded-md border border-border bg-card px-4 py-2 text-sm font-bold hover:border-gold/50"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Choisir une autre catégorie
        </Link>
      </main>
    );
  }

  if (done) {
    const total = stats.good + stats.bad;
    const ratio = total > 0 ? Math.round((stats.good / total) * 100) : 0;
    return (
      <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-5 p-8 text-center">
        <motion.div
          initial={{ scale: 0.5, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
          className="flex h-24 w-24 items-center justify-center rounded-3xl bg-gold/20 text-gold-warm shadow-[0_0_64px_rgba(245,183,0,0.45)]"
        >
          <Trophy className="h-12 w-12" aria-hidden="true" fill="currentColor" />
        </motion.div>
        <h1 className="font-display text-3xl font-extrabold text-foreground">
          Session terminée — {ratio}&nbsp;%
        </h1>
        <p className="text-foreground/70">
          <span className="inline-flex items-center gap-1 text-life-green">
            <Check className="h-4 w-4" aria-hidden="true" />
            {stats.good} bonne{stats.good > 1 ? "s" : ""}
          </span>
          {" · "}
          <span className="inline-flex items-center gap-1 text-buzz">
            <X className="h-4 w-4" aria-hidden="true" />
            {stats.bad} erreur{stats.bad > 1 ? "s" : ""}
          </span>
        </p>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button
            variant="gold"
            size="lg"
            onClick={() => {
              setIdx(0);
              setRevealed(false);
              setStats({ good: 0, bad: 0 });
              setDone(false);
            }}
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Recommencer
          </Button>
          <Link
            href="/revision/fiches"
            className="inline-flex h-11 items-center justify-center gap-2 rounded-md border border-border bg-card px-5 text-sm font-bold text-foreground hover:border-gold/50 hover:bg-gold/5"
          >
            <ArrowLeft className="h-4 w-4" aria-hidden="true" />
            Autres catégories
          </Link>
        </div>
      </main>
    );
  }

  if (!q) return null;

  const correctLabel =
    q.type === "quizz_2" || q.type === "quizz_4"
      ? resolveCorrectAnswerLabel(
          q.reponses.find((r) => r.correct)?.text ?? "",
          q.explication,
        ) ?? q.reponses.find((r) => r.correct)?.text ?? ""
      : q.bonneReponse;

  function nextCard(wasCorrect: boolean) {
    if (q && !wasCorrect) {
      // Marque comme erreur dans wrong_answers
      startTransition(async () => {
        await markRevisionResult(q.questionId, false);
      });
    }
    setStats((s) => ({
      good: s.good + (wasCorrect ? 1 : 0),
      bad: s.bad + (wasCorrect ? 0 : 1),
    }));
    if (idx + 1 >= questions.length) {
      setDone(true);
    } else {
      setRevealed(false);
      setIdx((i) => i + 1);
    }
  }

  return (
    <FichesStudyView
      q={q}
      idx={idx}
      total={questions.length}
      revealed={revealed}
      onReveal={() => {
        if (Date.now() - lastActionAtRef.current < 250) return;
        lastActionAtRef.current = Date.now();
        setRevealed(true);
      }}
      onSelfEval={(good) => {
        if (Date.now() - lastActionAtRef.current < 250) return;
        lastActionAtRef.current = Date.now();
        nextCard(good);
      }}
      categoryName={categoryName}
      categoryColor={categoryColor}
      correctLabel={correctLabel}
    />
  );
}

function FichesStudyView({
  q,
  idx,
  total,
  revealed,
  onReveal,
  onSelfEval,
  categoryName,
  categoryColor,
  correctLabel,
}: {
  q: RevQuestion;
  idx: number;
  total: number;
  revealed: boolean;
  onReveal: () => void;
  onSelfEval: (good: boolean) => void;
  categoryName: string | null;
  categoryColor: string | null;
  correctLabel: string;
}) {
  // Raccourcis clavier
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.repeat) return;
      // Si on tape dans un input, ne rien intercepter.
      const tag = (document.activeElement as HTMLElement | null)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;

      if (!revealed) {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          onReveal();
        }
      } else {
        // B ou 1 = J'ai bon ; M ou 2 = J'ai eu faux
        if (
          e.key === "b" ||
          e.key === "B" ||
          e.key === "1"
        ) {
          e.preventDefault();
          onSelfEval(true);
        } else if (
          e.key === "m" ||
          e.key === "M" ||
          e.key === "2"
        ) {
          e.preventDefault();
          onSelfEval(false);
        }
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [revealed, onReveal, onSelfEval]);

  const progress = Math.round(((idx + 1) / total) * 100);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 p-4 sm:p-6">
      {/* Header retour + progress */}
      <div className="flex items-center gap-3">
        <Link
          href="/revision/fiches"
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-semibold text-foreground/80 hover:border-gold/50 hover:bg-gold/10"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Catégories
        </Link>
        <div className="flex-1">
          <p className="text-xs font-bold uppercase tracking-widest text-foreground/55">
            {idx + 1} / {total}
          </p>
          <div className="mt-1 h-2 overflow-hidden rounded-full bg-foreground/10">
            <div
              className="h-full bg-gold transition-all"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>
      </div>

      {/* Catégorie */}
      {categoryName && (
        <span
          className="inline-flex w-fit items-center gap-1.5 rounded-full px-3 py-1 text-xs font-bold uppercase tracking-widest text-on-color"
          style={{ backgroundColor: categoryColor ?? "#F5B700" }}
        >
          <Layers className="h-3.5 w-3.5" aria-hidden="true" />
          {categoryName}
        </span>
      )}

      {/* Énoncé */}
      <motion.div
        key={q.questionId}
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-2xl border border-border bg-card p-6 glow-card"
      >
        <p className="text-xs font-bold uppercase tracking-widest text-foreground/55">
          Question
        </p>
        <h2 className="mt-2 font-display text-2xl font-extrabold text-foreground sm:text-3xl">
          {q.enonce}
        </h2>
        <div className="mt-3 flex justify-end">
          <SpeakerButton text={q.enonce} autoPlay={false} />
        </div>
      </motion.div>

      {/* Action principale : Afficher la réponse OU bouton bon/faux */}
      <AnimatePresence mode="wait">
        {!revealed ? (
          <motion.div
            key="reveal-cta"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="flex flex-col items-center gap-2"
          >
            <Button
              variant="gold"
              size="lg"
              onClick={onReveal}
              className="min-w-[14rem]"
            >
              <Eye className="h-5 w-5" aria-hidden="true" />
              Afficher la réponse
            </Button>
            <p className="text-xs text-foreground/50">
              Espace ou Entrée pour révéler
            </p>
          </motion.div>
        ) : (
          <motion.div
            key="answer"
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="flex flex-col gap-4"
          >
            {/* Réponse + explication révélées */}
            <div className="rounded-2xl border-2 border-life-green/40 bg-life-green/5 p-5">
              <p className="text-xs font-bold uppercase tracking-widest text-life-green">
                Réponse
              </p>
              <p className="mt-2 font-display text-xl font-extrabold text-foreground">
                {correctLabel}
              </p>
              {q.explication && (
                <p className="mt-3 text-sm text-foreground/75">
                  {q.explication}
                </p>
              )}
            </div>

            {/* Auto-évaluation */}
            <div className="flex flex-col gap-2">
              <p className="text-center text-sm font-bold text-foreground/70">
                Tu as eu&nbsp;:
              </p>
              <div className="grid grid-cols-2 gap-3">
                <button
                  type="button"
                  onClick={() => onSelfEval(true)}
                  className="group flex h-14 items-center justify-center gap-2 rounded-xl border-2 border-life-green/40 bg-life-green/10 font-display text-base font-extrabold uppercase tracking-wide text-life-green transition-all hover:border-life-green hover:bg-life-green/20 hover:scale-[1.02]"
                >
                  <Check className="h-5 w-5" aria-hidden="true" />
                  J&apos;ai bon
                  <span className="rounded bg-life-green/20 px-1.5 py-0.5 text-[10px] font-bold tracking-normal">
                    B
                  </span>
                </button>
                <button
                  type="button"
                  onClick={() => onSelfEval(false)}
                  className="group flex h-14 items-center justify-center gap-2 rounded-xl border-2 border-buzz/40 bg-buzz/10 font-display text-base font-extrabold uppercase tracking-wide text-buzz transition-all hover:border-buzz hover:bg-buzz/20 hover:scale-[1.02]"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                  J&apos;ai eu faux
                  <span className="rounded bg-buzz/20 px-1.5 py-0.5 text-[10px] font-bold tracking-normal">
                    M
                  </span>
                </button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Hint discret */}
      <p className="mt-2 text-center text-[11px] text-foreground/45">
        {!revealed
          ? "Astuce : essaie de répondre dans ta tête avant d'afficher la réponse."
          : "B = J'ai bon · M = J'ai eu faux"}
      </p>
    </main>
  );
}
