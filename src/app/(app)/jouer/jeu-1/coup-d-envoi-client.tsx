"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  BarChart3,
  Bot,
  Crown,
  Dices,
  Home,
  Play,
  Repeat,
  Swords,
  Trophy,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { AnswerButton } from "@/components/game/AnswerButton";
import { DuelPanel } from "@/components/game/DuelPanel";
import { FeedbackCountdown } from "@/components/game/FeedbackCountdown";
import { LifeBar } from "@/components/game/LifeBar";
import { QuestionCard } from "@/components/game/QuestionCard";
import { SpeakerButton } from "@/components/game/SpeakerButton";
import { PlayerSetup } from "@/components/game/PlayerSetup";
import { Button } from "@/components/ui/button";
import { Timer } from "@/components/game/Timer";
import {
  CE_MAX_ERRORS,
  CE_TIMER_SECONDS,
  type CeAnswerLog,
  type CeQuestion,
  ceIsPlayerOut,
  ceLifeState,
  formatLabel,
  stripFormatPrefix,
} from "@/lib/game-logic/coup-d-envoi";
import type { DuelResult, DuelTheme } from "@/lib/game-logic/duel";
import {
  botAnswersCorrectly,
  botResponseDelayMs,
  type BotDifficulty,
} from "@/lib/game-logic/faceAFace";
import type { MultiConfig, PlayerConfig } from "@/lib/game-logic/players";
import { cn } from "@/lib/utils";
import { playSound } from "@/lib/sounds";
import { saveCeSession, type SaveCeResult } from "./actions";

type Phase =
  | "setup"
  | "intro"
  | "playing"
  | "feedback"
  | "rouge-announce"
  | "duel"
  | "results";

interface CoupDEnvoiClientProps {
  initialQuestions: CeQuestion[];
  duelThemes: DuelTheme[];
  userPseudo: string;
}

const FEEDBACK_DELAY_CORRECT_MS = 1200;
const FEEDBACK_DELAY_WRONG_MS = 1800;
const ROUGE_ANNOUNCE_DURATION_MS = 3200;

export function CoupDEnvoiClient({
  initialQuestions,
  duelThemes,
  userPseudo,
}: CoupDEnvoiClientProps) {
  const router = useRouter();

  // Setup / config
  const [phase, setPhase] = useState<Phase>("setup");
  const [config, setConfig] = useState<MultiConfig | null>(null);

  // Game state
  const [playersErrors, setPlayersErrors] = useState<Record<string, number>>({});
  const [currentPlayerIdx, setCurrentPlayerIdx] = useState(0);
  const [currentQIdx, setCurrentQIdx] = useState(0);
  const [rougePlayerId, setRougePlayerId] = useState<string | null>(null);
  const [answers, setAnswers] = useState<CeAnswerLog[]>([]);
  const [lastSelectedIdx, setLastSelectedIdx] = useState<number | null>(null);
  const [lastCorrectIdx, setLastCorrectIdx] = useState<number | null>(null);
  const [duelResult, setDuelResult] = useState<DuelResult | null>(null);

  // Persistance
  const [saveResult, setSaveResult] = useState<SaveCeResult | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  // Refs pour timing
  const questionStartedAtRef = useRef<number>(0);
  const gameStartedAtRef = useRef<number>(0);

  const players = config?.players ?? [];
  const currentPlayer = players[currentPlayerIdx];
  const currentPlayerId = currentPlayer?.id ?? "";
  const currentQuestion = initialQuestions[currentQIdx];
  const botDifficulty: BotDifficulty = config?.botDifficulty ?? "moyen";

  // ---------------------------------------------------------------------------
  // Setup ready
  // ---------------------------------------------------------------------------
  const handleSetupReady = useCallback((cfg: MultiConfig) => {
    setConfig(cfg);
    const errs: Record<string, number> = {};
    for (const p of cfg.players) errs[p.id] = 0;
    setPlayersErrors(errs);
    setPhase("intro");
  }, []);

  // ---------------------------------------------------------------------------
  // Start
  // ---------------------------------------------------------------------------
  const startGame = useCallback(() => {
    setCurrentPlayerIdx(0);
    setCurrentQIdx(0);
    setAnswers([]);
    setLastSelectedIdx(null);
    setLastCorrectIdx(null);
    setRougePlayerId(null);
    gameStartedAtRef.current = performance.now();
    questionStartedAtRef.current = performance.now();
    setPhase("playing");
  }, []);

  // ---------------------------------------------------------------------------
  // Utilitaires
  // ---------------------------------------------------------------------------
  const advanceToNextPlayer = useCallback(() => {
    if (!config) return;
    const n = config.players.length;
    const next = (currentPlayerIdx + 1) % n;
    setCurrentPlayerIdx(next);
    setCurrentQIdx((idx) => (idx + 1) % initialQuestions.length);
    setLastSelectedIdx(null);
    setLastCorrectIdx(null);
    questionStartedAtRef.current = performance.now();
  }, [config, currentPlayerIdx, initialQuestions.length]);

  // ---------------------------------------------------------------------------
  // Handle answer (joué par humain OU bot)
  // ---------------------------------------------------------------------------
  const processAnswer = useCallback(
    (answerIdx: number, timeMs: number, byUser: boolean) => {
      if (!currentQuestion || !currentPlayer) return;

      const chosen = currentQuestion.reponses[answerIdx];
      const correctIdx = currentQuestion.reponses.findIndex((r) => r.correct);
      const isCorrect = chosen?.correct === true;

      setLastSelectedIdx(answerIdx);
      setLastCorrectIdx(correctIdx);

      // Log
      setAnswers((a) => [
        ...a,
        {
          questionId: currentQuestion.id,
          isCorrect,
          timeMs: Math.round(timeMs),
          playerId: currentPlayer.id,
          byUser,
        },
      ]);

      // MAJ erreurs joueur
      let newErrors = playersErrors[currentPlayer.id] ?? 0;
      if (!isCorrect) newErrors += 1;
      setPlayersErrors((prev) => ({
        ...prev,
        [currentPlayer.id]: newErrors,
      }));

      if (isCorrect) {
        playSound("ding");
      } else {
        playSound("buzz");
      }

      // Rouge → Duel
      if (ceIsPlayerOut(newErrors)) {
        setPhase("feedback");
        window.setTimeout(() => {
          setRougePlayerId(currentPlayer.id);
          setPhase("rouge-announce");
          playSound("lose");
        }, FEEDBACK_DELAY_WRONG_MS);
        return;
      }

      // Feedback puis joueur suivant — piloté par `FeedbackCountdown` dans
      // tous les cas (humain ET bot). Pour les bots on garde un countdown
      // court (8 s) avec bouton "Suivant" pour que l'humain spectateur ait
      // le temps de lire la question + voir la bonne réponse, mais puisse
      // aussi accélérer manuellement.
      setPhase("feedback");
    },
    [currentQuestion, currentPlayer, playersErrors, advanceToNextPlayer],
  );

  const handleHumanAnswer = useCallback(
    (answerIdx: number) => {
      if (phase !== "playing") return;
      if (currentPlayer?.isBot) return;
      const timeMs = performance.now() - questionStartedAtRef.current;
      processAnswer(answerIdx, timeMs, /* byUser */ currentPlayerIdx === 0);
    },
    [phase, currentPlayer, processAnswer, currentPlayerIdx],
  );

  const handleTimerEnd = useCallback(() => {
    if (phase !== "playing") return;
    if (currentPlayer?.isBot) return; // bot géré par setTimeout
    if (!currentQuestion) return;
    // Temps écoulé : on compte comme mauvaise réponse (index opposé du correct)
    const correctIdx = currentQuestion.reponses.findIndex((r) => r.correct);
    const wrongIdx = correctIdx === 0 ? 1 : 0;
    const timeMs = performance.now() - questionStartedAtRef.current;
    processAnswer(wrongIdx, timeMs, currentPlayerIdx === 0);
  }, [phase, currentPlayer, currentQuestion, processAnswer, currentPlayerIdx]);

  // ---------------------------------------------------------------------------
  // Tour du bot : schedule answer
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (phase !== "playing") return;
    if (!currentPlayer?.isBot) return;
    if (!currentQuestion) return;

    const delay = botResponseDelayMs(botDifficulty);
    const timer = window.setTimeout(() => {
      const correct = botAnswersCorrectly(botDifficulty);
      const correctIdx = currentQuestion.reponses.findIndex((r) => r.correct);
      const wrongIdx = correctIdx === 0 ? 1 : 0;
      const chosenIdx = correct ? correctIdx : wrongIdx;
      processAnswer(chosenIdx, delay, false);
    }, delay);

    return () => window.clearTimeout(timer);
  }, [phase, currentPlayer, currentQuestion, botDifficulty, processAnswer]);

  // ---------------------------------------------------------------------------
  // Raccourcis clavier (réponse humaine)
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (phase !== "playing") return;
    if (currentPlayer?.isBot) return;

    function onKeyDown(e: KeyboardEvent) {
      if (e.repeat) return;
      if (
        e.key === "ArrowLeft" ||
        e.key.toLowerCase() === "a" ||
        e.key === "1"
      ) {
        e.preventDefault();
        handleHumanAnswer(0);
      } else if (
        e.key === "ArrowRight" ||
        e.key.toLowerCase() === "b" ||
        e.key === "2"
      ) {
        e.preventDefault();
        handleHumanAnswer(1);
      }
    }

    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [phase, currentPlayer, handleHumanAnswer]);

  // ---------------------------------------------------------------------------
  // Transition rouge → Duel pending
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (phase !== "rouge-announce") return;
    const timer = window.setTimeout(() => {
      setPhase("duel");
    }, ROUGE_ANNOUNCE_DURATION_MS);
    return () => window.clearTimeout(timer);
  }, [phase]);

  // ---------------------------------------------------------------------------
  // Sauvegarde à la fin
  // ---------------------------------------------------------------------------
  useEffect(() => {
    if (phase !== "results") return;
    if (saveResult || isSaving) return;
    setIsSaving(true);
    const duration = Math.round(
      (performance.now() - gameStartedAtRef.current) / 1000,
    );
    void saveCeSession({
      answers,
      durationSeconds: duration,
      rougePlayerId,
    })
      .then(setSaveResult)
      .finally(() => setIsSaving(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // ---------------------------------------------------------------------------
  // Rendu
  // ---------------------------------------------------------------------------
  if (phase === "setup") {
    return (
      <PlayerSetup
        gameLabel="Le Coup d'Envoi"
        userPseudo={userPseudo}
        onReady={handleSetupReady}
      />
    );
  }

  if (!config || players.length === 0) return null;

  if (phase === "intro") {
    return <IntroScreen players={players} onStart={startGame} />;
  }

  if (phase === "rouge-announce") {
    const rougePlayer = players.find((p) => p.id === rougePlayerId);
    return <RougeAnnounceScreen rougePlayer={rougePlayer ?? null} />;
  }

  if (phase === "duel") {
    const rougePlayer = players.find((p) => p.id === rougePlayerId);
    const others = players.filter((p) => p.id !== rougePlayerId);
    if (!rougePlayer || others.length === 0) {
      // Pas d'adversaire disponible — on skip au résultat
      setPhase("results");
      return null;
    }
    if (duelThemes.length < 2) {
      // Pas assez de thèmes pour un Duel — on skip au résultat
      return (
        <NoDuelThemesPanel
          onSkipToResults={() => setPhase("results")}
        />
      );
    }
    return (
      <DuelPanel
        rougePlayer={rougePlayer}
        otherPlayers={others}
        themes={duelThemes}
        isSecondDuel={false}
        botDifficulty={botDifficulty}
        onComplete={(result) => {
          setDuelResult(result);
          setPhase("results");
        }}
      />
    );
  }

  if (phase === "results") {
    const rougeP = players.find((p) => p.id === rougePlayerId) ?? null;
    const winnerP =
      duelResult?.winnerId
        ? (players.find((p) => p.id === duelResult.winnerId) ?? null)
        : null;
    const eliminatedP =
      duelResult?.eliminatedId
        ? (players.find((p) => p.id === duelResult.eliminatedId) ?? null)
        : null;
    return (
      <ResultsScreen
        players={players}
        playersErrors={playersErrors}
        answers={answers}
        rougePlayer={rougeP}
        duelWinner={winnerP}
        duelEliminated={eliminatedP}
        saveResult={saveResult}
        isSaving={isSaving}
        onReplay={() => {
          router.refresh();
          setPhase("setup");
          setConfig(null);
          setDuelResult(null);
        }}
      />
    );
  }

  // phase === 'playing' or 'feedback'
  if (!currentQuestion || !currentPlayer) return null;

  const displayEnonce = stripFormatPrefix(currentQuestion.enonce);
  const formatLbl = formatLabel(currentQuestion.format);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-5 p-4 sm:p-6 lg:p-8">
      {/* Bandeau joueurs */}
      <div
        className={cn(
          "grid gap-2",
          players.length <= 2 && "grid-cols-2",
          players.length === 3 && "grid-cols-3",
          players.length >= 4 && "grid-cols-2 sm:grid-cols-4",
        )}
      >
        {players.map((p, i) => (
          <PlayerBadge
            key={p.id}
            player={p}
            errors={playersErrors[p.id] ?? 0}
            active={i === currentPlayerIdx}
          />
        ))}
      </div>

      {/* Timer + Format label */}
      <div className="flex flex-col items-center gap-2">
        {formatLbl && (
          <span className="rounded-full bg-gold/20 px-3 py-1 text-xs font-bold uppercase tracking-widest text-gold-warm">
            {formatLbl}
          </span>
        )}
        <Timer
          key={`timer-${currentPlayerIdx}-${currentQIdx}`}
          duration={CE_TIMER_SECONDS}
          onEnd={handleTimerEnd}
          paused={phase !== "playing"}
        />
      </div>

      {/* Question */}
      <AnimatePresence mode="wait">
        <QuestionCard
          key={`q-${currentQuestion.id}`}
          keyId={currentQuestion.id}
          enonce={displayEnonce}
          category={currentQuestion.category?.nom}
          categoryColor={currentQuestion.category?.couleur ?? undefined}
          difficulte={currentQuestion.difficulte}
        />
      </AnimatePresence>
      <div className="flex justify-center">
        <SpeakerButton
          text={displayEnonce}
          choices={currentQuestion.reponses.map((r) => r.text)}
        />
      </div>

      {/* Indicateur tour actif */}
      <div className="text-center">
        <p className="text-xs uppercase tracking-widest text-foreground/50">
          Au tour de
        </p>
        <p className="font-display text-xl font-extrabold text-foreground">
          {currentPlayer.pseudo}
          {currentPlayer.isBot && (
            <span className="ml-1 text-xs text-sky">(bot)</span>
          )}
        </p>
      </div>

      {/* Réponses */}
      <div className="grid w-full gap-3 sm:grid-cols-2">
        {currentQuestion.reponses.map((r, idx) => {
          let state: "idle" | "correct" | "wrong" = "idle";
          if (phase === "feedback") {
            if (idx === lastCorrectIdx) state = "correct";
            else if (idx === lastSelectedIdx) state = "wrong";
          }
          const keyHint = idx === 0 ? "A" : "B";
          return (
            <AnswerButton
              key={idx}
              state={state}
              keyHint={keyHint}
              disabled={phase !== "playing" || currentPlayer.isBot}
              onClick={() => handleHumanAnswer(idx)}
            >
              {r.text}
            </AnswerButton>
          );
        })}
      </div>

      {/* Compte à rebours + bouton Passer après chaque réponse.
          Humain : 30 s pour relire calmement.
          Bot : 8 s pour voir la bonne réponse, avec bouton "Suivant" pour
          accélérer si tu suis vite. Auto-skip à 0 dans les deux cas. */}
      {phase === "feedback" && (
        <FeedbackCountdown
          key={`countdown-${currentQuestion.id}-${currentPlayerIdx}`}
          seconds={currentPlayer.isBot ? 8 : 30}
          label={currentPlayer.isBot ? "Suivant" : "Passer à la suite"}
          onSkip={() => {
            advanceToNextPlayer();
            setPhase("playing");
          }}
        />
      )}

      {/* Raccourcis clavier */}
      <p className="text-center text-xs text-foreground/40">
        <ArrowLeft className="inline h-3 w-3 align-text-bottom" aria-hidden="true" />{" "}
        A pour la gauche · B pour la droite{" "}
        <ArrowRight className="inline h-3 w-3 align-text-bottom" aria-hidden="true" />
      </p>
    </main>
  );
}

// =============================================================================
// Sous-écrans
// =============================================================================

function IntroScreen({
  players,
  onStart,
}: {
  players: PlayerConfig[];
  onStart: () => void;
}) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="relative">
        <div className="absolute inset-0 -z-10 animate-sun-pulse rounded-full bg-gold/30 blur-3xl" />
        <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-card shadow-[0_4px_24px_rgba(245,183,0,0.3)]">
          <Dices className="h-12 w-12 text-gold-warm" aria-hidden="true" />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <p className="font-display text-sm font-bold uppercase tracking-widest text-gold-warm">
          Jeu 1
        </p>
        <h1 className="font-display text-4xl font-extrabold text-foreground sm:text-5xl">
          Le Coup d&apos;Envoi
        </h1>
        <p className="text-foreground/70 sm:text-lg">
          Chacun son tour, une question à 2 options.
          <br />
          <strong>Vrai ou faux, L&apos;un ou l&apos;autre, Plus ou moins.</strong>
        </p>
      </div>

      <ul className="flex flex-col gap-2 rounded-xl border border-border bg-card p-5 text-left text-sm text-foreground/80 glow-card">
        <li className="flex items-start gap-2">
          <LifeBar state="yellow" className="mt-0.5 scale-75" />
          <span>
            <strong>2 erreurs = rouge</strong>. Vert → orange → rouge.
          </span>
        </li>
        <li className="flex items-start gap-2">
          <Swords className="mt-1 h-4 w-4 shrink-0 text-buzz" aria-hidden="true" />
          <span>
            Premier au rouge → il désigne un adversaire pour le{" "}
            <strong>Duel</strong>.
          </span>
        </li>
      </ul>

      <div className="flex w-full flex-wrap items-center justify-center gap-2">
        {players.map((p) => (
          <span
            key={p.id}
            className={cn(
              "inline-flex items-center gap-1 rounded-full border px-3 py-1 text-sm",
              p.isBot
                ? "border-sky/40 bg-sky/10 text-sky"
                : "border-gold/50 bg-gold/10 text-foreground",
            )}
          >
            {p.isBot ? (
              <Bot className="h-3.5 w-3.5" aria-hidden="true" />
            ) : (
              <Crown className="h-3.5 w-3.5" aria-hidden="true" />
            )}
            {p.pseudo}
          </span>
        ))}
      </div>

      <button
        type="button"
        onClick={onStart}
        className="inline-flex items-center gap-2 rounded-xl bg-gold px-10 py-5 font-display text-xl font-extrabold uppercase tracking-wide text-on-color shadow-[0_6px_0_0_#e89e00] transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(245,183,0,0.55)] active:translate-y-0 active:shadow-[0_2px_0_0_#e89e00]"
      >
        <Play className="h-5 w-5" aria-hidden="true" fill="currentColor" />
        C&apos;est parti !
      </button>
    </main>
  );
}

function PlayerBadge({
  player,
  errors,
  active,
}: {
  player: PlayerConfig;
  errors: number;
  active: boolean;
}) {
  const life = ceLifeState(errors);
  const tone =
    life === "green"
      ? "border-life-green/40 bg-life-green/5"
      : life === "yellow"
        ? "border-life-yellow/50 bg-life-yellow/10"
        : "border-life-red/50 bg-life-red/10";

  return (
    <motion.div
      layout
      animate={active ? { scale: 1.03 } : { scale: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 20 }}
      className={cn(
        "flex flex-col gap-1 rounded-xl border p-2.5 transition-all",
        tone,
        active &&
          "border-gold shadow-[0_0_24px_rgba(245,183,0,0.35)] bg-gold/10",
      )}
    >
      <div className="flex items-center gap-1.5">
        <div
          className={cn(
            "flex h-6 w-6 shrink-0 items-center justify-center rounded-md",
            player.isBot ? "bg-sky/15 text-sky" : "bg-gold/20 text-gold-warm",
          )}
        >
          {player.isBot ? (
            <Bot className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <Crown className="h-3.5 w-3.5" aria-hidden="true" />
          )}
        </div>
        <span className="flex-1 truncate text-xs font-bold text-foreground">
          {player.pseudo}
        </span>
      </div>
      <motion.div
        key={life}
        initial={{ scale: 0.85 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 16 }}
      >
        <LifeBar state={life} className="scale-90 origin-left" />
      </motion.div>
    </motion.div>
  );
}

function RougeAnnounceScreen({
  rougePlayer,
}: {
  rougePlayer: PlayerConfig | null;
}) {
  return (
    <main className="relative mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-6 overflow-hidden p-8 text-center">
      {/* Halo rouge pulsant */}
      <motion.div
        className="absolute inset-0 -z-10 bg-buzz/20"
        initial={{ opacity: 0 }}
        animate={{ opacity: [0, 0.6, 0.3, 0.6, 0.3] }}
        transition={{ duration: 2, repeat: Infinity }}
      />
      <motion.div
        initial={{ scale: 0.5, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 180, damping: 12 }}
        className="flex h-32 w-32 items-center justify-center rounded-full bg-buzz/20 shadow-[0_0_80px_rgba(230,57,70,0.7)]"
      >
        <div className="h-16 w-16 rounded-full bg-buzz shadow-[0_0_48px_rgba(230,57,70,0.8)]" />
      </motion.div>

      {rougePlayer && (
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="font-display text-xl font-bold uppercase tracking-widest text-buzz"
        >
          {rougePlayer.pseudo} passe au rouge
        </motion.p>
      )}

      <motion.h1
        initial={{ opacity: 0, scale: 0.7 }}
        animate={{ opacity: 1, scale: 1 }}
        transition={{ delay: 0.8, type: "spring", stiffness: 200, damping: 16 }}
        className="font-display text-4xl font-extrabold text-foreground sm:text-5xl"
      >
        Qui dit «&nbsp;rouge&nbsp;» dit…
      </motion.h1>
      <motion.p
        initial={{ opacity: 0, scale: 0.3, rotate: -10 }}
        animate={{ opacity: 1, scale: [0.3, 1.4, 1], rotate: 0 }}
        transition={{ delay: 1.5, duration: 0.9 }}
        className="font-display text-6xl font-extrabold uppercase tracking-widest text-buzz sm:text-8xl"
      >
        Duel&nbsp;!
      </motion.p>
    </main>
  );
}

function NoDuelThemesPanel({
  onSkipToResults,
}: {
  onSkipToResults: () => void;
}) {
  return (
    <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-buzz/15 text-buzz">
        <Swords className="h-10 w-10" aria-hidden="true" />
      </div>
      <h1 className="font-display text-3xl font-extrabold text-foreground">
        Pas assez de thèmes pour le Duel
      </h1>
      <p className="text-foreground/70">
        Il faut au moins 2 catégories avec des questions{" "}
        <code>quizz_4</code> pour proposer le choix de thèmes.
      </p>
      <Button variant="gold" size="lg" onClick={onSkipToResults}>
        Voir les résultats
      </Button>
    </main>
  );
}

function ResultsScreen({
  players,
  playersErrors,
  answers,
  rougePlayer,
  duelWinner,
  duelEliminated,
  saveResult,
  isSaving,
  onReplay,
}: {
  players: PlayerConfig[];
  playersErrors: Record<string, number>;
  answers: CeAnswerLog[];
  rougePlayer: PlayerConfig | null;
  duelWinner: PlayerConfig | null;
  duelEliminated: PlayerConfig | null;
  saveResult: SaveCeResult | null;
  isSaving: boolean;
  onReplay: () => void;
}) {
  const xpGained = saveResult?.status === "ok" ? saveResult.xpGained : null;
  const userCorrectCount = answers.filter(
    (a) => a.byUser && a.isCorrect,
  ).length;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 18 }}
        className="flex h-28 w-28 items-center justify-center rounded-3xl bg-gold/20 shadow-[0_0_48px_rgba(245,183,0,0.4)]"
      >
        <Trophy
          className="h-14 w-14 text-gold-warm"
          aria-hidden="true"
          fill="currentColor"
        />
      </motion.div>

      <div className="flex flex-col gap-2">
        <h1 className="font-display text-4xl font-extrabold text-foreground">
          Coup d&apos;Envoi terminé
        </h1>
        {rougePlayer && (
          <p className="text-foreground/70 sm:text-lg">
            <strong className="text-buzz">{rougePlayer.pseudo}</strong> est
            passé au rouge le premier.
          </p>
        )}
        {duelWinner && duelEliminated && (
          <p className="mt-1 rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground">
            <strong className="text-gold-warm">Duel :</strong>{" "}
            <strong>{duelWinner.pseudo}</strong> gagne,{" "}
            <strong className="text-buzz">{duelEliminated.pseudo}</strong>{" "}
            éliminé.
          </p>
        )}
      </div>

      {/* Récap par joueur */}
      <ul className="flex w-full flex-col gap-2 rounded-xl border border-border bg-card p-4 text-left text-sm glow-card">
        {players.map((p) => {
          const errs = playersErrors[p.id] ?? 0;
          const correctByP = answers.filter(
            (a) => a.playerId === p.id && a.isCorrect,
          ).length;
          const totalByP = answers.filter((a) => a.playerId === p.id).length;
          const out = ceIsPlayerOut(errs);
          return (
            <li key={p.id} className="flex items-center gap-3">
              <div
                className={cn(
                  "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
                  p.isBot ? "bg-sky/15 text-sky" : "bg-gold/20 text-gold-warm",
                )}
              >
                {p.isBot ? (
                  <Bot className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Crown className="h-4 w-4" aria-hidden="true" />
                )}
              </div>
              <span className="flex-1 font-semibold text-foreground">{p.pseudo}</span>
              <span className="text-xs text-foreground/60">
                {correctByP} / {totalByP} ·{" "}
                {errs} erreur{errs > 1 ? "s" : ""}
              </span>
              {out && (
                <span className="rounded-full bg-buzz/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-buzz">
                  Duel
                </span>
              )}
            </li>
          );
        })}
      </ul>

      {/* XP user */}
      <div className="grid w-full grid-cols-2 gap-3">
        <StatCard
          label="Tes bonnes"
          value={String(userCorrectCount)}
          tone="green"
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
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-gold/50 bg-card/60 px-4 text-sm font-semibold text-foreground transition-colors hover:bg-gold/20 hover:border-gold"
        >
          <BarChart3 className="h-4 w-4" aria-hidden="true" />
          Mes erreurs
        </Link>
        <Link
          href="/"
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-gold/50 bg-card/60 px-4 text-sm font-semibold text-foreground transition-colors hover:bg-gold/20 hover:border-gold"
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
      <p className="text-xs uppercase tracking-wider text-foreground/60">{label}</p>
    </div>
  );
}

// Ensure the component type for CE_MAX_ERRORS is referenced (prevents unused import warning)
void CE_MAX_ERRORS;
