"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Home,
  Play,
  Repeat,
  Sword,
  Trophy,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { AnswerButton } from "@/components/game/AnswerButton";
import { LifeBar } from "@/components/game/LifeBar";
import { QuestionCard } from "@/components/game/QuestionCard";
import { Timer } from "@/components/game/Timer";
import { Button } from "@/components/ui/button";
import { useGameStore } from "@/stores/gameStore";
import {
  JEU1_TIMER_SECONDS,
  JEU1_TOTAL_QUESTIONS,
  JEU1_XP_PER_CORRECT,
  JEU1_XP_PERFECT_BONUS,
  computeLifeState,
  type Jeu1Question,
} from "@/lib/game-logic/jeu1";
import { playSound } from "@/lib/sounds";
import { saveJeu1Session, type SaveJeu1Result } from "./actions";

interface Jeu1ClientProps {
  initialQuestions: Jeu1Question[];
}

const FEEDBACK_DELAY_CORRECT_MS = 1200;
const FEEDBACK_DELAY_WRONG_MS = 1800;

export function Jeu1Client({ initialQuestions }: Jeu1ClientProps) {
  const router = useRouter();
  const store = useGameStore();

  // Reprise ou nouvelle partie — on réinitialise dès qu'on charge la page.
  // (Pas de reprise automatique dans cette phase — à considérer en Phase 8 parcours.)
  useEffect(() => {
    store.startJeu1(initialQuestions);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const {
    status,
    questions,
    currentIndex,
    wrongCount,
    correctCount,
    answers,
    lastSelectedIdx,
    lastCorrectIdx,
  } = store;

  const questionStartRef = useRef<number>(Date.now());
  const [gameOver, setGameOver] = useState(false);
  const [saveResult, setSaveResult] = useState<SaveJeu1Result | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Entrée en mode "playing" → reset le chrono de question courante
  useEffect(() => {
    if (status === "playing") {
      questionStartRef.current = Date.now();
    }
  }, [status, currentIndex]);

  // Answer dispatcher — click ou clavier passent par ici
  const handleAnswer = useCallback(
    (selectedIdx: number) => {
      if (status !== "playing") return;
      const timeMs = Date.now() - questionStartRef.current;
      const outcome = store.answerQuestion(selectedIdx, timeMs);

      if (outcome.isCorrect) {
        playSound("ding");
      } else {
        playSound("buzz");
      }

      // Planifie l'avancement
      const delay = outcome.isCorrect
        ? FEEDBACK_DELAY_CORRECT_MS
        : FEEDBACK_DELAY_WRONG_MS;

      window.setTimeout(() => {
        if (outcome.gameOver) {
          setGameOver(true);
          store.goToResults();
          playSound("lose");
        } else if (outcome.isLastQuestion) {
          store.goToResults();
          const perfect = correctCount + (outcome.isCorrect ? 1 : 0) === JEU1_TOTAL_QUESTIONS;
          playSound(perfect ? "win" : "ding");
        } else {
          store.nextQuestion();
        }
      }, delay);
    },
    [status, store, correctCount],
  );

  const handleTimerEnd = useCallback(() => {
    if (status !== "playing") return;
    // Temps écoulé → erreur implicite. On envoie un idx -1 qui sera faux.
    // Pour la logique du store, on envoie l'index incorrect (0 ou 1 inverse du bon).
    const q = questions[currentIndex];
    if (!q) return;
    const correctIdx = q.reponses.findIndex((r) => r.correct);
    const wrongIdx = correctIdx === 0 ? 1 : 0;
    handleAnswer(wrongIdx);
  }, [status, questions, currentIndex, handleAnswer]);

  // Contrôles clavier
  useEffect(() => {
    function onKeyDown(e: KeyboardEvent) {
      if (e.repeat) return;
      if (status === "playing") {
        if (e.key === "ArrowLeft" || e.key.toLowerCase() === "a" || e.key === "1") {
          e.preventDefault();
          handleAnswer(0);
        } else if (
          e.key === "ArrowRight" ||
          e.key.toLowerCase() === "b" ||
          e.key === "2"
        ) {
          e.preventDefault();
          handleAnswer(1);
        }
      } else if (status === "intro") {
        if (e.key === " " || e.key === "Enter") {
          e.preventDefault();
          store.beginPlay();
        }
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [status, handleAnswer, store]);

  // Sauvegarde BDD quand on arrive en "results"
  useEffect(() => {
    if (status !== "results") return;
    if (saveResult || isSaving) return;
    setIsSaving(true);
    const duration = Math.round((Date.now() - store.startedAt) / 1000);
    saveJeu1Session({
      answers,
      wrongCount,
      durationSeconds: duration,
    })
      .then((res) => {
        setSaveResult(res);
      })
      .finally(() => setIsSaving(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status]);

  // Loading initial (Zustand n'est pas encore rehydraté)
  if (status === "idle" || questions.length === 0) {
    return (
      <main className="flex flex-1 items-center justify-center p-8">
        <p className="text-navy/50">Chargement…</p>
      </main>
    );
  }

  // ---- INTRO ---------------------------------------------------------------
  if (status === "intro") {
    return <IntroScreen onStart={() => store.beginPlay()} />;
  }

  // ---- RESULTS / GAME OVER -------------------------------------------------
  if (status === "results") {
    return (
      <ResultsScreen
        correctCount={correctCount}
        total={JEU1_TOTAL_QUESTIONS}
        wrongAnswered={answers.filter((a) => !a.isCorrect).length}
        gameOver={gameOver}
        saveResult={saveResult}
        isSaving={isSaving}
        onReplay={() => {
          store.reset();
          router.refresh();
        }}
      />
    );
  }

  // ---- PLAYING / FEEDBACK --------------------------------------------------
  const currentQuestion = questions[currentIndex];
  if (!currentQuestion) return null;
  const lifeState = computeLifeState(wrongCount);

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8">
      {/* En-tête : progression + vies */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm text-navy/70">
          <span className="font-bold text-navy">
            Question {currentIndex + 1}
          </span>
          <span>/ {JEU1_TOTAL_QUESTIONS}</span>
        </div>
        <LifeBar state={lifeState} />
      </div>

      {/* Barre de progression */}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-navy/10">
        <div
          className="h-full bg-gold transition-all"
          style={{
            width: `${((currentIndex + (status === "feedback" ? 1 : 0)) / JEU1_TOTAL_QUESTIONS) * 100}%`,
          }}
        />
      </div>

      {/* Zone centrale : Timer + Question + Réponses */}
      <div className="flex flex-col items-center gap-6">
        <Timer
          key={`timer-${currentIndex}`}
          duration={JEU1_TIMER_SECONDS}
          onEnd={handleTimerEnd}
          paused={status !== "playing"}
        />

        <AnimatePresence mode="wait">
          <QuestionCard
            key={`q-${currentQuestion.id}`}
            keyId={currentQuestion.id}
            enonce={currentQuestion.enonce}
            category={currentQuestion.category?.nom}
            categoryColor={currentQuestion.category?.couleur ?? undefined}
            difficulte={currentQuestion.difficulte}
            className="w-full"
          />
        </AnimatePresence>

        <div className="grid w-full gap-3 sm:grid-cols-2">
          {currentQuestion.reponses.map((r, idx) => {
            let answerState: "idle" | "correct" | "wrong" = "idle";
            if (status === "feedback") {
              if (idx === lastCorrectIdx) answerState = "correct";
              else if (idx === lastSelectedIdx) answerState = "wrong";
            }
            const keyHint = idx === 0 ? "A" : "B";
            return (
              <AnswerButton
                key={idx}
                state={answerState}
                keyHint={keyHint}
                disabled={status !== "playing"}
                onClick={() => handleAnswer(idx)}
              >
                {r.text}
              </AnswerButton>
            );
          })}
        </div>
      </div>

      {/* Hint clavier */}
      <p className="text-center text-xs text-navy/40">
        <ArrowLeft className="inline h-3 w-3 align-text-bottom" aria-hidden="true" />{" "}
        A pour la gauche · B pour la droite{" "}
        <ArrowRight className="inline h-3 w-3 align-text-bottom" aria-hidden="true" />
      </p>
    </main>
  );
}

// ===========================================================================
// Sous-écrans
// ===========================================================================

function IntroScreen({ onStart }: { onStart: () => void }) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-8 p-8 text-center">
      <div className="relative">
        <div className="absolute inset-0 -z-10 animate-sun-pulse rounded-full bg-gold/30 blur-3xl" />
        <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-white shadow-[0_4px_24px_rgba(245,183,0,0.3)]">
          <Play
            className="h-12 w-12 translate-x-0.5 text-gold-warm"
            aria-hidden="true"
            fill="currentColor"
          />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <p className="font-display text-sm font-bold uppercase tracking-widest text-gold-warm">
          Jeu 1
        </p>
        <h1 className="font-display text-4xl font-extrabold text-navy sm:text-5xl">
          Quizz 1 sur 2
        </h1>
        <p className="text-navy/70 sm:text-lg">
          10 questions. Chaque question, 2 réponses possibles.
          <br />
          Tu as <strong className="text-navy">10 secondes</strong> pour répondre.
        </p>
      </div>

      <ul className="flex flex-col gap-2 rounded-xl border border-border bg-white p-5 text-left text-sm text-navy/80 glow-card">
        <li className="flex items-start gap-2">
          <LifeBar state="green" className="mt-1 scale-75" />
          <span>
            <strong>3 vies</strong> : vert → jaune → rouge. Chaque erreur (ou
            temps écoulé) descend d'un cran.
          </span>
        </li>
        <li className="flex items-start gap-2">
          <Sword className="mt-1 h-4 w-4 shrink-0 text-buzz" aria-hidden="true" />
          <span>
            Au <strong>rouge + erreur</strong>, tu bascules en Face-à-Face
            pénalité.
          </span>
        </li>
        <li className="flex items-start gap-2">
          <Trophy className="mt-1 h-4 w-4 shrink-0 text-gold-warm" aria-hidden="true" />
          <span>
            Bonne réponse : <strong>+{JEU1_XP_PER_CORRECT} XP</strong>. Partie
            parfaite : <strong>+{JEU1_XP_PERFECT_BONUS} XP bonus</strong>.
          </span>
        </li>
      </ul>

      <button
        type="button"
        onClick={onStart}
        className="inline-flex items-center gap-2 rounded-xl bg-gold px-10 py-5 font-display text-xl font-extrabold uppercase tracking-wide text-navy shadow-[0_6px_0_0_#e89e00] transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(245,183,0,0.55)] active:translate-y-0 active:shadow-[0_2px_0_0_#e89e00]"
      >
        <Play className="h-5 w-5" aria-hidden="true" fill="currentColor" />
        C'est parti !
      </button>
      <p className="text-xs text-navy/40">
        (Appuie sur Espace ou Entrée pour lancer)
      </p>
    </main>
  );
}

function ResultsScreen({
  correctCount,
  total,
  wrongAnswered,
  gameOver,
  saveResult,
  isSaving,
  onReplay,
}: {
  correctCount: number;
  total: number;
  wrongAnswered: number;
  gameOver: boolean;
  saveResult: SaveJeu1Result | null;
  isSaving: boolean;
  onReplay: () => void;
}) {
  const perfect = correctCount === total && !gameOver;
  const xpGained =
    saveResult?.status === "ok" ? saveResult.xpGained : null;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 18 }}
        className="relative"
      >
        <div
          className={
            gameOver
              ? "flex h-28 w-28 items-center justify-center rounded-3xl bg-buzz/15"
              : perfect
                ? "flex h-28 w-28 items-center justify-center rounded-3xl bg-gold/20 shadow-[0_0_48px_rgba(245,183,0,0.5)]"
                : "flex h-28 w-28 items-center justify-center rounded-3xl bg-sky/15"
          }
        >
          {gameOver ? (
            <Sword className="h-14 w-14 text-buzz" aria-hidden="true" />
          ) : perfect ? (
            <Trophy
              className="h-14 w-14 text-gold-warm"
              aria-hidden="true"
              fill="currentColor"
            />
          ) : (
            <BarChart3 className="h-14 w-14 text-sky" aria-hidden="true" />
          )}
        </div>
      </motion.div>

      <div className="flex flex-col gap-2">
        <h1 className="font-display text-4xl font-extrabold text-navy">
          {gameOver
            ? "Face-à-Face !"
            : perfect
              ? "Partie parfaite !"
              : "Partie terminée"}
        </h1>
        <p className="text-navy/70 sm:text-lg">
          {gameOver
            ? "Tu as perdu toutes tes vies. Tu basculeras en Face-à-Face pénalité dès qu'il sera disponible (Phase 6)."
            : perfect
              ? "10 / 10, pas une seule erreur. Chapeau bas."
              : `Tu as répondu correctement à ${correctCount} question${correctCount > 1 ? "s" : ""} sur ${total}.`}
        </p>
      </div>

      {/* Stats */}
      <div className="grid w-full grid-cols-3 gap-3 text-center">
        <StatCard label="Correctes" value={String(correctCount)} tone="green" />
        <StatCard
          label="Ratées"
          value={String(wrongAnswered)}
          tone="buzz"
        />
        <StatCard
          label="XP gagnés"
          value={
            isSaving
              ? "…"
              : xpGained !== null
                ? `+${xpGained}`
                : saveResult?.status === "error"
                  ? "—"
                  : "…"
          }
          tone="gold"
        />
      </div>

      {saveResult?.status === "error" && (
        <p
          className="flex items-center gap-2 rounded-md border border-buzz/40 bg-buzz/10 px-3 py-2 text-sm text-buzz"
          role="alert"
        >
          <XCircle className="h-4 w-4" aria-hidden="true" />
          Sauvegarde BDD échouée : {saveResult.message}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button variant="gold" size="lg" onClick={onReplay}>
          <Repeat className="h-4 w-4" aria-hidden="true" />
          Rejouer
        </Button>
        <Link
          href="/revision"
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-gold/50 bg-white/60 px-4 text-sm font-semibold text-navy transition-colors hover:bg-gold/20 hover:border-gold"
        >
          <BarChart3 className="h-4 w-4" aria-hidden="true" />
          Mes erreurs
        </Link>
        <Link
          href="/"
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-gold/50 bg-white/60 px-4 text-sm font-semibold text-navy transition-colors hover:bg-gold/20 hover:border-gold"
        >
          <Home className="h-4 w-4" aria-hidden="true" />
          Accueil
        </Link>
      </div>
    </main>
  );
}

function StatCard({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone: "gold" | "green" | "buzz";
}) {
  const bg = {
    gold: "bg-gold/15 text-gold-warm",
    green: "bg-life-green/15 text-life-green",
    buzz: "bg-buzz/15 text-buzz",
  }[tone];
  return (
    <div className="flex flex-col gap-1 rounded-xl border border-border bg-card p-4 glow-card">
      <div
        className={`mx-auto flex h-10 w-10 items-center justify-center rounded-lg ${bg} font-display text-sm font-bold`}
      >
        {value}
      </div>
      <p className="text-xs uppercase tracking-wider text-navy/60">{label}</p>
    </div>
  );
}
