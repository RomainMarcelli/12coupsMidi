"use client";

import { useEffect, useState, useTransition } from "react";
import { ArrowRight, Check, RotateCcw, Send, Trophy, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { AnswerButton } from "@/components/game/AnswerButton";
import { FavoriteStar } from "@/components/game/FavoriteStar";
import { SpeakerButton } from "@/components/game/SpeakerButton";
import { Button } from "@/components/ui/button";
import { resolveCorrectAnswerLabel } from "@/lib/game-logic/answer-display";
import { isMatch } from "@/lib/matching/fuzzy-match";
import { buildTTSFeedbackText, useAutoPlayTTS } from "@/lib/tts-helpers";
import { playSound } from "@/lib/sounds";
import { cn } from "@/lib/utils";
import type { RevQuestion } from "@/lib/revision/types";
import { markRevisionResult } from "../actions";

interface QuizPlayerProps {
  questions: RevQuestion[];
  /** Callback de fin de session. */
  onDone?: (stats: { correct: number; wrong: number }) => void;
  /** Si true (défaut), une mauvaise réponse réécrit dans wrong_answers via markRevisionResult. */
  trackWrong?: boolean;
}

type Phase =
  | { kind: "playing"; idx: number; correct: number; wrong: number }
  | { kind: "done"; correct: number; wrong: number };

export function QuizPlayer({
  questions,
  onDone,
  trackWrong = true,
}: QuizPlayerProps) {
  const [phase, setPhase] = useState<Phase>({
    kind: "playing",
    idx: 0,
    correct: 0,
    wrong: 0,
  });

  if (phase.kind === "done") {
    return (
      <DoneScreen
        correct={phase.correct}
        wrong={phase.wrong}
        total={questions.length}
        onRestart={() =>
          setPhase({ kind: "playing", idx: 0, correct: 0, wrong: 0 })
        }
      />
    );
  }

  const q = questions[phase.idx];
  if (!q) {
    onDone?.({ correct: phase.correct, wrong: phase.wrong });
    setPhase({ kind: "done", correct: phase.correct, wrong: phase.wrong });
    return null;
  }

  return (
    <PlayCard
      key={q.questionId}
      question={q}
      index={phase.idx}
      total={questions.length}
      trackWrong={trackWrong}
      onDone={(isCorrect) => {
        const next = phase.idx + 1;
        const correct = phase.correct + (isCorrect ? 1 : 0);
        const wrong = phase.wrong + (isCorrect ? 0 : 1);
        if (next >= questions.length) {
          onDone?.({ correct, wrong });
          setPhase({ kind: "done", correct, wrong });
        } else {
          setPhase({ kind: "playing", idx: next, correct, wrong });
        }
      }}
    />
  );
}

// ---------------------------------------------------------------------------

function PlayCard({
  question,
  index,
  total,
  trackWrong,
  onDone,
}: {
  question: RevQuestion;
  index: number;
  total: number;
  trackWrong: boolean;
  onDone: (isCorrect: boolean) => void;
}) {
  const [feedback, setFeedback] = useState<
    | null
    | {
        kind: "correct" | "wrong";
        correctText: string;
      }
  >(null);
  const [, startTransition] = useTransition();

  // Lecture auto TTS : énoncé + choix (si quizz_2/4) au mount, puis
  // feedback complet quand l'utilisateur a répondu.
  const ttsFeedback = feedback
    ? buildTTSFeedbackText({
        isCorrect: feedback.kind === "correct",
        correctLabel:
          feedback.kind === "wrong"
            ? resolveCorrectAnswerLabel(
                feedback.correctText,
                question.explication,
              )
            : null,
        explanation: question.explication,
      })
    : null;
  useAutoPlayTTS({
    enonce: question.enonce,
    choices:
      question.type === "quizz_2" || question.type === "quizz_4"
        ? question.reponses.map((r) => r.text)
        : undefined,
    feedbackText: ttsFeedback,
  });

  function record(isCorrect: boolean, correctText: string) {
    if (feedback) return;
    if (isCorrect) playSound("ding");
    else playSound("buzz");
    setFeedback({ kind: isCorrect ? "correct" : "wrong", correctText });
    if (trackWrong) {
      startTransition(async () => {
        await markRevisionResult(question.questionId, isCorrect);
      });
    }
  }

  // Quand le feedback est affiché, la touche Entrée doit déclencher
  // "Passer à la suivante" (équivalent du clic bouton "Suivante").
  // On évite le double-handling si le focus est encore dans l'input
  // de saisie de réponse (TextStage).
  useEffect(() => {
    if (!feedback) return;
    const fb = feedback; // capture pour TS narrowing dans le handler
    function onKey(e: KeyboardEvent) {
      if (e.key !== "Enter") return;
      // Si l'utilisateur tape encore dans un input/textarea, on n'intercepte
      // pas (Entrée a alors d'autres usages comme valider la saisie).
      const active = document.activeElement;
      const tag = active?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA") return;
      e.preventDefault();
      onDone(fb.kind === "correct");
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [feedback, onDone]);

  const progress = Math.round(((index + 1) / total) * 100);

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 p-4 sm:p-6">
      {/* Progress */}
      <div className="flex items-center gap-3">
        <p className="text-xs font-bold uppercase tracking-widest text-foreground/60">
          {index + 1} / {total}
        </p>
        <div className="h-2 flex-1 overflow-hidden rounded-full bg-foreground/10">
          <div
            className="h-full bg-gold transition-all"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      {/* Meta */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          {question.category && (
            <span
              className="inline-flex items-center rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide text-navy"
              style={{ backgroundColor: question.category.couleur ?? "#F5B700" }}
            >
              {question.category.nom}
            </span>
          )}
          <span className="rounded-full bg-foreground/10 px-2 py-0.5 text-xs font-bold text-foreground/60">
            Difficulté {question.difficulte}
          </span>
        </div>
        <FavoriteStar questionId={question.questionId} />
      </div>

      {/* Énoncé */}
      <div className="rounded-2xl border border-border bg-card p-5 glow-card">
        <h2 className="font-display text-xl font-extrabold text-foreground sm:text-2xl">
          {question.enonce}
        </h2>
      </div>
      <div className="flex justify-center">
        <SpeakerButton
          text={question.enonce}
          choices={
            question.type === "quizz_2" || question.type === "quizz_4"
              ? question.reponses.map((r) => r.text)
              : undefined
          }
          explanation={
            feedback?.kind === "wrong" ? question.explication : undefined
          }
          autoPlay={false}
        />
      </div>

      {/* UI selon le type */}
      {question.type === "quizz_2" || question.type === "quizz_4" ? (
        <ChoiceStage
          reponses={question.reponses}
          disabled={feedback !== null}
          onAnswer={(idx) => {
            const r = question.reponses[idx];
            const correct = r?.correct === true;
            const correctText = firstCorrectText(question.reponses);
            record(correct, correctText);
          }}
          feedback={feedback}
        />
      ) : (
        <TextStage
          disabled={feedback !== null}
          onAnswer={(val) =>
            record(
              isMatch(val, question.bonneReponse, question.alias),
              question.bonneReponse,
            )
          }
          bonneReponse={question.bonneReponse}
          feedback={feedback}
        />
      )}

      {/* Feedback + Continue */}
      <AnimatePresence>
        {feedback && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "rounded-xl border p-4",
              feedback.kind === "correct"
                ? "border-life-green/40 bg-life-green/10"
                : "border-buzz/40 bg-buzz/10",
            )}
          >
            <p
              className={cn(
                "font-display font-bold",
                feedback.kind === "correct" ? "text-life-green" : "text-buzz",
              )}
            >
              {feedback.kind === "correct"
                ? "Bonne réponse"
                : "Mauvaise réponse"}
            </p>
            {feedback.kind === "wrong" &&
              (() => {
                const label = resolveCorrectAnswerLabel(
                  feedback.correctText,
                  question.explication,
                );
                return label ? (
                  <p className="mt-1 text-foreground">
                    La bonne réponse&nbsp;:{" "}
                    <strong className="text-life-green">{label}</strong>
                  </p>
                ) : null;
              })()}
            {question.explication && (
              <p
                className={cn(
                  "text-sm",
                  feedback.kind === "wrong" &&
                    !resolveCorrectAnswerLabel(
                      feedback.correctText,
                      question.explication,
                    )
                    ? "mt-1 font-semibold text-foreground"
                    : "mt-2 text-foreground/70",
                )}
              >
                {question.explication}
              </p>
            )}
            <div className="mt-3 flex justify-end">
              <Button
                variant="gold"
                size="sm"
                onClick={() => onDone(feedback.kind === "correct")}
              >
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
                {index + 1 < total ? "Suivante" : "Terminer"}
              </Button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

function firstCorrectText(reponses: { text: string; correct: boolean }[]): string {
  return reponses.find((r) => r.correct)?.text ?? "—";
}

function ChoiceStage({
  reponses,
  disabled,
  onAnswer,
  feedback,
}: {
  reponses: { text: string; correct: boolean }[];
  disabled: boolean;
  onAnswer: (idx: number) => void;
  feedback: { kind: "correct" | "wrong"; correctText: string } | null;
}) {
  const correctIdx = reponses.findIndex((r) => r.correct);
  return (
    <div className="grid gap-3 sm:grid-cols-2">
      {reponses.map((r, idx) => {
        let state: "idle" | "correct" | "wrong" = "idle";
        if (feedback && idx === correctIdx) state = "correct";
        return (
          <AnswerButton
            key={idx}
            state={state}
            disabled={disabled}
            onClick={() => onAnswer(idx)}
          >
            {r.text}
          </AnswerButton>
        );
      })}
    </div>
  );
}

function TextStage({
  disabled,
  onAnswer,
  bonneReponse,
  feedback,
}: {
  disabled: boolean;
  onAnswer: (value: string) => void;
  bonneReponse: string;
  feedback: { kind: "correct" | "wrong"; correctText: string } | null;
}) {
  const [val, setVal] = useState("");
  return (
    <div className="flex items-stretch gap-2">
      <input
        type="text"
        value={val}
        onChange={(e) => setVal(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && val.trim() && !disabled) {
            e.preventDefault();
            onAnswer(val.trim());
          }
        }}
        placeholder={feedback ? bonneReponse : "Ta réponse…"}
        disabled={disabled}
        autoFocus
        className="h-11 flex-1 rounded-md border border-border bg-card px-3 text-base text-foreground placeholder-foreground/40 focus:border-gold focus:outline-none disabled:opacity-50"
      />
      <button
        type="button"
        onClick={() => onAnswer(val.trim())}
        disabled={disabled || val.trim() === ""}
        className="flex h-11 items-center gap-1.5 rounded-md bg-gold px-4 font-bold text-navy shadow-[0_4px_0_0_#e89e00] transition-all hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-50"
      >
        <Send className="h-4 w-4" aria-hidden="true" />
        Valider
      </button>
    </div>
  );
}

function DoneScreen({
  correct,
  wrong,
  total,
  onRestart,
}: {
  correct: number;
  wrong: number;
  total: number;
  onRestart: () => void;
}) {
  const ratio = total > 0 ? Math.round((correct / total) * 100) : 0;
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-5 p-8 text-center">
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 15 }}
        className="flex h-28 w-28 items-center justify-center rounded-3xl bg-gold/20 text-gold-warm shadow-[0_0_64px_rgba(245,183,0,0.45)]"
      >
        <Trophy className="h-14 w-14" aria-hidden="true" fill="currentColor" />
      </motion.div>
      <div>
        <h1 className="font-display text-3xl font-extrabold text-foreground">
          Session terminée — {ratio} %
        </h1>
        <p className="mt-2 text-foreground/70">
          <span className="inline-flex items-center gap-1 text-life-green">
            <Check className="h-4 w-4" aria-hidden="true" />
            {correct} bonne{correct > 1 ? "s" : ""}
          </span>
          {" · "}
          <span className="inline-flex items-center gap-1 text-buzz">
            <X className="h-4 w-4" aria-hidden="true" />
            {wrong} erreur{wrong > 1 ? "s" : ""}
          </span>
        </p>
      </div>
      <Button variant="gold" size="lg" onClick={onRestart}>
        <RotateCcw className="h-4 w-4" aria-hidden="true" />
        Recommencer
      </Button>
    </main>
  );
}
