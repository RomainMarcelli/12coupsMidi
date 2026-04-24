"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Bot,
  Brain,
  Crown,
  Home,
  Play,
  Repeat,
  SkipForward,
  Sword,
  Swords,
  Trophy,
  Users,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { QuestionCard } from "@/components/game/QuestionCard";
import { VoiceInput } from "@/components/game/VoiceInput";
import { Button } from "@/components/ui/button";
import {
  BOT_PROFILES,
  FAF_DURATION_MS,
  type BotDifficulty,
  type FafAnswerLog,
  type FafMode,
  type FafQuestion,
  botAnswersCorrectly,
  botResponseDelayMs,
  nextQuestionIndex,
} from "@/lib/game-logic/faceAFace";
import { isMatch } from "@/lib/matching/fuzzy-match";
import { cn } from "@/lib/utils";
import { playSound } from "@/lib/sounds";
import { saveFafSession, type SaveFafResult } from "./actions";

type Phase =
  | "mode-select"
  | "ami-pseudos"
  | "intro"
  | "playing"
  | "transition"
  | "results";

interface FaceAFaceClientProps {
  initialQuestions: FafQuestion[];
  userPseudo: string;
}

const TRANSITION_FEEDBACK_MS = 900;

export function FaceAFaceClient({
  initialQuestions,
  userPseudo,
}: FaceAFaceClientProps) {
  const router = useRouter();

  // -----------------------------
  // Setup / config
  // -----------------------------
  const [phase, setPhase] = useState<Phase>("mode-select");
  const [mode, setMode] = useState<FafMode>("vs_bot");
  const [botDifficulty, setBotDifficulty] = useState<BotDifficulty>("moyen");
  const [p1Name, setP1Name] = useState(userPseudo);
  const [p2Name, setP2Name] = useState("");

  // -----------------------------
  // Game state
  // -----------------------------
  const [p1TimeLeft, setP1TimeLeft] = useState(FAF_DURATION_MS);
  const [p2TimeLeft, setP2TimeLeft] = useState(FAF_DURATION_MS);
  const [activeIdx, setActiveIdx] = useState<0 | 1>(0);
  const [currentQIdx, setCurrentQIdx] = useState(0);
  const usedIdxRef = useRef<Set<number>>(new Set([0]));
  const [answers, setAnswers] = useState<FafAnswerLog[]>([]);
  const [winnerIdx, setWinnerIdx] = useState<0 | 1 | null>(null);

  // Brief UI flash after wrong/pass (before question change)
  const [flash, setFlash] = useState<
    { kind: "wrong" | "pass"; who: "user" | "bot" | "ami" } | null
  >(null);

  // Persistance BDD
  const [saveResult, setSaveResult] = useState<SaveFafResult | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const startedAtRef = useRef<number>(0);
  const questionStartedAtRef = useRef<number>(0);

  const p2IsBot = mode === "vs_bot";

  const activePseudo = activeIdx === 0 ? p1Name : p2Name;
  const activeIsBot = activeIdx === 0 ? false : p2IsBot;

  const currentQuestion = initialQuestions[currentQIdx];

  // -----------------------------
  // Ticker : décrément du chrono du joueur actif (RAF)
  // -----------------------------
  useEffect(() => {
    if (phase !== "playing") return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = now - last;
      last = now;
      if (activeIdx === 0) {
        setP1TimeLeft((prev) => Math.max(0, prev - dt));
      } else {
        setP2TimeLeft((prev) => Math.max(0, prev - dt));
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [phase, activeIdx]);

  // -----------------------------
  // Détection fin de partie sur timeout
  // -----------------------------
  useEffect(() => {
    if (phase !== "playing") return;
    if (p1TimeLeft <= 0 && winnerIdx === null) {
      setWinnerIdx(1);
      setPhase("results");
      playSound("lose");
    } else if (p2TimeLeft <= 0 && winnerIdx === null) {
      setWinnerIdx(0);
      setPhase("results");
      playSound("win");
    }
  }, [p1TimeLeft, p2TimeLeft, phase, winnerIdx]);

  // -----------------------------
  // Avance à la question suivante (sans switcher de joueur)
  // -----------------------------
  const advanceQuestion = useCallback(() => {
    const nextIdx = nextQuestionIndex(
      initialQuestions.length,
      usedIdxRef.current,
    );
    if (nextIdx >= 0) {
      usedIdxRef.current.add(nextIdx);
      setCurrentQIdx(nextIdx);
    }
    questionStartedAtRef.current = performance.now();
  }, [initialQuestions.length]);

  // -----------------------------
  // Soumission de réponse (user ou ami) — vient du VoiceInput
  // -----------------------------
  const handleHumanAnswer = useCallback(
    (raw: string) => {
      if (phase !== "playing" || activeIsBot || !currentQuestion) return;
      const value = raw.trim();
      if (!value) return;

      const timeMs = performance.now() - questionStartedAtRef.current;
      const isCorrect = isMatch(
        value,
        currentQuestion.bonne_reponse,
        currentQuestion.alias,
      );
      const by: "user" | "ami" =
        activeIdx === 0 ? "user" : mode === "vs_ami" ? "ami" : "user";

      setAnswers((a) => [
        ...a,
        {
          questionId: currentQuestion.id,
          isCorrect,
          timeMs: Math.round(timeMs),
          by,
        },
      ]);

      if (isCorrect) {
        playSound("ding");
        setPhase("transition");
      } else {
        playSound("buzz");
        setFlash({ kind: "wrong", who: by });
        window.setTimeout(() => {
          setFlash(null);
          advanceQuestion();
        }, TRANSITION_FEEDBACK_MS);
      }
    },
    [phase, activeIsBot, currentQuestion, activeIdx, mode, advanceQuestion],
  );

  // -----------------------------
  // Passer — sans compter une réponse
  // -----------------------------
  const handlePass = useCallback(() => {
    if (phase !== "playing" || activeIsBot) return;
    playSound("tick");
    setFlash({
      kind: "pass",
      who: activeIdx === 0 ? "user" : mode === "vs_ami" ? "ami" : "user",
    });
    window.setTimeout(() => {
      setFlash(null);
      advanceQuestion();
    }, TRANSITION_FEEDBACK_MS / 2);
  }, [phase, activeIsBot, activeIdx, mode, advanceQuestion]);

  // -----------------------------
  // Tour du bot : tire un délai, puis simule sa réponse
  // -----------------------------
  useEffect(() => {
    if (phase !== "playing") return;
    if (!activeIsBot) return;
    if (!currentQuestion) return;

    const delay = botResponseDelayMs(botDifficulty);
    const timer = window.setTimeout(() => {
      const correct = botAnswersCorrectly(botDifficulty);
      setAnswers((a) => [
        ...a,
        {
          questionId: currentQuestion.id,
          isCorrect: correct,
          timeMs: delay,
          by: "bot",
        },
      ]);
      if (correct) {
        playSound("ding");
        setPhase("transition");
      } else {
        playSound("buzz");
        setFlash({ kind: "pass", who: "bot" });
        window.setTimeout(() => {
          setFlash(null);
          advanceQuestion();
        }, TRANSITION_FEEDBACK_MS);
      }
    }, delay);

    return () => window.clearTimeout(timer);
  }, [
    phase,
    activeIsBot,
    currentQIdx,
    currentQuestion,
    botDifficulty,
    advanceQuestion,
  ]);

  // -----------------------------
  // Démarrer une partie
  // -----------------------------
  const startGame = useCallback(() => {
    // Reset des états de jeu
    setP1TimeLeft(FAF_DURATION_MS);
    setP2TimeLeft(FAF_DURATION_MS);
    setActiveIdx(0);
    const firstIdx = Math.floor(Math.random() * initialQuestions.length);
    setCurrentQIdx(firstIdx);
    usedIdxRef.current = new Set([firstIdx]);
    setAnswers([]);
    setWinnerIdx(null);
    setFlash(null);
    setSaveResult(null);
    startedAtRef.current = performance.now();
    questionStartedAtRef.current = performance.now();
    setPhase("playing");
  }, [initialQuestions.length]);

  // -----------------------------
  // Reprise après transition : switch actif + nouvelle question
  // -----------------------------
  const continueAfterTransition = useCallback(() => {
    setActiveIdx((prev) => (prev === 0 ? 1 : 0));
    advanceQuestion();
    setPhase("playing");
  }, [advanceQuestion]);

  // -----------------------------
  // Sauvegarde BDD à la fin
  // -----------------------------
  useEffect(() => {
    if (phase !== "results") return;
    if (saveResult || isSaving) return;
    setIsSaving(true);
    const userWon = winnerIdx === 0;
    const userTimeLeftMs = p1TimeLeft;
    const duration = Math.round(
      (performance.now() - startedAtRef.current) / 1000,
    );
    void saveFafSession({
      mode,
      answers,
      userWon,
      userTimeLeftMs,
      durationSeconds: duration,
    })
      .then((res) => setSaveResult(res))
      .finally(() => setIsSaving(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // -----------------------------
  // Rendu
  // -----------------------------
  if (phase === "mode-select") {
    return (
      <ModeSelectScreen
        mode={mode}
        botDifficulty={botDifficulty}
        onPickMode={setMode}
        onPickDifficulty={setBotDifficulty}
        onContinue={() => {
          if (mode === "vs_ami") setPhase("ami-pseudos");
          else setPhase("intro");
        }}
      />
    );
  }

  if (phase === "ami-pseudos") {
    return (
      <PseudosScreen
        p1Default={p1Name}
        p2Default={p2Name}
        onBack={() => setPhase("mode-select")}
        onContinue={(p1, p2) => {
          setP1Name(p1);
          setP2Name(p2);
          setPhase("intro");
        }}
      />
    );
  }

  if (phase === "intro") {
    return (
      <IntroScreen
        mode={mode}
        botDifficulty={botDifficulty}
        p1Name={p1Name}
        p2Name={mode === "vs_bot" ? `Bot ${BOT_PROFILES[botDifficulty].label}` : p2Name}
        onStart={startGame}
        onBack={() => setPhase("mode-select")}
      />
    );
  }

  if (phase === "results") {
    const userWon = winnerIdx === 0;
    const winnerName = winnerIdx === 0
      ? p1Name
      : mode === "vs_bot"
        ? `Bot ${BOT_PROFILES[botDifficulty].label}`
        : p2Name;
    return (
      <ResultsScreen
        userWon={userWon}
        winnerName={winnerName}
        xpResult={saveResult}
        isSaving={isSaving}
        userCorrect={answers.filter((a) => a.by === "user" && a.isCorrect).length}
        mode={mode}
        onReplay={() => {
          setPhase("mode-select");
          router.refresh();
        }}
      />
    );
  }

  // playing / transition
  const p2DisplayName =
    mode === "vs_bot" ? `Bot ${BOT_PROFILES[botDifficulty].label}` : p2Name;

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-5 p-4 sm:p-6 lg:p-8">
      <div className="grid grid-cols-2 gap-3">
        <PlayerCard
          name={p1Name}
          isBot={false}
          timeLeftMs={p1TimeLeft}
          active={activeIdx === 0 && phase === "playing"}
        />
        <PlayerCard
          name={p2DisplayName}
          isBot={p2IsBot}
          timeLeftMs={p2TimeLeft}
          active={activeIdx === 1 && phase === "playing"}
        />
      </div>

      <AnimatePresence mode="wait">
        {phase === "transition" && currentQuestion ? (
          <TransitionPanel
            key="transition"
            currentAnswer={currentQuestion.bonne_reponse}
            whoJustAnswered={activePseudo}
            whoJustAnsweredIsBot={activeIsBot}
            nextPlayerName={activeIdx === 0 ? p2DisplayName : p1Name}
            nextIsBot={activeIdx === 0 ? p2IsBot : false}
            onContinue={continueAfterTransition}
          />
        ) : (
          <motion.div
            key={`q-${currentQuestion?.id ?? "none"}`}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -12 }}
            transition={{ duration: 0.25 }}
            className="flex flex-col gap-4"
          >
            {currentQuestion && (
              <QuestionCard
                keyId={currentQuestion.id}
                enonce={currentQuestion.enonce}
                category={currentQuestion.category?.nom}
                categoryColor={currentQuestion.category?.couleur ?? undefined}
                difficulte={currentQuestion.difficulte}
              />
            )}

            {/* Flash feedback (wrong / pass) */}
            <AnimatePresence>
              {flash && (
                <motion.div
                  key="flash"
                  initial={{ opacity: 0, y: -8 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -8 }}
                  className={cn(
                    "mx-auto rounded-full px-4 py-1.5 text-sm font-bold",
                    flash.kind === "wrong"
                      ? "bg-buzz/15 text-buzz"
                      : "bg-navy/10 text-navy/70",
                  )}
                  role="status"
                >
                  {flash.kind === "wrong"
                    ? flash.who === "bot"
                      ? `Le bot se trompe — question suivante`
                      : "Mauvaise réponse — question suivante"
                    : flash.who === "bot"
                      ? "Le bot passe — question suivante"
                      : "Passé — question suivante"}
                </motion.div>
              )}
            </AnimatePresence>

            {/* Zone de saisie : user/ami → VoiceInput ; bot → thinking indicator */}
            {activeIsBot ? (
              <BotThinking difficulty={botDifficulty} />
            ) : (
              <div className="flex flex-col gap-3">
                <VoiceInput
                  onSubmit={handleHumanAnswer}
                  placeholder="Ta réponse…"
                  disabled={phase !== "playing"}
                />
                <button
                  type="button"
                  onClick={handlePass}
                  disabled={phase !== "playing"}
                  className="mx-auto inline-flex items-center gap-1.5 rounded-md border border-navy/20 bg-white/60 px-4 py-2 text-sm font-semibold text-navy transition-colors hover:border-navy/40 hover:bg-navy/5 disabled:cursor-not-allowed disabled:opacity-40"
                >
                  <SkipForward className="h-4 w-4" aria-hidden="true" />
                  Passer
                </button>
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

// ===========================================================================
// Sub-screens
// ===========================================================================

function ModeSelectScreen({
  mode,
  botDifficulty,
  onPickMode,
  onPickDifficulty,
  onContinue,
}: {
  mode: FafMode;
  botDifficulty: BotDifficulty;
  onPickMode: (m: FafMode) => void;
  onPickDifficulty: (d: BotDifficulty) => void;
  onContinue: () => void;
}) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-buzz/15 text-buzz">
        <Swords className="h-10 w-10" aria-hidden="true" />
      </div>
      <div className="flex flex-col gap-1.5">
        <p className="text-sm font-bold uppercase tracking-widest text-buzz">
          Jeu 3
        </p>
        <h1 className="font-display text-4xl font-extrabold text-navy sm:text-5xl">
          Face-à-Face
        </h1>
        <p className="text-navy/70 sm:text-lg">
          60 s par joueur. Bonne réponse fige ton chrono, l&apos;adversaire
          joue.
        </p>
      </div>

      <div className="grid w-full gap-3 sm:grid-cols-2">
        <ModeCard
          label="Contre le Bot"
          desc="Entraîne-toi solo"
          icon={Bot}
          selected={mode === "vs_bot"}
          onClick={() => onPickMode("vs_bot")}
        />
        <ModeCard
          label="Contre un ami"
          desc="Local, tour par tour"
          icon={Users}
          selected={mode === "vs_ami"}
          onClick={() => onPickMode("vs_ami")}
        />
      </div>

      {mode === "vs_bot" && (
        <div className="flex w-full flex-col gap-2 rounded-xl border border-border bg-white p-4">
          <p className="text-xs font-bold uppercase tracking-widest text-navy/50">
            Difficulté du Bot
          </p>
          <div className="grid grid-cols-3 gap-2">
            {(["facile", "moyen", "difficile"] as const).map((d) => (
              <button
                key={d}
                type="button"
                onClick={() => onPickDifficulty(d)}
                className={cn(
                  "rounded-md border px-3 py-2 text-sm font-semibold capitalize transition-all",
                  botDifficulty === d
                    ? "border-gold bg-gold/20 text-navy shadow-[0_2px_0_0_#e89e00]"
                    : "border-border bg-white text-navy/70 hover:border-gold/40 hover:bg-gold/5",
                )}
              >
                {d}
                <span className="ml-1 text-xs opacity-60">
                  ({Math.round(BOT_PROFILES[d].correctProbability * 100)} %)
                </span>
              </button>
            ))}
          </div>
        </div>
      )}

      <Button variant="gold" size="lg" onClick={onContinue}>
        <Play className="h-5 w-5" aria-hidden="true" fill="currentColor" />
        Continuer
      </Button>
    </main>
  );
}

function ModeCard({
  label,
  desc,
  icon: Icon,
  selected,
  onClick,
}: {
  label: string;
  desc: string;
  icon: typeof Bot;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-2 rounded-2xl border p-5 transition-all",
        selected
          ? "border-gold bg-gold/10 shadow-[0_4px_24px_rgba(245,183,0,0.2)]"
          : "border-border bg-white hover:border-gold/50 hover:bg-gold/5",
      )}
    >
      <div
        className={cn(
          "flex h-12 w-12 items-center justify-center rounded-xl",
          selected ? "bg-gold/25 text-gold-warm" : "bg-navy/10 text-navy/70",
        )}
      >
        <Icon className="h-6 w-6" aria-hidden="true" />
      </div>
      <div className="font-display text-lg font-bold text-navy">{label}</div>
      <p className="text-xs text-navy/60">{desc}</p>
    </button>
  );
}

function PseudosScreen({
  p1Default,
  p2Default,
  onBack,
  onContinue,
}: {
  p1Default: string;
  p2Default: string;
  onBack: () => void;
  onContinue: (p1: string, p2: string) => void;
}) {
  const [p1, setP1] = useState(p1Default);
  const [p2, setP2] = useState(p2Default);

  const canContinue = p1.trim().length > 0 && p2.trim().length > 0;

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col items-center justify-center gap-5 p-6">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-sky/15 text-sky">
        <Users className="h-8 w-8" aria-hidden="true" />
      </div>
      <h1 className="font-display text-3xl font-extrabold text-navy">
        Qui joue ?
      </h1>

      <div className="flex w-full flex-col gap-3">
        <label className="flex flex-col gap-1 text-sm font-semibold text-navy">
          Joueur 1
          <input
            type="text"
            value={p1}
            onChange={(e) => setP1(e.target.value)}
            className="h-11 rounded-md border border-border bg-white px-3 text-base text-navy focus:border-gold focus:outline-none"
            autoFocus
            maxLength={24}
          />
        </label>
        <label className="flex flex-col gap-1 text-sm font-semibold text-navy">
          Joueur 2
          <input
            type="text"
            value={p2}
            onChange={(e) => setP2(e.target.value)}
            className="h-11 rounded-md border border-border bg-white px-3 text-base text-navy focus:border-gold focus:outline-none"
            placeholder="Ton ami…"
            maxLength={24}
          />
        </label>
      </div>

      <div className="flex w-full items-center justify-between gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-md border border-border bg-white px-4 py-2 text-sm font-semibold text-navy/70 hover:border-navy/40"
        >
          Retour
        </button>
        <Button
          variant="gold"
          size="lg"
          disabled={!canContinue}
          onClick={() => onContinue(p1.trim(), p2.trim())}
        >
          <Play className="h-4 w-4" aria-hidden="true" fill="currentColor" />
          Continuer
        </Button>
      </div>
    </main>
  );
}

function IntroScreen({
  mode,
  botDifficulty,
  p1Name,
  p2Name,
  onStart,
  onBack,
}: {
  mode: FafMode;
  botDifficulty: BotDifficulty;
  p1Name: string;
  p2Name: string;
  onStart: () => void;
  onBack: () => void;
}) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
      <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-gold/20 shadow-[0_4px_24px_rgba(245,183,0,0.3)]">
        <Swords className="h-12 w-12 text-gold-warm" aria-hidden="true" />
      </div>

      <div className="flex flex-col gap-2">
        <p className="font-display text-sm font-bold uppercase tracking-widest text-buzz">
          Face-à-Face · {mode === "vs_bot" ? `Bot ${BOT_PROFILES[botDifficulty].label}` : "vs Ami"}
        </p>
        <h1 className="font-display text-4xl font-extrabold text-navy sm:text-5xl">
          {p1Name} <span className="text-navy/30">vs</span> {p2Name}
        </h1>
      </div>

      <ul className="flex flex-col gap-2 rounded-xl border border-border bg-white p-5 text-left text-sm text-navy/80 glow-card">
        <li className="flex items-start gap-2">
          <Sword className="mt-1 h-4 w-4 shrink-0 text-buzz" aria-hidden="true" />
          <span>
            <strong>60 secondes</strong> chacun. Bonne réponse = ton chrono fige.
          </span>
        </li>
        <li className="flex items-start gap-2">
          <SkipForward className="mt-1 h-4 w-4 shrink-0 text-sky" aria-hidden="true" />
          <span>
            Mauvaise réponse ou passer : question suivante, ton chrono continue.
          </span>
        </li>
        <li className="flex items-start gap-2">
          <Trophy className="mt-1 h-4 w-4 shrink-0 text-gold-warm" aria-hidden="true" />
          <span>
            Victoire : <strong>500 XP</strong> (si &gt; 30 s restantes), moins
            selon la marge.
          </span>
        </li>
      </ul>

      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={onBack}
          className="rounded-md border border-border bg-white px-4 py-2 text-sm font-semibold text-navy/70 hover:border-navy/40"
        >
          Retour
        </button>
        <button
          type="button"
          onClick={onStart}
          className="inline-flex items-center gap-2 rounded-xl bg-gold px-8 py-4 font-display text-lg font-extrabold uppercase tracking-wide text-navy shadow-[0_6px_0_0_#e89e00] transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(245,183,0,0.55)] active:translate-y-0 active:shadow-[0_2px_0_0_#e89e00]"
        >
          <Play className="h-5 w-5" aria-hidden="true" fill="currentColor" />
          Lancer le duel
        </button>
      </div>
    </main>
  );
}

function PlayerCard({
  name,
  isBot,
  timeLeftMs,
  active,
}: {
  name: string;
  isBot: boolean;
  timeLeftMs: number;
  active: boolean;
}) {
  const seconds = Math.max(0, Math.ceil(timeLeftMs / 1000));
  const critical = timeLeftMs <= 10_000;
  const ratio = Math.max(0, Math.min(1, timeLeftMs / FAF_DURATION_MS));

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-2xl border p-4 transition-all",
        active
          ? "border-gold bg-gold/10 shadow-[0_0_24px_rgba(245,183,0,0.35)]"
          : "border-border bg-white opacity-70",
      )}
    >
      <div className="flex items-center gap-2">
        <div
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-lg",
            isBot
              ? "bg-sky/15 text-sky"
              : active
                ? "bg-gold/25 text-gold-warm"
                : "bg-navy/10 text-navy/70",
          )}
        >
          {isBot ? (
            <Bot className="h-5 w-5" aria-hidden="true" />
          ) : (
            <Crown className="h-5 w-5" aria-hidden="true" />
          )}
        </div>
        <span className="flex-1 truncate font-display text-sm font-bold text-navy">
          {name}
        </span>
        {active && (
          <span className="animate-pulse rounded-full bg-gold px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-navy">
            À toi
          </span>
        )}
      </div>
      <div
        className={cn(
          "mt-2 font-display text-3xl font-extrabold tabular-nums sm:text-4xl",
          critical ? "text-buzz animate-pulse" : active ? "text-navy" : "text-navy/60",
        )}
      >
        {seconds}
        <span className="text-base text-navy/40">s</span>
      </div>
      <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-navy/10">
        <div
          className={cn(
            "h-full transition-all",
            critical ? "bg-buzz" : active ? "bg-gold" : "bg-navy/30",
          )}
          style={{ width: `${ratio * 100}%` }}
        />
      </div>
    </div>
  );
}

function BotThinking({ difficulty }: { difficulty: BotDifficulty }) {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border border-border bg-white p-6 glow-card">
      <div className="flex h-16 w-16 items-center justify-center rounded-full bg-sky/15 text-sky">
        <Brain className="h-8 w-8 animate-pulse" aria-hidden="true" />
      </div>
      <p className="font-display text-lg font-bold text-navy">
        Le bot réfléchit
        <motion.span
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ repeat: Infinity, duration: 1, repeatType: "reverse" }}
        >
          …
        </motion.span>
      </p>
      <p className="text-xs uppercase tracking-widest text-navy/40">
        Difficulté {BOT_PROFILES[difficulty].label}
      </p>
    </div>
  );
}

function TransitionPanel({
  currentAnswer,
  whoJustAnswered,
  whoJustAnsweredIsBot,
  nextPlayerName,
  nextIsBot,
  onContinue,
}: {
  currentAnswer: string;
  whoJustAnswered: string;
  whoJustAnsweredIsBot: boolean;
  nextPlayerName: string;
  nextIsBot: boolean;
  onContinue: () => void;
}) {
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.96 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.96 }}
      transition={{ duration: 0.25 }}
      className="flex flex-col items-center gap-5 rounded-2xl border border-gold/40 bg-gradient-to-br from-gold-pale via-cream to-sky-pale p-8 text-center glow-sun"
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-life-green/25 text-life-green">
        <Trophy className="h-8 w-8" aria-hidden="true" fill="currentColor" />
      </div>
      <div>
        <p className="text-xs font-bold uppercase tracking-widest text-life-green">
          Bonne réponse
        </p>
        <h2 className="mt-1 font-display text-2xl font-extrabold text-navy">
          {whoJustAnsweredIsBot
            ? `Le bot a trouvé : ${currentAnswer}`
            : `${whoJustAnswered} a trouvé : ${currentAnswer}`}
        </h2>
      </div>

      <div className="h-px w-20 bg-navy/15" />

      <div className="flex flex-col items-center gap-2">
        <p className="text-sm uppercase tracking-widest text-navy/50">
          {nextIsBot ? "Au tour du bot" : "Au tour de"}
        </p>
        <p className="font-display text-3xl font-extrabold text-navy">
          {nextPlayerName}
        </p>
      </div>

      <button
        type="button"
        onClick={onContinue}
        className="inline-flex items-center gap-2 rounded-xl bg-gold px-6 py-3 font-display text-base font-extrabold uppercase tracking-wide text-navy shadow-[0_4px_0_0_#e89e00] transition-all hover:-translate-y-0.5 hover:shadow-[0_6px_20px_rgba(245,183,0,0.45)] active:translate-y-0 active:shadow-[0_2px_0_0_#e89e00]"
      >
        <Play className="h-4 w-4" aria-hidden="true" fill="currentColor" />
        Lancer le tour
      </button>
    </motion.div>
  );
}

function ResultsScreen({
  userWon,
  winnerName,
  xpResult,
  isSaving,
  userCorrect,
  mode,
  onReplay,
}: {
  userWon: boolean;
  winnerName: string;
  xpResult: SaveFafResult | null;
  isSaving: boolean;
  userCorrect: number;
  mode: FafMode;
  onReplay: () => void;
}) {
  const xpGained =
    xpResult?.status === "ok" ? xpResult.xpGained : null;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 18 }}
        className={cn(
          "flex h-28 w-28 items-center justify-center rounded-3xl",
          userWon
            ? "bg-gold/20 shadow-[0_0_48px_rgba(245,183,0,0.5)]"
            : "bg-buzz/15",
        )}
      >
        {userWon ? (
          <Trophy className="h-14 w-14 text-gold-warm" aria-hidden="true" fill="currentColor" />
        ) : (
          <Sword className="h-14 w-14 text-buzz" aria-hidden="true" />
        )}
      </motion.div>

      <div className="flex flex-col gap-2">
        <h1 className="font-display text-4xl font-extrabold text-navy">
          {userWon ? "Victoire !" : mode === "vs_ami" ? `${winnerName} l'emporte` : "Défaite"}
        </h1>
        <p className="text-navy/70">
          {userWon
            ? "Tu as fait tomber l'adversaire avant 0. Beau duel."
            : mode === "vs_bot"
              ? "Le bot t'a eu cette fois. Retente."
              : "Tu as grillé ton chrono. Reviens plus affûté."}
        </p>
      </div>

      <div className="grid w-full grid-cols-2 gap-3">
        <StatCell label="Tes bonnes" value={String(userCorrect)} tone="green" />
        <StatCell
          label="XP gagnés"
          value={
            isSaving
              ? "…"
              : xpGained !== null
                ? `+${xpGained}`
                : xpResult?.status === "error"
                  ? "—"
                  : "…"
          }
          tone="gold"
        />
      </div>

      {xpResult?.status === "error" && (
        <p className="rounded-md border border-buzz/40 bg-buzz/10 px-3 py-2 text-sm text-buzz">
          Sauvegarde BDD échouée : {xpResult.message}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button variant="gold" size="lg" onClick={onReplay}>
          <Repeat className="h-4 w-4" aria-hidden="true" />
          Rejouer
        </Button>
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

function StatCell({
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
