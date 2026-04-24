"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  BarChart3,
  Bot,
  Check,
  Crown,
  Grid3x3,
  Home,
  Play,
  Repeat,
  Sword,
  Swords,
  Trophy,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { DuelPanel } from "@/components/game/DuelPanel";
import { LifeBar } from "@/components/game/LifeBar";
import { PlayerSetup } from "@/components/game/PlayerSetup";
import {
  CPC_MAX_ERRORS,
  CPC_ROUNDS_PER_GAME,
  CPC_VALID_PER_ROUND,
  botPickCpcProposition,
  computeCpcXp,
  cpcIsGameOver,
  cpcLifeState,
  type CpcProposition,
  type CpcRound,
  type CpcRoundResult,
} from "@/lib/game-logic/coup-par-coup";
import type { DuelResult, DuelTheme } from "@/lib/game-logic/duel";
import {
  BOT_PROFILES,
  botResponseDelayMs,
  type BotDifficulty,
} from "@/lib/game-logic/faceAFace";
import type { MultiConfig, PlayerConfig } from "@/lib/game-logic/players";
import { playSound } from "@/lib/sounds";
import { cn } from "@/lib/utils";
import {
  saveCoupParCoupSession,
  type SaveCpcResult,
} from "./actions";

type Phase =
  | "setup"
  | "intro"
  | "playing"
  | "round-ended"
  | "rouge-announce"
  | "duel"
  | "results";

interface CoupParCoupClientProps {
  rounds: CpcRound[];
  duelThemes: DuelTheme[];
  userPseudo: string;
}

const ROUND_FEEDBACK_MS = 2000;
const ROUGE_ANNOUNCE_MS = 3200;

export function CoupParCoupClient({
  rounds,
  duelThemes,
  userPseudo,
}: CoupParCoupClientProps) {
  const router = useRouter();

  // --- setup / config ------------------------------------------------------
  const [phase, setPhase] = useState<Phase>("setup");
  const [config, setConfig] = useState<MultiConfig | null>(null);

  // --- game state ----------------------------------------------------------
  const [playersErrors, setPlayersErrors] = useState<Record<string, number>>({});
  const [currentPlayerIdx, setCurrentPlayerIdx] = useState(0);
  const [roundIndex, setRoundIndex] = useState(0);
  const [clicked, setClicked] = useState<Set<string>>(new Set());
  const [shakeText, setShakeText] = useState<string | null>(null);
  const [roundResults, setRoundResults] = useState<CpcRoundResult[]>([]);
  const [rougePlayerId, setRougePlayerId] = useState<string | null>(null);
  const [duelResult, setDuelResult] = useState<DuelResult | null>(null);
  const [lastRoundLog, setLastRoundLog] = useState<
    { playerId: string; hitIntrus: boolean }[]
  >([]);

  // --- persistence ---------------------------------------------------------
  const [saveResult, setSaveResult] = useState<SaveCpcResult | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const startedAtRef = useRef<number>(0);

  const players = config?.players ?? [];
  const currentPlayer = players[currentPlayerIdx];
  const botDifficulty: BotDifficulty = config?.botDifficulty ?? "moyen";
  const current = rounds[roundIndex];

  // -------------------------------------------------------------------------
  // Setup ready
  // -------------------------------------------------------------------------
  const handleSetupReady = useCallback((cfg: MultiConfig) => {
    setConfig(cfg);
    const errs: Record<string, number> = {};
    for (const p of cfg.players) errs[p.id] = 0;
    setPlayersErrors(errs);
    setPhase("intro");
  }, []);

  // -------------------------------------------------------------------------
  // Start game
  // -------------------------------------------------------------------------
  const startGame = useCallback(() => {
    setRoundIndex(0);
    setClicked(new Set());
    setRoundResults([]);
    setShakeText(null);
    setRougePlayerId(null);
    setDuelResult(null);
    setCurrentPlayerIdx(0);
    setLastRoundLog([]);
    startedAtRef.current = Date.now();
    setPhase("playing");
  }, []);

  // -------------------------------------------------------------------------
  // End round helper
  // -------------------------------------------------------------------------
  const endRound = useCallback(
    (result: CpcRoundResult, triggeredRougeId: string | null) => {
      setRoundResults((prev) => [...prev, result]);
      setPhase("round-ended");

      const isLastRound = roundIndex >= rounds.length - 1;

      window.setTimeout(() => {
        if (triggeredRougeId) {
          setRougePlayerId(triggeredRougeId);
          setPhase("rouge-announce");
          playSound("lose");
          return;
        }
        if (isLastRound) {
          const anyPerfect = result.status === "perfect";
          playSound(anyPerfect ? "win" : "ding");
          setPhase("results");
        } else {
          setRoundIndex((i) => i + 1);
          setClicked(new Set());
          setLastRoundLog([]);
          // Repart au même joueur actif (tour par tour continue logiquement)
          setPhase("playing");
        }
      }, ROUND_FEEDBACK_MS);
    },
    [roundIndex, rounds.length],
  );

  // -------------------------------------------------------------------------
  // Handle proposition click (humain OU bot)
  // -------------------------------------------------------------------------
  const processClick = useCallback(
    (prop: CpcProposition) => {
      if (!currentPlayer || !current) return;
      if (clicked.has(prop.text)) return;

      const nextClicked = new Set(clicked);
      nextClicked.add(prop.text);
      setClicked(nextClicked);

      setLastRoundLog((prev) => [
        ...prev,
        { playerId: currentPlayer.id, hitIntrus: !prop.isValid },
      ]);

      if (prop.isValid) {
        playSound("ding");

        // Est-ce que les 6 valides sont cliquées ?
        const validCount = current.propositions.filter(
          (p) => p.isValid && nextClicked.has(p.text),
        ).length;

        if (validCount >= CPC_VALID_PER_ROUND) {
          playSound("win");
          endRound(
            {
              questionId: current.questionId,
              correctClicks: CPC_VALID_PER_ROUND,
              hitIntrus: false,
              status: "perfect",
            },
            /* rouge */ null,
          );
          return;
        }

        // Passe au joueur suivant, même round
        const nextIdx = (currentPlayerIdx + 1) % players.length;
        setCurrentPlayerIdx(nextIdx);
      } else {
        // Intrus !
        playSound("buzz");
        setShakeText(prop.text);
        window.setTimeout(() => setShakeText(null), 500);

        const newErrors = (playersErrors[currentPlayer.id] ?? 0) + 1;
        setPlayersErrors((prev) => ({
          ...prev,
          [currentPlayer.id]: newErrors,
        }));

        const correctClicks = current.propositions.filter(
          (p) => p.isValid && clicked.has(p.text),
        ).length;

        endRound(
          {
            questionId: current.questionId,
            correctClicks,
            hitIntrus: true,
            status: "caught-intrus",
          },
          /* rouge */ cpcIsGameOver(newErrors) ? currentPlayer.id : null,
        );
      }
    },
    [
      currentPlayer,
      current,
      clicked,
      currentPlayerIdx,
      players.length,
      playersErrors,
      endRound,
    ],
  );

  const handleHumanClick = useCallback(
    (prop: CpcProposition) => {
      if (phase !== "playing") return;
      if (currentPlayer?.isBot) return;
      processClick(prop);
    },
    [phase, currentPlayer, processClick],
  );

  // -------------------------------------------------------------------------
  // Bot turn
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (phase !== "playing") return;
    if (!currentPlayer?.isBot) return;
    if (!current) return;

    const delay = botResponseDelayMs(botDifficulty);
    const id = window.setTimeout(() => {
      const pickIdx = botPickCpcProposition(
        current.propositions,
        clicked,
        botDifficulty,
      );
      const prop = current.propositions[pickIdx];
      if (prop) processClick(prop);
    }, delay);
    return () => window.clearTimeout(id);
  }, [phase, currentPlayer, current, clicked, botDifficulty, processClick]);

  // -------------------------------------------------------------------------
  // Rouge-announce → Duel
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (phase !== "rouge-announce") return;
    const id = window.setTimeout(() => {
      setPhase("duel");
    }, ROUGE_ANNOUNCE_MS);
    return () => window.clearTimeout(id);
  }, [phase]);

  // -------------------------------------------------------------------------
  // Persistance
  // -------------------------------------------------------------------------
  useEffect(() => {
    if (phase !== "results") return;
    if (saveResult || isSaving) return;
    setIsSaving(true);

    const xp = computeCpcXp(roundResults);
    const duration = Math.round((Date.now() - startedAtRef.current) / 1000);
    const globalErrors = roundResults.filter((r) => r.hitIntrus).length;

    void saveCoupParCoupSession({
      rounds: roundResults,
      wrongCount: globalErrors,
      xpGained: xp,
      durationSeconds: duration,
      gameOver: rougePlayerId !== null,
    })
      .then(setSaveResult)
      .finally(() => setIsSaving(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [phase]);

  // -------------------------------------------------------------------------
  // Rendu
  // -------------------------------------------------------------------------
  if (phase === "setup") {
    return (
      <PlayerSetup
        gameLabel="Le Coup par Coup"
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
    const rougeP = players.find((p) => p.id === rougePlayerId);
    return <RougeAnnounceScreen rougePlayer={rougeP ?? null} />;
  }

  if (phase === "duel") {
    const rougeP = players.find((p) => p.id === rougePlayerId);
    const others = players.filter((p) => p.id !== rougePlayerId);
    if (!rougeP || others.length === 0) {
      setPhase("results");
      return null;
    }
    if (duelThemes.length < 1) {
      return (
        <main className="mx-auto flex w-full max-w-xl flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-buzz/15 text-buzz">
            <Swords className="h-10 w-10" aria-hidden="true" />
          </div>
          <h1 className="font-display text-3xl font-extrabold text-navy">
            Pas de thème Duel en base
          </h1>
          <Button
            variant="gold"
            size="lg"
            onClick={() => setPhase("results")}
          >
            Voir les résultats
          </Button>
        </main>
      );
    }
    // 2e Duel (après Coup par Coup) : un seul thème imposé
    return (
      <DuelPanel
        rougePlayer={rougeP}
        otherPlayers={others}
        themes={duelThemes}
        isSecondDuel={true}
        botDifficulty={botDifficulty}
        onComplete={(result) => {
          setDuelResult(result);
          setPhase("results");
        }}
      />
    );
  }

  if (phase === "results") {
    const winnerP = duelResult
      ? (players.find((p) => p.id === duelResult.winnerId) ?? null)
      : null;
    const eliminatedP = duelResult
      ? (players.find((p) => p.id === duelResult.eliminatedId) ?? null)
      : null;
    return (
      <ResultsScreen
        players={players}
        playersErrors={playersErrors}
        results={roundResults}
        totalRounds={rounds.length}
        gameOver={rougePlayerId !== null}
        rougePlayer={players.find((p) => p.id === rougePlayerId) ?? null}
        duelWinner={winnerP}
        duelEliminated={eliminatedP}
        saveResult={saveResult}
        isSaving={isSaving}
        allRounds={rounds}
        onReplay={() => {
          router.refresh();
          setPhase("setup");
          setConfig(null);
          setRoundResults([]);
          setDuelResult(null);
          setRougePlayerId(null);
        }}
      />
    );
  }

  // phase === "playing" or "round-ended"
  if (!current || !currentPlayer) return null;
  const showingFeedback = phase === "round-ended";
  const lastResult = roundResults[roundResults.length - 1];

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-5 p-4 sm:p-6 lg:p-8">
      {/* Header : progression + joueurs */}
      <div className="flex items-center justify-between gap-4">
        <div className="flex items-center gap-2 text-sm text-navy/70">
          <Grid3x3 className="h-4 w-4 text-sky" aria-hidden="true" />
          <span>
            Manche <span className="font-bold text-navy">{roundIndex + 1}</span>{" "}
            / {rounds.length}
          </span>
        </div>
      </div>

      {/* Cartes joueurs */}
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
            active={i === currentPlayerIdx && phase === "playing"}
          />
        ))}
      </div>

      {/* Progression globale */}
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
          6 propositions liées · évite l&apos;
          <strong className="text-buzz">intrus</strong>
        </p>
      </div>

      {/* Indicateur tour */}
      <div className="text-center">
        <p className="text-xs uppercase tracking-widest text-navy/50">
          Au tour de
        </p>
        <p className="font-display text-xl font-extrabold text-navy">
          {currentPlayer.pseudo}
          {currentPlayer.isBot && (
            <span className="ml-1 text-xs text-sky">(bot)</span>
          )}
        </p>
      </div>

      {/* Propositions */}
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

            const clickerId = lastRoundLog.find(
              (l) => !l.hitIntrus || isIntrusClick,
            )?.playerId;
            void clickerId;

            return (
              <PropButton
                key={prop.text}
                text={prop.text}
                state={state}
                shaking={shakeText === prop.text}
                disabled={
                  isClicked || showingFeedback || currentPlayer.isBot
                }
                onClick={() => handleHumanClick(prop)}
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
              ? `Manche parfaite !`
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
// PlayerBadge
// =============================================================================

function PlayerBadge({
  player,
  errors,
  active,
}: {
  player: PlayerConfig;
  errors: number;
  active: boolean;
}) {
  const life = cpcLifeState(errors);
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
        <span className="flex-1 truncate text-xs font-bold text-navy">
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

// =============================================================================
// Rouge announce
// =============================================================================

function RougeAnnounceScreen({
  rougePlayer,
}: {
  rougePlayer: PlayerConfig | null;
}) {
  return (
    <main className="relative mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-6 overflow-hidden p-8 text-center">
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
        className="font-display text-4xl font-extrabold text-navy sm:text-5xl"
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

// =============================================================================
// IntroScreen
// =============================================================================

function IntroScreen({
  players,
  onStart,
}: {
  players: PlayerConfig[];
  onStart: () => void;
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
          Chacun clique <strong>une proposition</strong> à son tour.
        </p>
      </div>

      <ul className="flex w-full flex-col gap-2 rounded-xl border border-border bg-white p-5 text-left text-sm text-navy/80 glow-card">
        <li className="flex items-start gap-2">
          <LifeBar state="yellow" className="mt-0.5 scale-75" />
          <span>
            <strong>2 intrus = rouge</strong>. Premier au rouge = Duel.
          </span>
        </li>
        <li className="flex items-start gap-2">
          <Grid3x3
            className="mt-0.5 h-4 w-4 shrink-0 text-sky"
            aria-hidden="true"
          />
          <span>
            <strong>{CPC_ROUNDS_PER_GAME} manches</strong> enchaînées, thèmes
            variés.
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
                : "border-gold/50 bg-gold/10 text-navy",
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
        className="inline-flex items-center gap-2 rounded-xl bg-gold px-10 py-5 font-display text-xl font-extrabold uppercase tracking-wide text-navy shadow-[0_6px_0_0_#e89e00] transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(245,183,0,0.55)] active:translate-y-0 active:shadow-[0_2px_0_0_#e89e00]"
      >
        <Play className="h-5 w-5" aria-hidden="true" fill="currentColor" />
        C&apos;est parti !
      </button>
    </main>
  );
}

// =============================================================================
// ResultsScreen
// =============================================================================

function ResultsScreen({
  players,
  playersErrors,
  results,
  totalRounds,
  gameOver,
  rougePlayer,
  duelWinner,
  duelEliminated,
  saveResult,
  isSaving,
  allRounds,
  onReplay,
}: {
  players: PlayerConfig[];
  playersErrors: Record<string, number>;
  results: CpcRoundResult[];
  totalRounds: number;
  gameOver: boolean;
  rougePlayer: PlayerConfig | null;
  duelWinner: PlayerConfig | null;
  duelEliminated: PlayerConfig | null;
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
            ? "Coup par Coup terminé"
            : allPerfect
              ? "Sans faute !"
              : "Partie terminée"}
        </h1>
        <p className="text-navy/70 sm:text-lg">
          {gameOver && rougePlayer
            ? `${rougePlayer.pseudo} a touché ${CPC_MAX_ERRORS} intrus.`
            : allPerfect
              ? `${totalRounds} manches sans jamais toucher l'intrus. Propre.`
              : `${perfectRounds} manche${perfectRounds > 1 ? "s" : ""} parfaite${perfectRounds > 1 ? "s" : ""} sur ${totalRounds}.`}
        </p>
        {duelWinner && duelEliminated && (
          <p className="mt-1 rounded-md border border-border bg-white px-3 py-2 text-sm text-navy">
            <strong className="text-gold-warm">Duel :</strong>{" "}
            <strong>{duelWinner.pseudo}</strong> gagne,{" "}
            <strong className="text-buzz">{duelEliminated.pseudo}</strong>{" "}
            éliminé.
          </p>
        )}
      </div>

      {/* Récap joueurs */}
      <ul className="flex w-full flex-col gap-2 rounded-xl border border-border bg-white p-4 text-left text-sm glow-card">
        {players.map((p) => {
          const errs = playersErrors[p.id] ?? 0;
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
              <span className="flex-1 font-semibold text-navy">{p.pseudo}</span>
              <span className="text-xs text-navy/60">
                {errs} intrus{errs > 1 ? "" : ""}
              </span>
              {errs >= CPC_MAX_ERRORS && (
                <span className="rounded-full bg-buzz/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-buzz">
                  Rouge
                </span>
              )}
            </li>
          );
        })}
      </ul>

      {/* Récap rounds */}
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

// Ensure BOT_PROFILES is referenced (prevents unused import lint)
void BOT_PROFILES;
