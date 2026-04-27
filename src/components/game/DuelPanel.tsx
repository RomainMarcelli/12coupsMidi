"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  Crown,
  Play,
  Sword,
  Swords,
  Target,
  Trophy,
} from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { QuestionCard } from "@/components/game/QuestionCard";
import { AnswerButton } from "@/components/game/AnswerButton";
import { SpeakerButton } from "@/components/game/SpeakerButton";
import {
  pickDuelQuestion,
  pickDuelThemes,
  resolveDuel,
  shuffleDuelAnswers,
  type DuelQuestion,
  type DuelResult,
  type DuelTheme,
} from "@/lib/game-logic/duel";
import {
  BOT_PROFILES,
  botAnswersCorrectly,
  botResponseDelayMs,
  type BotDifficulty,
} from "@/lib/game-logic/faceAFace";
import type { PlayerConfig } from "@/lib/game-logic/players";
import { resolveCorrectAnswerLabel } from "@/lib/game-logic/answer-display";
import { buildTTSFeedbackText, useAutoPlayTTS } from "@/lib/tts-helpers";
import { cn } from "@/lib/utils";
import { playSound } from "@/lib/sounds";

export interface DuelPanelProps {
  rougePlayer: PlayerConfig;
  otherPlayers: PlayerConfig[];
  themes: DuelTheme[];
  /** Si true, pas de choix de thème, un seul imposé (2e Duel après Coup par Coup). */
  isSecondDuel?: boolean;
  botDifficulty: BotDifficulty;
  onComplete: (result: DuelResult) => void;
}

type Phase =
  | "choose-adversary"
  | "choose-theme"
  | "question"
  | "feedback"
  | "result";

const FEEDBACK_DURATION_MS = 1800;
const BOT_CHOICE_DELAY_MS = 1200;

export function DuelPanel({
  rougePlayer,
  otherPlayers,
  themes,
  isSecondDuel = false,
  botDifficulty,
  onComplete,
}: DuelPanelProps) {
  const [phase, setPhase] = useState<Phase>("choose-adversary");
  const [adversaryId, setAdversaryId] = useState<string | null>(null);
  const [proposedThemes, setProposedThemes] = useState<DuelTheme[]>([]);
  const [chosenTheme, setChosenTheme] = useState<DuelTheme | null>(null);
  const [duelQuestion, setDuelQuestion] = useState<DuelQuestion | null>(null);
  const [lastSelectedIdx, setLastSelectedIdx] = useState<number | null>(null);
  const [lastCorrectIdx, setLastCorrectIdx] = useState<number | null>(null);
  const [result, setResult] = useState<DuelResult | null>(null);

  const questionStartedAtRef = useRef<number>(0);

  const adversary = useMemo(
    () => otherPlayers.find((p) => p.id === adversaryId) ?? null,
    [otherPlayers, adversaryId],
  );

  // Lecture auto TTS pour la question du duel (4 choix → "A, B, C ou D"),
  // puis lecture du feedback dès que le joueur a répondu.
  const isWrongFeedback =
    phase === "feedback" &&
    duelQuestion !== null &&
    lastSelectedIdx !== null &&
    lastCorrectIdx !== null &&
    lastSelectedIdx !== lastCorrectIdx;
  const isCorrectFeedback =
    phase === "feedback" &&
    duelQuestion !== null &&
    lastSelectedIdx !== null &&
    lastCorrectIdx !== null &&
    lastSelectedIdx === lastCorrectIdx;
  const ttsFeedback = isWrongFeedback
    ? buildTTSFeedbackText({
        isCorrect: false,
        correctLabel: resolveCorrectAnswerLabel(
          duelQuestion!.reponses[lastCorrectIdx!]?.text ?? null,
          duelQuestion!.explication ?? null,
        ),
        explanation: duelQuestion!.explication ?? null,
      })
    : isCorrectFeedback
      ? buildTTSFeedbackText({
          isCorrect: true,
          explanation: duelQuestion!.explication ?? null,
        })
      : null;
  useAutoPlayTTS({
    enonce:
      phase === "question" || phase === "feedback"
        ? (duelQuestion?.enonce ?? "")
        : "",
    choices: duelQuestion?.reponses.map((r) => r.text) ?? [],
    feedbackText: ttsFeedback,
  });

  // Le bot choisit automatiquement un adversaire
  useEffect(() => {
    if (phase !== "choose-adversary") return;
    if (!rougePlayer.isBot) return;
    if (otherPlayers.length === 0) return;
    const id = window.setTimeout(() => {
      const pick =
        otherPlayers[Math.floor(Math.random() * otherPlayers.length)];
      if (pick) setAdversaryId(pick.id);
    }, BOT_CHOICE_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [phase, rougePlayer, otherPlayers]);

  // Passage à la phase "choose-theme" dès qu'un adversaire est choisi
  useEffect(() => {
    if (phase !== "choose-adversary") return;
    if (!adversaryId) return;
    // Prépare les thèmes proposés (1 ou 2 selon isSecondDuel)
    const count = isSecondDuel ? 1 : 2;
    const proposed = pickDuelThemes(themes, count as 1 | 2);
    setProposedThemes(proposed);
    if (proposed.length === 1) {
      // Thème imposé : saute directement au choix auto
      setChosenTheme(proposed[0] ?? null);
      setPhase("question");
    } else {
      setPhase("choose-theme");
    }
  }, [phase, adversaryId, themes, isSecondDuel]);

  // Si l'adversaire est un bot, il choisit automatiquement un thème
  useEffect(() => {
    if (phase !== "choose-theme") return;
    if (!adversary?.isBot) return;
    const id = window.setTimeout(() => {
      const pick =
        proposedThemes[Math.floor(Math.random() * proposedThemes.length)];
      if (pick) {
        setChosenTheme(pick);
        setPhase("question");
      }
    }, BOT_CHOICE_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [phase, adversary, proposedThemes]);

  // Prépare la question quand on entre en "question"
  useEffect(() => {
    if (phase !== "question") return;
    if (!chosenTheme) return;
    const raw = pickDuelQuestion(chosenTheme);
    if (!raw) return;
    const shuffled = shuffleDuelAnswers(raw);
    setDuelQuestion(shuffled);
    setLastSelectedIdx(null);
    setLastCorrectIdx(null);
    questionStartedAtRef.current = performance.now();
  }, [phase, chosenTheme]);

  // Bot answer (si adversary est bot)
  useEffect(() => {
    if (phase !== "question") return;
    if (!adversary?.isBot) return;
    if (!duelQuestion) return;
    const delay = botResponseDelayMs(botDifficulty);
    const id = window.setTimeout(() => {
      const correct = botAnswersCorrectly(botDifficulty);
      const correctIdx = duelQuestion.reponses.findIndex((r) => r.correct);
      const wrongIdx = correctIdx === 0 ? 1 : correctIdx === 1 ? 2 : 0;
      const chosenIdx = correct ? correctIdx : wrongIdx;
      handleAnswerInternal(chosenIdx);
    }, delay);
    return () => window.clearTimeout(id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase, adversary, duelQuestion, botDifficulty]);

  const handleAnswerInternal = useCallback(
    (idx: number) => {
      if (!duelQuestion || !adversaryId) return;
      const correctIdx = duelQuestion.reponses.findIndex((r) => r.correct);
      const chosen = duelQuestion.reponses[idx];
      const isCorrect = chosen?.correct === true;
      setLastSelectedIdx(idx);
      setLastCorrectIdx(correctIdx);

      if (isCorrect) playSound("ding");
      else playSound("buzz");

      const duelResult = resolveDuel({
        rougeId: rougePlayer.id,
        adversaryId,
        adversaryAnsweredCorrectly: isCorrect,
        questionId: duelQuestion.id,
      });
      setResult(duelResult);
      setPhase("feedback");
      window.setTimeout(() => {
        setPhase("result");
        if (duelResult.winnerId === rougePlayer.id) {
          playSound("lose");
        } else {
          playSound("win");
        }
      }, FEEDBACK_DURATION_MS);
    },
    [duelQuestion, adversaryId, rougePlayer.id],
  );

  const handleHumanAnswer = useCallback(
    (idx: number) => {
      if (phase !== "question") return;
      if (adversary?.isBot) return;
      handleAnswerInternal(idx);
    },
    [phase, adversary, handleAnswerInternal],
  );

  // Plus de handleTimerEnd : le duel n'a PAS de timer (cf. Bug #4 du
  // plan post-tests). Le joueur réfléchit tranquillement.

  // -------- Rendu --------

  if (phase === "choose-adversary") {
    return (
      <ChooseAdversaryPanel
        rougePlayer={rougePlayer}
        otherPlayers={otherPlayers}
        onPick={(id) => setAdversaryId(id)}
      />
    );
  }

  if (phase === "choose-theme") {
    return (
      <ChooseThemePanel
        adversary={adversary}
        themes={proposedThemes}
        onPick={(t) => {
          setChosenTheme(t);
          setPhase("question");
        }}
      />
    );
  }

  if (phase === "result" && result) {
    const winner = result.winnerId === rougePlayer.id
      ? rougePlayer
      : (otherPlayers.find((p) => p.id === result.winnerId) ?? null);
    const eliminated = result.eliminatedId === rougePlayer.id
      ? rougePlayer
      : (otherPlayers.find((p) => p.id === result.eliminatedId) ?? null);
    return (
      <DuelResultPanel
        winner={winner}
        eliminated={eliminated}
        adversaryAnsweredCorrectly={result.adversaryAnsweredCorrectly}
        correctAnswer={
          duelQuestion?.reponses.find((r) => r.correct)?.text ?? "?"
        }
        onContinue={() => onComplete(result)}
      />
    );
  }

  // phase === 'question' or 'feedback'
  if (!duelQuestion || !chosenTheme || !adversary) return null;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 p-4 sm:p-6">
      <div className="flex flex-col items-center gap-2">
        <span
          className="rounded-full px-3 py-1 text-xs font-bold uppercase tracking-widest text-navy"
          style={{ backgroundColor: chosenTheme.couleur ?? "#F5B700" }}
        >
          Thème · {chosenTheme.label}
        </span>
        <p className="font-display text-sm font-bold text-navy">
          {adversary.pseudo} joue {adversary.isBot && "(bot)"}
        </p>
      </div>

      <QuestionCard
        keyId={duelQuestion.id}
        enonce={duelQuestion.enonce}
        difficulte={duelQuestion.difficulte}
      />
      <div className="flex justify-center">
        <SpeakerButton
          text={duelQuestion.enonce}
          choices={duelQuestion.reponses.map((r) => r.text)}
          explanation={
            phase === "feedback" ? duelQuestion.explication : undefined
          }
          autoPlay={false}
        />
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {duelQuestion.reponses.map((r, idx) => {
          let state: "idle" | "correct" | "wrong" = "idle";
          if (phase === "feedback") {
            if (idx === lastCorrectIdx) state = "correct";
            else if (idx === lastSelectedIdx) state = "wrong";
          }
          return (
            <AnswerButton
              key={idx}
              state={state}
              disabled={phase !== "question" || adversary.isBot}
              onClick={() => handleHumanAnswer(idx)}
            >
              {r.text}
            </AnswerButton>
          );
        })}
      </div>
    </main>
  );
}

// =============================================================================
// Sub-panels
// =============================================================================

function ChooseAdversaryPanel({
  rougePlayer,
  otherPlayers,
  onPick,
}: {
  rougePlayer: PlayerConfig;
  otherPlayers: PlayerConfig[];
  onPick: (id: string) => void;
}) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-5 p-6 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-buzz/15 text-buzz">
        <Swords className="h-10 w-10" aria-hidden="true" />
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-xs font-bold uppercase tracking-widest text-buzz">
          Duel
        </p>
        <h1 className="font-display text-3xl font-extrabold text-navy">
          {rougePlayer.pseudo} désigne un adversaire
        </h1>
        <p className="text-sm text-navy/60">
          Bonne réponse de l&apos;adversaire → {rougePlayer.pseudo} éliminé.
          Mauvaise → adversaire éliminé.
        </p>
      </div>

      {rougePlayer.isBot && (
        <p className="animate-pulse text-sm text-sky">
          Le bot {rougePlayer.pseudo} choisit…
        </p>
      )}

      <div className="grid w-full gap-2">
        {otherPlayers.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onPick(p.id)}
            disabled={rougePlayer.isBot}
            className={cn(
              "flex items-center gap-3 rounded-xl border border-border bg-white p-3 text-left transition-all",
              !rougePlayer.isBot &&
                "hover:border-buzz/60 hover:bg-buzz/5 hover:scale-[1.01]",
              rougePlayer.isBot && "cursor-not-allowed opacity-70",
            )}
          >
            <div
              className={cn(
                "flex h-10 w-10 items-center justify-center rounded-lg",
                p.isBot ? "bg-sky/15 text-sky" : "bg-gold/20 text-gold-warm",
              )}
            >
              {p.isBot ? (
                <Bot className="h-5 w-5" aria-hidden="true" />
              ) : (
                <Crown className="h-5 w-5" aria-hidden="true" />
              )}
            </div>
            <span className="flex-1 font-display font-bold text-navy">
              {p.pseudo}
            </span>
            <Target className="h-5 w-5 text-buzz/60" aria-hidden="true" />
          </button>
        ))}
      </div>
    </main>
  );
}

function ChooseThemePanel({
  adversary,
  themes,
  onPick,
}: {
  adversary: PlayerConfig | null;
  themes: DuelTheme[];
  onPick: (theme: DuelTheme) => void;
}) {
  if (!adversary) return null;
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-5 p-6 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gold/15 text-gold-warm">
        <Target className="h-10 w-10" aria-hidden="true" />
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-xs font-bold uppercase tracking-widest text-gold-warm">
          À toi de choisir
        </p>
        <h1 className="font-display text-3xl font-extrabold text-navy">
          {adversary.pseudo}, choisis un thème
        </h1>
      </div>

      {adversary.isBot && (
        <p className="animate-pulse text-sm text-sky">
          Le bot choisit son thème…
        </p>
      )}

      <div className="grid w-full gap-3 sm:grid-cols-2">
        {themes.map((theme) => (
          <button
            key={theme.categoryId}
            type="button"
            onClick={() => onPick(theme)}
            disabled={adversary.isBot}
            className={cn(
              "flex flex-col items-center gap-2 rounded-2xl border-2 p-6 transition-all",
              !adversary.isBot
                ? "border-border bg-white hover:border-gold hover:bg-gold/5 hover:scale-[1.02]"
                : "cursor-not-allowed border-border bg-white/50 opacity-70",
            )}
          >
            <div
              className="flex h-12 w-12 items-center justify-center rounded-xl text-navy"
              style={{ backgroundColor: theme.couleur ?? "#F5B700" }}
            >
              <Target className="h-6 w-6" aria-hidden="true" />
            </div>
            <span className="font-display text-lg font-bold text-navy">
              {theme.label}
            </span>
            <span className="text-xs text-navy/50">
              {theme.questions.length} question
              {theme.questions.length > 1 ? "s" : ""}
            </span>
          </button>
        ))}
      </div>
    </main>
  );
}

function DuelResultPanel({
  winner,
  eliminated,
  adversaryAnsweredCorrectly,
  correctAnswer,
  onContinue,
}: {
  winner: PlayerConfig | null;
  eliminated: PlayerConfig | null;
  adversaryAnsweredCorrectly: boolean;
  correctAnswer: string;
  onContinue: () => void;
}) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-5 p-8 text-center">
      <AnimatePresence>
        <motion.div
          key="result"
          initial={{ scale: 0.7, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 16 }}
          className={cn(
            "flex h-28 w-28 items-center justify-center rounded-3xl",
            adversaryAnsweredCorrectly
              ? "bg-life-green/25 shadow-[0_0_48px_rgba(46,204,113,0.5)]"
              : "bg-buzz/20 shadow-[0_0_48px_rgba(230,57,70,0.5)]",
          )}
        >
          {adversaryAnsweredCorrectly ? (
            <Trophy
              className="h-14 w-14 text-life-green"
              aria-hidden="true"
              fill="currentColor"
            />
          ) : (
            <Sword className="h-14 w-14 text-buzz" aria-hidden="true" />
          )}
        </motion.div>
      </AnimatePresence>

      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-navy/50">
          Duel terminé
        </p>
        <h1 className="mt-1 font-display text-3xl font-extrabold text-navy">
          {winner ? `${winner.pseudo} gagne` : "Vainqueur"}
        </h1>
      </div>

      {eliminated && (
        <p className="text-sm text-navy/70">
          <strong className="text-buzz">{eliminated.pseudo}</strong> est
          éliminé.
        </p>
      )}

      <p className="rounded-md border border-border bg-white px-4 py-2 text-sm text-navy/80">
        Bonne réponse :{" "}
        <strong className="text-navy">{correctAnswer}</strong>
      </p>

      <button
        type="button"
        onClick={onContinue}
        className="inline-flex items-center gap-2 rounded-xl bg-gold px-8 py-4 font-display text-lg font-extrabold uppercase tracking-wide text-navy shadow-[0_6px_0_0_#e89e00] transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(245,183,0,0.55)]"
      >
        <Play className="h-5 w-5" aria-hidden="true" fill="currentColor" />
        Continuer
      </button>
    </main>
  );
}

// Prevent unused imports warning for BOT_PROFILES
void BOT_PROFILES;
