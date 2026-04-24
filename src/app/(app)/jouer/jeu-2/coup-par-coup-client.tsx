"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  BarChart3,
  Check,
  Grid3x3,
  Home,
  Play,
  Repeat,
  Sword,
  Trophy,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { LifeBar } from "@/components/game/LifeBar";
import {
  CPC_MAX_ERRORS,
  CPC_ROUNDS_PER_GAME,
  CPC_VALID_PER_ROUND,
  CPC_XP_GAME_PERFECT_BONUS,
  CPC_XP_PER_CORRECT,
  CPC_XP_ROUND_PERFECT_BONUS,
  computeCpcXp,
  cpcIsGameOver,
  cpcLifeState,
  type CpcRound,
  type CpcRoundResult,
} from "@/lib/game-logic/coup-par-coup";
import { playSound } from "@/lib/sounds";
import { cn } from "@/lib/utils";
import { saveCoupParCoupSession, type SaveCpcResult } from "./actions";

type Phase = "intro" | "playing" | "round-ended" | "results";

interface CoupParCoupClientProps {
  rounds: CpcRound[];
}

const NEXT_ROUND_DELAY_MS = 2200;

export function CoupParCoupClient({ rounds }: CoupParCoupClientProps) {
  const router = useRouter();

  const [phase, setPhase] = useState<Phase>("intro");
  const [roundIndex, setRoundIndex] = useState(0);
  const [clicked, setClicked] = useState<Set<string>>(new Set());
  const [roundResults, setRoundResults] = useState<CpcRoundResult[]>([]);
  const [shakeText, setShakeText] = useState<string | null>(null);
  const [saveResult, setSaveResult] = useState<SaveCpcResult | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const startedAtRef = useRef<number>(0);

  const current = rounds[roundIndex];
  const wrongCount = roundResults.filter((r) => r.hitIntrus).length;
  const life = cpcLifeState(wrongCount);

  // ---- Actions -------------------------------------------------------------

  const start = useCallback(() => {
    startedAtRef.current = Date.now();
    setPhase("playing");
  }, []);

  const endRound = useCallback(
    (result: CpcRoundResult) => {
      const nextResults = [...roundResults, result];
      setRoundResults(nextResults);

      const gameOver = cpcIsGameOver(
        nextResults.filter((r) => r.hitIntrus).length,
      );
      const isLastRound = roundIndex >= rounds.length - 1;

      setPhase("round-ended");
      window.setTimeout(() => {
        if (gameOver) {
          playSound("lose");
          setPhase("results");
        } else if (isLastRound) {
          // Fin normale : partie terminée sans game over
          const anyWin = nextResults.some((r) => r.status === "perfect");
          playSound(anyWin ? "win" : "ding");
          setPhase("results");
        } else {
          setRoundIndex((i) => i + 1);
          setClicked(new Set());
          setPhase("playing");
        }
      }, NEXT_ROUND_DELAY_MS);
    },
    [roundIndex, roundResults, rounds.length],
  );

  const handleClick = useCallback(
    (prop: { text: string; isValid: boolean }) => {
      if (phase !== "playing") return;
      if (clicked.has(prop.text)) return;
      if (!current) return;

      const nextClicked = new Set(clicked);
      nextClicked.add(prop.text);
      setClicked(nextClicked);

      if (prop.isValid) {
        playSound("ding");
        // Check : les 6 valides sont-elles cliquées ?
        const validCount = current.propositions.filter(
          (p) => p.isValid && nextClicked.has(p.text),
        ).length;
        if (validCount >= CPC_VALID_PER_ROUND) {
          playSound("win");
          endRound({
            questionId: current.questionId,
            correctClicks: CPC_VALID_PER_ROUND,
            hitIntrus: false,
            status: "perfect",
          });
        }
      } else {
        // L'intrus
        playSound("buzz");
        setShakeText(prop.text);
        window.setTimeout(() => setShakeText(null), 500);
        const correctClicks = current.propositions.filter(
          (p) => p.isValid && clicked.has(p.text),
        ).length;
        endRound({
          questionId: current.questionId,
          correctClicks,
          hitIntrus: true,
          status: "caught-intrus",
        });
      }
    },
    [phase, clicked, current, endRound],
  );

  // ---- Sauvegarde ----------------------------------------------------------

  useEffect(() => {
    if (phase !== "results" || saveResult || isSaving) return;
    setIsSaving(true);
    const xp = computeCpcXp(roundResults);
    const duration = Math.round((Date.now() - startedAtRef.current) / 1000);
    saveCoupParCoupSession({
      rounds: roundResults,
      wrongCount,
      xpGained: xp,
      durationSeconds: duration,
      gameOver: cpcIsGameOver(wrongCount),
    })
      .then(setSaveResult)
      .finally(() => setIsSaving(false));
  }, [phase, roundResults, wrongCount, saveResult, isSaving]);

  // ---- Écrans --------------------------------------------------------------

  if (phase === "intro") {
    return <IntroScreen onStart={start} totalRounds={rounds.length} />;
  }

  if (phase === "results") {
    return (
      <ResultsScreen
        results={roundResults}
        totalRounds={rounds.length}
        gameOver={cpcIsGameOver(wrongCount)}
        saveResult={saveResult}
        isSaving={isSaving}
        allRounds={rounds}
        onReplay={() => {
          router.refresh();
          setPhase("intro");
          setRoundIndex(0);
          setClicked(new Set());
          setRoundResults([]);
          setSaveResult(null);
        }}
      />
    );
  }

  // phase === "playing" or "round-ended"
  if (!current) return null;

  const lastResult = roundResults[roundResults.length - 1];
  const showingFeedback = phase === "round-ended";

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 p-4 sm:p-6 lg:p-8">
      {/* Header : progression + vies */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm text-navy/70">
          <Grid3x3 className="h-4 w-4 text-sky" aria-hidden="true" />
          <span>
            Manche <span className="font-bold text-navy">{roundIndex + 1}</span>{" "}
            / {rounds.length}
          </span>
        </div>
        <LifeBar state={life} />
      </div>

      {/* Barre de progression globale */}
      <div className="h-1.5 w-full overflow-hidden rounded-full bg-navy/10">
        <div
          className="h-full bg-sky transition-all"
          style={{
            width: `${((roundIndex + (showingFeedback ? 1 : 0)) / rounds.length) * 100}%`,
          }}
        />
      </div>

      {/* Thème */}
      <div className="rounded-2xl border border-border bg-card p-5 text-center glow-card sm:p-6">
        {current.category && (
          <span
            className="inline-flex items-center rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide text-navy"
            style={{ backgroundColor: current.category.couleur ?? "#F5B700" }}
          >
            {current.category.nom}
          </span>
        )}
        <h1 className="mt-3 font-display text-2xl font-extrabold text-navy sm:text-3xl">
          {current.theme}
        </h1>
        <p className="mt-1 text-sm text-navy/60">
          6 propositions liées · évite l'<strong className="text-buzz">intrus</strong>
        </p>
      </div>

      {/* Grille des 7 propositions */}
      <AnimatePresence mode="popLayout">
        <motion.div
          key={`grid-${roundIndex}`}
          className="grid gap-2.5 sm:grid-cols-2"
          initial="hidden"
          animate="visible"
          variants={{
            visible: { transition: { staggerChildren: 0.04 } },
          }}
        >
          {current.propositions.map((prop) => {
            const isClicked = clicked.has(prop.text);
            const isValidClick = isClicked && prop.isValid;
            const isIntrusClick = isClicked && !prop.isValid;
            // Pendant la phase feedback, on révèle tout l'intrus (même non cliqué)
            const isRevealedIntrus =
              showingFeedback && !prop.isValid && !isClicked;

            let state:
              | "idle"
              | "clicked-valid"
              | "clicked-intrus"
              | "revealed-intrus" = "idle";
            if (isValidClick) state = "clicked-valid";
            else if (isIntrusClick) state = "clicked-intrus";
            else if (isRevealedIntrus) state = "revealed-intrus";

            return (
              <PropButton
                key={prop.text}
                text={prop.text}
                state={state}
                shaking={shakeText === prop.text}
                disabled={isClicked || showingFeedback}
                onClick={() => handleClick(prop)}
              />
            );
          })}
        </motion.div>
      </AnimatePresence>

      {/* Feedback de fin de round */}
      {showingFeedback && lastResult && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className={cn(
            "rounded-xl border p-4 text-sm",
            lastResult.status === "perfect"
              ? "border-life-green/40 bg-life-green/10 text-life-green"
              : "border-buzz/40 bg-buzz/10 text-buzz",
          )}
        >
          <p className="font-bold">
            {lastResult.status === "perfect"
              ? `Manche parfaite ! +${CPC_XP_PER_CORRECT * CPC_VALID_PER_ROUND + CPC_XP_ROUND_PERFECT_BONUS} XP`
              : `L'intrus était : ${current.propositions.find((p) => !p.isValid)?.text}`}
          </p>
          {current.explication && lastResult.status !== "perfect" && (
            <p className="mt-1 text-xs text-navy/70">{current.explication}</p>
          )}
        </motion.div>
      )}
    </main>
  );
}

// =============================================================================
// PropButton
// =============================================================================

function PropButton({
  text,
  state,
  shaking,
  disabled,
  onClick,
}: {
  text: string;
  state: "idle" | "clicked-valid" | "clicked-intrus" | "revealed-intrus";
  shaking: boolean;
  disabled: boolean;
  onClick: () => void;
}) {
  const base =
    "relative flex min-h-[56px] w-full items-center justify-center rounded-xl border-2 px-4 py-3 text-base font-semibold transition-all outline-none focus-visible:ring-2 focus-visible:ring-gold";

  const stateClasses = {
    idle:
      "border-border bg-card text-navy hover:border-sky hover:bg-sky/10 hover:scale-[1.02] cursor-pointer shadow-[0_2px_0_0_rgba(11,31,77,0.08)]",
    "clicked-valid":
      "border-life-green bg-life-green/15 text-life-green line-through decoration-2",
    "clicked-intrus":
      "border-buzz bg-buzz/15 text-buzz shadow-[0_0_24px_rgba(230,57,70,0.4)]",
    "revealed-intrus":
      "border-buzz bg-buzz/5 text-buzz border-dashed",
  }[state];

  return (
    <motion.button
      type="button"
      disabled={disabled}
      onClick={onClick}
      variants={{
        hidden: { opacity: 0, y: 10 },
        visible: { opacity: 1, y: 0 },
      }}
      animate={shaking ? { x: [0, -8, 8, -4, 4, 0] } : undefined}
      transition={{ duration: 0.35 }}
      className={cn(base, stateClasses, "disabled:cursor-not-allowed")}
    >
      <span>{text}</span>
      {state === "clicked-valid" && (
        <Check
          className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2"
          aria-hidden="true"
        />
      )}
      {state === "clicked-intrus" && (
        <X
          className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2"
          aria-hidden="true"
        />
      )}
      {state === "revealed-intrus" && (
        <X
          className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-70"
          aria-hidden="true"
        />
      )}
    </motion.button>
  );
}

// =============================================================================
// IntroScreen
// =============================================================================

function IntroScreen({
  onStart,
  totalRounds,
}: {
  onStart: () => void;
  totalRounds: number;
}) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-8 p-8 text-center">
      <div className="relative">
        <div className="absolute inset-0 -z-10 animate-sun-pulse rounded-full bg-sky/30 blur-3xl" />
        <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-white shadow-[0_4px_24px_rgba(43,142,230,0.35)]">
          <Grid3x3 className="h-12 w-12 text-sky" aria-hidden="true" />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <p className="font-display text-sm font-bold uppercase tracking-widest text-sky">
          Jeu 2
        </p>
        <h1 className="font-display text-4xl font-extrabold text-navy sm:text-5xl">
          Le Coup par Coup
        </h1>
        <p className="text-navy/70 sm:text-lg">
          À chaque manche : <strong>7 propositions</strong>, dont{" "}
          <strong className="text-life-green">6 liées</strong> au thème et{" "}
          <strong className="text-buzz">1 intrus</strong>.
          <br />
          Clique les 6 liées sans jamais toucher l'intrus.
        </p>
      </div>

      <ul className="flex w-full flex-col gap-2 rounded-xl border border-border bg-white p-5 text-left text-sm text-navy/80 glow-card">
        <li className="flex items-start gap-2">
          <LifeBar state="yellow" className="mt-0.5 scale-75" />
          <span>
            <strong>2 paliers</strong> : 1ère erreur = orange · 2e erreur =
            rouge → Face-à-Face pénalité.
          </span>
        </li>
        <li className="flex items-start gap-2">
          <Grid3x3
            className="mt-0.5 h-4 w-4 shrink-0 text-sky"
            aria-hidden="true"
          />
          <span>
            <strong>{totalRounds} manches</strong> enchaînées, thèmes variés.
          </span>
        </li>
        <li className="flex items-start gap-2">
          <Trophy
            className="mt-0.5 h-4 w-4 shrink-0 text-gold-warm"
            aria-hidden="true"
          />
          <span>
            <strong>+{CPC_XP_PER_CORRECT} XP</strong> par bonne proposition ·
            <strong> +{CPC_XP_ROUND_PERFECT_BONUS} XP</strong> bonus par manche
            parfaite · <strong>+{CPC_XP_GAME_PERFECT_BONUS} XP</strong> si les{" "}
            {totalRounds} manches sont parfaites.
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
    </main>
  );
}

// =============================================================================
// ResultsScreen
// =============================================================================

function ResultsScreen({
  results,
  totalRounds,
  gameOver,
  saveResult,
  isSaving,
  allRounds,
  onReplay,
}: {
  results: CpcRoundResult[];
  totalRounds: number;
  gameOver: boolean;
  saveResult: SaveCpcResult | null;
  isSaving: boolean;
  allRounds: CpcRound[];
  onReplay: () => void;
}) {
  const perfectRounds = results.filter((r) => r.status === "perfect").length;
  const allPerfect = perfectRounds === totalRounds && !gameOver;
  const xpGained = saveResult?.status === "ok" ? saveResult.xpGained : null;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <motion.div
        initial={{ scale: 0.8, opacity: 0 }}
        animate={{ scale: 1, opacity: 1 }}
        transition={{ type: "spring", stiffness: 200, damping: 18 }}
        className={cn(
          "flex h-28 w-28 items-center justify-center rounded-3xl",
          gameOver
            ? "bg-buzz/15"
            : allPerfect
              ? "bg-gold/20 shadow-[0_0_48px_rgba(245,183,0,0.5)]"
              : "bg-sky/15",
        )}
      >
        {gameOver ? (
          <Sword className="h-14 w-14 text-buzz" aria-hidden="true" />
        ) : allPerfect ? (
          <Trophy
            className="h-14 w-14 text-gold-warm"
            aria-hidden="true"
            fill="currentColor"
          />
        ) : (
          <Grid3x3 className="h-14 w-14 text-sky" aria-hidden="true" />
        )}
      </motion.div>

      <div className="flex flex-col gap-2">
        <h1 className="font-display text-4xl font-extrabold text-navy">
          {gameOver
            ? "Face-à-Face !"
            : allPerfect
              ? "Sans faute !"
              : "Partie terminée"}
        </h1>
        <p className="text-navy/70 sm:text-lg">
          {gameOver
            ? `Tu as touché ${CPC_MAX_ERRORS} intrus. Bascule en Face-à-Face pour te racheter.`
            : allPerfect
              ? `${totalRounds} manches sans jamais toucher l'intrus. Propre.`
              : `${perfectRounds} manche${perfectRounds > 1 ? "s" : ""} parfaite${perfectRounds > 1 ? "s" : ""} sur ${totalRounds}.`}
        </p>
      </div>

      {/* Récap par round */}
      <ul className="flex w-full flex-col gap-2 rounded-xl border border-border bg-white p-4 text-left text-sm glow-card">
        {allRounds.slice(0, results.length).map((r, i) => {
          const res = results[i];
          if (!res) return null;
          const intrus = r.propositions.find((p) => !p.isValid);
          return (
            <li key={r.questionId} className="flex items-center gap-3">
              <span
                className={cn(
                  "flex h-6 w-6 shrink-0 items-center justify-center rounded-full font-bold text-xs",
                  res.status === "perfect"
                    ? "bg-life-green/20 text-life-green"
                    : "bg-buzz/20 text-buzz",
                )}
              >
                {res.status === "perfect" ? (
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                ) : (
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                )}
              </span>
              <span className="flex-1 font-semibold text-navy">{r.theme}</span>
              <span className="text-xs text-navy/50">
                {res.status === "perfect"
                  ? `${res.correctClicks}/6`
                  : `intrus : ${intrus?.text}`}
              </span>
            </li>
          );
        })}
      </ul>

      {/* XP */}
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-6 py-3 glow-card">
        <Trophy
          className="h-6 w-6 text-gold-warm"
          aria-hidden="true"
          fill="currentColor"
        />
        <span className="font-display text-lg font-bold text-navy">
          {isSaving
            ? "Enregistrement…"
            : xpGained !== null
              ? `+${xpGained} XP`
              : saveResult?.status === "error"
                ? "— XP"
                : "…"}
        </span>
      </div>

      {saveResult?.status === "error" && (
        <p
          className="rounded-md border border-buzz/40 bg-buzz/10 px-3 py-2 text-sm text-buzz"
          role="alert"
        >
          Sauvegarde BDD échouée : {saveResult.message}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-center gap-3">
        {gameOver ? (
          <Link
            href="/jouer/face-a-face"
            className="inline-flex items-center gap-2 rounded-xl bg-buzz px-8 py-4 font-display text-lg font-extrabold uppercase tracking-wide text-cream shadow-[0_6px_0_0_#b5141f] transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(230,57,70,0.55)] active:translate-y-0 active:shadow-[0_2px_0_0_#b5141f]"
          >
            <Sword className="h-5 w-5" aria-hidden="true" />
            Lancer le Face-à-Face
          </Link>
        ) : (
          <Button variant="gold" size="lg" onClick={onReplay}>
            <Repeat className="h-4 w-4" aria-hidden="true" />
            Rejouer
          </Button>
        )}
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
