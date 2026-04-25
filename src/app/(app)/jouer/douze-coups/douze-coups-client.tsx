"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Bot,
  Check,
  Crown,
  Grid3x3,
  Home,
  Play,
  Repeat,
  SkipForward,
  Sword,
  Swords,
  Trophy,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { AnswerButton } from "@/components/game/AnswerButton";
import { DuelPanel } from "@/components/game/DuelPanel";
import { FeedbackCountdown } from "@/components/game/FeedbackCountdown";
import { TransitionDuelOverlay } from "@/components/game/TransitionDuelOverlay";
import { LifeBar } from "@/components/game/LifeBar";
import { QuestionCard } from "@/components/game/QuestionCard";
import { SpeakerButton } from "@/components/game/SpeakerButton";
import {
  FloatingRestartButton,
  SpectatorBanner,
} from "@/components/game/SpectatorBanner";
import { VoiceInput } from "@/components/game/VoiceInput";
import { Button } from "@/components/ui/button";
import type { CeQuestion } from "@/lib/game-logic/coup-d-envoi";
import {
  formatLabel,
  stripFormatPrefix,
} from "@/lib/game-logic/coup-d-envoi";
import type { CpcRound } from "@/lib/game-logic/coup-par-coup";
import {
  CPC_VALID_PER_ROUND,
  botPickCpcProposition,
} from "@/lib/game-logic/coup-par-coup";
import {
  DC_STARTING_CAGNOTTE,
  dcLifeState,
  dcPodium,
  type DcPlayer,
  type DcPlayerColor,
} from "@/lib/game-logic/douze-coups";
import {
  buildDuelThemes,
  pickDuelQuestion,
  shuffleDuelAnswers,
  type DuelResult,
  type DuelTheme,
} from "@/lib/game-logic/duel";
import {
  FAF_DURATION_MS,
  botAnswersCorrectly,
  botResponseDelayMs,
  nextQuestionIndex,
  type FafQuestion,
} from "@/lib/game-logic/faceAFace";
import { isMatch } from "@/lib/matching/fuzzy-match";
import { playSound } from "@/lib/sounds";
import { cn } from "@/lib/utils";
import type { Database } from "@/types/database";
import {
  useDouzeCoupsStore,
  availableDuelThemes,
} from "@/stores/douzeCoupsStore";
import { saveDouzeCoupsSession, type SaveDcResult } from "./actions";
import { DcSetupScreen, type DcSetupResult } from "./setup-screen";
import { DcIntroScreen } from "./intro-screen";

type CategoryRow = Pick<
  Database["public"]["Tables"]["categories"]["Row"],
  "id" | "nom" | "slug" | "couleur"
>;

interface DouzeCoupsClientProps {
  ceQuestions: CeQuestion[];
  cpcRounds: CpcRound[];
  duelThemes: DuelTheme[];
  quizz4CountByCategory: Map<number, number>;
  fafQuestions: FafQuestion[];
  categories: CategoryRow[];
  userPseudo: string;
}

// ===========================================================================
// Orchestrator
// ===========================================================================

export function DouzeCoupsClient(props: DouzeCoupsClientProps) {
  const {
    ceQuestions,
    cpcRounds,
    duelThemes,
    quizz4CountByCategory,
    fafQuestions,
    categories,
    userPseudo,
  } = props;

  const phase = useDouzeCoupsStore((s) => s.phase);
  const initParty = useDouzeCoupsStore((s) => s.initParty);
  const startIntro = useDouzeCoupsStore((s) => s.startIntro);
  const startJeu1 = useDouzeCoupsStore((s) => s.startJeu1);
  const reset = useDouzeCoupsStore((s) => s.reset);
  const players = useDouzeCoupsStore((s) => s.players);
  const userPlayerId = players[0]?.id ?? "";

  // On retient la dernière config de setup pour pouvoir relancer une partie
  // identique sans repasser par le formulaire complet (rematch).
  const [lastSetup, setLastSetup] = useState<DcSetupResult | null>(null);
  // Une fois que l'utilisateur a fait son choix sur l'encart spectateur,
  // on ne le réaffiche plus (juste le bouton flottant).
  const [spectatorAcked, setSpectatorAcked] = useState(false);

  // Re-init au démarrage d'une nouvelle partie : on remet à zéro l'état
  // d'acquittement spectateur.
  useEffect(() => {
    if (phase === "setup" || phase === "intro") {
      setSpectatorAcked(false);
    }
  }, [phase]);

  function startGame(result: DcSetupResult): boolean {
    const { ok, error } = initParty({
      players: result.players,
      categories,
      quizz4CountByCategory,
    });
    if (!ok) {
      alert(error ?? "Impossible de démarrer la partie.");
      return false;
    }
    setLastSetup(result);
    setSpectatorAcked(false);
    startIntro();
    return true;
  }

  function rematch() {
    if (!lastSetup) return;
    reset();
    // Petit délai pour laisser le store reset se propager avant re-init
    window.setTimeout(() => startGame(lastSetup), 0);
  }

  if (phase === "setup") {
    return <DcSetupScreen userPseudo={userPseudo} onReady={startGame} />;
  }

  if (phase === "intro") {
    return <DcIntroScreen onEnd={() => startJeu1()} />;
  }

  // --- Détection mode spectateur (humain user éliminé) -----------------
  // Convention : `players[0]` = l'humain user (premier slot du setup).
  const userPlayer = players[0];
  const userEliminated = !!userPlayer && userPlayer.isEliminated;
  const otherHumansAlive = players.some(
    (p, i) => i !== 0 && !p.isBot && !p.isEliminated,
  );
  const canRestart = userEliminated && !otherHumansAlive && !!lastSetup;
  const showSpectatorBanner =
    userEliminated && phase !== "results" && !spectatorAcked;
  const showFloatingRestart =
    userEliminated && phase !== "results" && spectatorAcked && canRestart;

  // Pendant `transition_duel`, on garde le rendu du jeu en cours pour
  // que l'utilisateur continue à voir la question + le feedback complet
  // (bonne réponse, explication). Le stage gère lui-même l'overlay du
  // sas 20 s et le freeze des interactions.
  const pendingReturnPhase = useDouzeCoupsStore(
    (s) => s.pendingDuel?.returnPhase ?? null,
  );

  function renderStage() {
    if (phase === "jeu1") return <DcJeu1Stage ceQuestions={ceQuestions} />;
    if (phase === "transition_duel" && pendingReturnPhase === "jeu1") {
      return <DcJeu1Stage ceQuestions={ceQuestions} />;
    }
    if (phase === "transition_duel" && pendingReturnPhase === "jeu2") {
      return <DcJeu2Stage cpcRounds={cpcRounds} />;
    }
    if (phase === "duel") return <DcDuelStage duelThemes={duelThemes} />;
    if (phase === "jeu2") return <DcJeu2Stage cpcRounds={cpcRounds} />;
    if (phase === "faceaface")
      return <DcFaceAFaceStage fafQuestions={fafQuestions} />;
    if (phase === "results")
      return <DcResultsScreen userPlayerId={userPlayerId} />;
    return null;
  }

  return (
    <>
      {showSpectatorBanner && (
        <div className="mx-auto w-full max-w-3xl px-4 pt-4">
          <SpectatorBanner
            canRestart={canRestart}
            onRestart={rematch}
            onContinueWatching={() => setSpectatorAcked(true)}
          />
        </div>
      )}
      {renderStage()}
      <FloatingRestartButton visible={showFloatingRestart} onRestart={rematch} />
    </>
  );
}

// ===========================================================================
// PlayersBar — affichage permanent des joueurs avec cagnotte
// ===========================================================================

function PlayersBar({
  players,
  currentPlayerIdx,
}: {
  players: DcPlayer[];
  currentPlayerIdx: number;
}) {
  return (
    <div
      className={cn(
        "grid gap-2",
        players.length <= 2 && "grid-cols-2",
        players.length === 3 && "grid-cols-3",
        players.length === 4 && "grid-cols-2 sm:grid-cols-4",
      )}
    >
      {players.map((p, i) => (
        <PlayerBadge
          key={p.id}
          player={p}
          active={i === currentPlayerIdx && !p.isEliminated}
        />
      ))}
    </div>
  );
}

function PlayerBadge({
  player,
  active,
}: {
  player: DcPlayer;
  active: boolean;
}) {
  const life = dcLifeState(player.errors);
  const colorStyle = playerColorStyle(player.color);

  return (
    <motion.div
      layout
      animate={active ? { scale: 1.03 } : { scale: 1 }}
      transition={{ type: "spring", stiffness: 260, damping: 20 }}
      className={cn(
        "relative flex flex-col gap-1 rounded-xl border p-2.5 transition-all",
        player.isEliminated
          ? "border-navy/10 bg-navy/5 opacity-50"
          : cn(colorStyle.border, colorStyle.bgSoft),
        active &&
          !player.isEliminated &&
          cn(colorStyle.borderActive, colorStyle.shadow, colorStyle.bgActive),
      )}
    >
      {player.isEliminated && (
        <span className="absolute -right-1 -top-1 rotate-12 rounded-full bg-buzz px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-widest text-cream shadow-md">
          Éliminé
        </span>
      )}
      <div className="flex items-center gap-1.5">
        <div
          className={cn(
            "flex h-6 w-6 shrink-0 items-center justify-center rounded-md",
            colorStyle.iconBg,
          )}
        >
          {player.isBot ? (
            <Bot className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <Crown className="h-3.5 w-3.5" aria-hidden="true" />
          )}
        </div>
        <span
          className={cn(
            "flex-1 truncate text-xs font-bold",
            player.isEliminated ? "text-navy/40" : colorStyle.text,
          )}
        >
          {player.pseudo}
        </span>
      </div>
      <motion.div
        key={life}
        initial={{ scale: 0.85 }}
        animate={{ scale: 1 }}
        transition={{ type: "spring", stiffness: 320, damping: 16 }}
      >
        <LifeBar state={life} className="scale-75 origin-left" />
      </motion.div>
      <p
        className={cn(
          "font-display text-sm font-extrabold tabular-nums",
          player.isEliminated ? "text-navy/40" : "text-gold-warm",
        )}
      >
        {formatMoney(player.cagnotte)}
      </p>
    </motion.div>
  );
}

interface PlayerColorStyle {
  border: string;
  borderActive: string;
  bgSoft: string;
  bgActive: string;
  shadow: string;
  iconBg: string;
  text: string;
}

function playerColorStyle(color: DcPlayerColor): PlayerColorStyle {
  switch (color) {
    case "gold":
      return {
        border: "border-gold/30",
        borderActive: "border-gold",
        bgSoft: "bg-gold/5",
        bgActive: "bg-gold/15",
        shadow: "shadow-[0_0_24px_rgba(245,183,0,0.35)]",
        iconBg: "bg-gold/20 text-gold-warm",
        text: "text-gold-warm",
      };
    case "sky":
      return {
        border: "border-sky/30",
        borderActive: "border-sky",
        bgSoft: "bg-sky/5",
        bgActive: "bg-sky/15",
        shadow: "shadow-[0_0_24px_rgba(43,142,230,0.35)]",
        iconBg: "bg-sky/20 text-sky",
        text: "text-sky",
      };
    case "buzz":
      return {
        border: "border-buzz/30",
        borderActive: "border-buzz",
        bgSoft: "bg-buzz/5",
        bgActive: "bg-buzz/15",
        shadow: "shadow-[0_0_24px_rgba(230,57,70,0.35)]",
        iconBg: "bg-buzz/20 text-buzz",
        text: "text-buzz",
      };
    case "life-green":
      return {
        border: "border-life-green/30",
        borderActive: "border-life-green",
        bgSoft: "bg-life-green/5",
        bgActive: "bg-life-green/15",
        shadow: "shadow-[0_0_24px_rgba(46,204,113,0.35)]",
        iconBg: "bg-life-green/20 text-life-green",
        text: "text-life-green",
      };
  }
}

function formatMoney(amount: number): string {
  return `${amount.toLocaleString("fr-FR")} €`;
}

// ===========================================================================
// DcJeu1Stage — Le Coup d'Envoi multijoueur
// ===========================================================================

function DcJeu1Stage({ ceQuestions }: { ceQuestions: CeQuestion[] }) {
  const players = useDouzeCoupsStore((s) => s.players);
  const currentPlayerIdx = useDouzeCoupsStore((s) => s.currentPlayerIdx);
  const recordCorrect = useDouzeCoupsStore((s) => s.recordCorrect);
  const recordWrong = useDouzeCoupsStore((s) => s.recordWrong);
  const nextPlayer = useDouzeCoupsStore((s) => s.nextPlayer);

  const [qIdx, setQIdx] = useState(0);
  const usedIdxRef = useRef<Set<number>>(new Set([0]));
  const [feedback, setFeedback] = useState<
    | { kind: "correct"; correctIdx: number }
    | {
        kind: "wrong";
        selectedIdx: number;
        correctIdx: number;
        correctText: string;
        explication: string | null;
      }
    | null
  >(null);

  const isTransitioningRef = useRef(false);
  const pendingTimerRef = useRef<number | null>(null);

  const currentPlayer = players[currentPlayerIdx];
  const currentQuestion = ceQuestions[qIdx];

  useEffect(() => {
    return () => {
      if (pendingTimerRef.current !== null) {
        window.clearTimeout(pendingTimerRef.current);
      }
    };
  }, []);

  const advanceToNext = useCallback(() => {
    const next = nextQuestionIndex(ceQuestions.length, usedIdxRef.current);
    if (next >= 0) {
      usedIdxRef.current.add(next);
      setQIdx(next);
    }
    setFeedback(null);
    nextPlayer();
    isTransitioningRef.current = false;
  }, [ceQuestions.length, nextPlayer]);

  const processAnswer = useCallback(
    (selectedIdx: number) => {
      if (!currentQuestion || !currentPlayer || isTransitioningRef.current)
        return;
      const correctIdx = currentQuestion.reponses.findIndex((r) => r.correct);
      const isCorrect = selectedIdx === correctIdx;
      const correctText = currentQuestion.reponses[correctIdx]?.text ?? "";

      isTransitioningRef.current = true;
      setFeedback(
        isCorrect
          ? { kind: "correct", correctIdx }
          : {
              kind: "wrong",
              selectedIdx,
              correctIdx,
              correctText,
              explication: currentQuestion.explication,
            },
      );
      if (isCorrect) {
        playSound("ding");
        recordCorrect(currentPlayer.id);
      } else {
        playSound("buzz");
        recordWrong(currentPlayer.id, "jeu1");
      }

      // Plus de setTimeout auto, même pour les bots : c'est `FeedbackCountdown`
      // qui pilote le passage à la question suivante dans TOUS les cas.
      // Humain : 30 s. Bot : 8 s avec bouton "Suivant" pour accélérer.
      // Évite l'enchaînement trop rapide des questions quand plusieurs bots
      // jouent à la suite (l'humain spectateur n'avait pas le temps de lire).
    },
    [currentQuestion, currentPlayer, recordCorrect, recordWrong, advanceToNext],
  );

  // Bot auto-answer
  useEffect(() => {
    if (!currentPlayer?.isBot) return;
    if (!currentQuestion) return;
    if (isTransitioningRef.current) return;
    const delay = botResponseDelayMs(currentPlayer.botLevel ?? "moyen");
    const t = window.setTimeout(() => {
      if (isTransitioningRef.current) return;
      const correct = botAnswersCorrectly(currentPlayer.botLevel ?? "moyen");
      const correctIdx = currentQuestion.reponses.findIndex((r) => r.correct);
      const wrongIdx = correctIdx === 0 ? 1 : 0;
      processAnswer(correct ? correctIdx : wrongIdx);
    }, delay);
    return () => window.clearTimeout(t);
  }, [currentPlayer, currentQuestion, processAnswer]);

  // Keyboard shortcuts for humans
  useEffect(() => {
    if (currentPlayer?.isBot) return;
    function onKey(e: KeyboardEvent) {
      if (e.repeat) return;
      if (
        e.key === "ArrowLeft" ||
        e.key.toLowerCase() === "a" ||
        e.key === "1"
      ) {
        e.preventDefault();
        processAnswer(0);
      } else if (
        e.key === "ArrowRight" ||
        e.key.toLowerCase() === "b" ||
        e.key === "2"
      ) {
        e.preventDefault();
        processAnswer(1);
      }
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [currentPlayer, processAnswer]);

  if (!currentQuestion || !currentPlayer) return null;
  const displayEnonce = stripFormatPrefix(currentQuestion.enonce);
  const formatLbl = formatLabel(currentQuestion.format);

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-4 p-4 sm:p-6 lg:p-8">
      <PhaseLabel label="Jeu 1 · Le Coup d'Envoi" />
      <PlayersBar players={players} currentPlayerIdx={currentPlayerIdx} />

      <div className="flex flex-col items-center gap-2">
        {formatLbl && (
          <span className="rounded-full bg-gold/20 px-3 py-1 text-xs font-bold uppercase tracking-widest text-gold-warm">
            {formatLbl}
          </span>
        )}
        <SpeakerButton
          text={`${formatLbl ? formatLbl + ". " : ""}${displayEnonce}`}
        />
      </div>

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

      <TurnLabel player={currentPlayer} />

      <div className="grid w-full gap-3 sm:grid-cols-2">
        {currentQuestion.reponses.map((r, idx) => {
          let state: "idle" | "correct" | "wrong" = "idle";
          if (feedback) {
            if (idx === feedback.correctIdx) state = "correct";
            else if (
              feedback.kind === "wrong" &&
              idx === feedback.selectedIdx
            )
              state = "wrong";
          }
          const keyHint = idx === 0 ? "A" : "B";
          return (
            <AnswerButton
              key={idx}
              state={state}
              keyHint={keyHint}
              disabled={feedback !== null || currentPlayer.isBot}
              onClick={() => processAnswer(idx)}
            >
              {r.text}
            </AnswerButton>
          );
        })}
      </div>

      <WrongFeedback feedback={feedback} />

      {/* Bouton "Passer à la suite" + countdown, visible dès qu'une réponse
          a été enregistrée. Humain : 30 s pour lire / relire l'explication.
          Bot : 8 s avec bouton "Suivant" pour permettre à l'humain
          spectateur de voir la bonne réponse + l'explication des bots
          mais d'accélérer s'il a déjà compris. */}
      {feedback && (
        <FeedbackCountdown
          key={`countdown-${currentQuestion.id}-${currentPlayerIdx}`}
          seconds={currentPlayer.isBot ? 8 : 30}
          label={currentPlayer.isBot ? "Suivant" : "Passer à la suite"}
          onSkip={advanceToNext}
        />
      )}

      <p className="text-center text-xs text-navy/40">
        <ArrowLeft className="inline h-3 w-3 align-text-bottom" aria-hidden="true" />{" "}
        A pour la gauche · B pour la droite{" "}
        <ArrowRight className="inline h-3 w-3 align-text-bottom" aria-hidden="true" />
      </p>
    </main>
  );
}

/** Encart d'erreur : bonne réponse attendue + explication si dispo. */
function WrongFeedback({
  feedback,
}: {
  feedback:
    | { kind: "correct"; correctIdx: number }
    | {
        kind: "wrong";
        selectedIdx: number;
        correctIdx: number;
        correctText: string;
        explication: string | null;
      }
    | null;
}) {
  if (!feedback || feedback.kind !== "wrong") return null;
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-buzz/40 bg-buzz/10 p-4 text-sm text-navy"
    >
      <p className="font-display text-base font-bold text-buzz">
        Mauvaise réponse
      </p>
      <p className="mt-1">
        La bonne réponse était&nbsp;:{" "}
        <strong className="text-life-green">{feedback.correctText}</strong>
      </p>
      {feedback.explication && (
        <p className="mt-2 text-navy/80">{feedback.explication}</p>
      )}
    </motion.div>
  );
}

// ===========================================================================
// DcDuelStage — utilise DuelPanel existant + applique le résultat au store
// ===========================================================================

function DcDuelStage({ duelThemes }: { duelThemes: DuelTheme[] }) {
  const players = useDouzeCoupsStore((s) => s.players);
  const pendingDuel = useDouzeCoupsStore((s) => s.pendingDuel);
  const storeThemes = useDouzeCoupsStore((s) => s.duelThemes);
  const designateAdversary = useDouzeCoupsStore((s) => s.designateAdversary);
  const resolveDuel = useDouzeCoupsStore((s) => s.resolveDuel);

  // Annonce rouge (overlay 2,5 s avant DuelPanel)
  const [showAnnounce, setShowAnnounce] = useState(true);
  useEffect(() => {
    playSound("duel");
    const t = window.setTimeout(() => setShowAnnounce(false), 2500);
    return () => window.clearTimeout(t);
  }, []);

  const challengerPlayer = useMemo(
    () => players.find((p) => p.id === pendingDuel?.challengerId) ?? null,
    [players, pendingDuel],
  );
  const otherPlayers = useMemo(
    () =>
      players.filter(
        (p) => !p.isEliminated && p.id !== pendingDuel?.challengerId,
      ),
    [players, pendingDuel],
  );

  // Filtre les thèmes dispos (non consommés)
  const availableCategories = useMemo(() => {
    if (!storeThemes) return [];
    return availableDuelThemes(storeThemes);
  }, [storeThemes]);
  const availableThemeObjects = useMemo(() => {
    return duelThemes.filter((t) =>
      availableCategories.some((c) => c.id === t.categoryId),
    );
  }, [duelThemes, availableCategories]);

  // Mapping pour convertir le PlayerConfig attendu par DuelPanel
  const rougePlayerForPanel = useMemo(() => {
    if (!challengerPlayer) return null;
    return {
      id: challengerPlayer.id,
      pseudo: challengerPlayer.pseudo,
      isBot: challengerPlayer.isBot,
    };
  }, [challengerPlayer]);

  const othersForPanel = useMemo(
    () =>
      otherPlayers.map((p) => ({
        id: p.id,
        pseudo: p.pseudo,
        isBot: p.isBot,
      })),
    [otherPlayers],
  );

  if (showAnnounce) {
    return <RougeAnnounce player={challengerPlayer} />;
  }

  if (
    !challengerPlayer ||
    !rougePlayerForPanel ||
    othersForPanel.length === 0 ||
    availableThemeObjects.length === 0
  ) {
    return (
      <main className="mx-auto flex flex-1 flex-col items-center justify-center gap-4 p-8 text-center">
        <p className="text-navy/60">
          Duel impossible (pas d&apos;adversaire ou pas de thème dispo).
          Passage direct…
        </p>
      </main>
    );
  }

  return (
    <DuelPanel
      rougePlayer={rougePlayerForPanel}
      otherPlayers={othersForPanel}
      themes={availableThemeObjects}
      isSecondDuel={availableThemeObjects.length === 1}
      botDifficulty={challengerPlayer.botLevel ?? "moyen"}
      onComplete={(result: DuelResult) => {
        // Le thème choisi = on doit le retrouver via le questionId
        // Simplification : on sait que result.eliminatedId et result.winnerId.
        // Pour `consumeDuelTheme`, il faut la category. DuelPanel ne le retourne
        // pas directement, mais on peut retrouver via la question.
        // On transmet `undefined` pour la catégorie : le store décide de
        // consommer le premier thème dispo correspondant à la question.
        // Pour simplifier ici, on passe -1 et le store fera son choix.
        designateAdversary(result.eliminatedId === challengerPlayer.id
          ? result.winnerId
          : result.eliminatedId);
        resolveDuel(
          result.adversaryAnsweredCorrectly,
          findCategoryForQuestion(duelThemes, result.questionId) ?? -1,
        );
      }}
    />
  );
}

function findCategoryForQuestion(
  themes: DuelTheme[],
  questionId: string,
): number | undefined {
  for (const t of themes) {
    if (t.questions.some((q) => q.id === questionId)) {
      return t.categoryId;
    }
  }
  return undefined;
}

function RougeAnnounce({ player }: { player: DcPlayer | null }) {
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
      {player && (
        <motion.p
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="font-display text-xl font-bold uppercase tracking-widest text-buzz"
        >
          {player.pseudo} passe au rouge
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
        initial={{ opacity: 0, scale: 0.3 }}
        animate={{ opacity: 1, scale: [0.3, 1.4, 1] }}
        transition={{ delay: 1.3, duration: 0.9 }}
        className="font-display text-6xl font-extrabold uppercase tracking-widest text-buzz sm:text-8xl"
      >
        Duel&nbsp;!
      </motion.p>
    </main>
  );
}

// ===========================================================================
// DcJeu2Stage — Le Coup par Coup multijoueur
// ===========================================================================

function DcJeu2Stage({ cpcRounds }: { cpcRounds: CpcRound[] }) {
  const players = useDouzeCoupsStore((s) => s.players);
  const currentPlayerIdx = useDouzeCoupsStore((s) => s.currentPlayerIdx);
  const recordCorrect = useDouzeCoupsStore((s) => s.recordCorrect);
  const recordWrong = useDouzeCoupsStore((s) => s.recordWrong);
  const nextPlayer = useDouzeCoupsStore((s) => s.nextPlayer);
  const advanceToFaceAFace = useDouzeCoupsStore((s) => s.advanceToFaceAFace);
  const forceResetErrorsJeu2 = useDouzeCoupsStore((s) => s.forceResetErrorsJeu2);

  const [roundIdx, setRoundIdx] = useState(0);
  const [clicked, setClicked] = useState<Set<string>>(new Set());
  const [shakeText, setShakeText] = useState<string | null>(null);
  const [showingFeedback, setShowingFeedback] = useState(false);
  const isTransitioningRef = useRef(false);

  // Safety net : à l'entrée en Jeu 2, on s'assure que tous les survivants
  // sont à 0 erreur (pour éviter un bug où une erreur résiduelle de Jeu 1
  // ferait passer au rouge dès la 1re erreur de Jeu 2).
  useEffect(() => {
    forceResetErrorsJeu2();
  }, [forceResetErrorsJeu2]);

  const currentPlayer = players[currentPlayerIdx];
  const current = cpcRounds[roundIdx];

  const endRound = useCallback(
    (hitIntrus: boolean) => {
      setShowingFeedback(true);
      window.setTimeout(() => {
        setShowingFeedback(false);
        setClicked(new Set());
        // passe au round suivant (ou recycle)
        setRoundIdx((i) => (i + 1) % cpcRounds.length);
        nextPlayer();
        isTransitioningRef.current = false;
        void hitIntrus;
      }, 1800);
    },
    [cpcRounds.length, nextPlayer],
  );

  const processClick = useCallback(
    (propText: string, isValid: boolean) => {
      if (!current || !currentPlayer) return;
      if (isTransitioningRef.current) return;
      if (clicked.has(propText)) return;

      const nextClicked = new Set(clicked);
      nextClicked.add(propText);
      setClicked(nextClicked);

      if (isValid) {
        playSound("ding");
        recordCorrect(currentPlayer.id);
        const validCount = current.propositions.filter(
          (p) => p.isValid && nextClicked.has(p.text),
        ).length;
        if (validCount >= CPC_VALID_PER_ROUND) {
          playSound("win");
          isTransitioningRef.current = true;
          endRound(false);
        } else {
          nextPlayer();
        }
      } else {
        playSound("buzz");
        setShakeText(propText);
        window.setTimeout(() => setShakeText(null), 500);
        isTransitioningRef.current = true;
        recordWrong(currentPlayer.id, "jeu2");
        endRound(true);
      }
    },
    [
      current,
      currentPlayer,
      clicked,
      recordCorrect,
      recordWrong,
      endRound,
      nextPlayer,
    ],
  );

  // Bot auto-click
  useEffect(() => {
    if (!currentPlayer?.isBot) return;
    if (!current) return;
    if (isTransitioningRef.current) return;
    if (showingFeedback) return;
    const delay = botResponseDelayMs(currentPlayer.botLevel ?? "moyen");
    const t = window.setTimeout(() => {
      if (isTransitioningRef.current) return;
      const idx = botPickCpcProposition(
        current.propositions,
        clicked,
        currentPlayer.botLevel ?? "moyen",
      );
      const prop = current.propositions[idx];
      if (prop) processClick(prop.text, prop.isValid);
    }, delay);
    return () => window.clearTimeout(t);
  }, [currentPlayer, current, clicked, showingFeedback, processClick]);

  // Skip to face-a-face if <=2 alive
  useEffect(() => {
    const alive = players.filter((p) => !p.isEliminated).length;
    if (alive <= 2) {
      advanceToFaceAFace();
    }
  }, [players, advanceToFaceAFace]);

  if (!current || !currentPlayer) return null;

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-4 p-4 sm:p-6 lg:p-8">
      <PhaseLabel label="Jeu 2 · Le Coup par Coup" />
      <PlayersBar players={players} currentPlayerIdx={currentPlayerIdx} />

      <div className="rounded-2xl border border-border bg-card p-5 text-center glow-card">
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
        <div className="mt-3 flex justify-center">
          <SpeakerButton
            text={`${current.theme}. Six propositions liées, évite l'intrus.`}
          />
        </div>
      </div>

      <TurnLabel player={currentPlayer} />

      <div className="grid gap-2.5 sm:grid-cols-2">
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

          return (
            <CpcPropButton
              key={prop.text}
              text={prop.text}
              state={state}
              shaking={shakeText === prop.text}
              disabled={
                isClicked || showingFeedback || currentPlayer.isBot
              }
              onClick={() => processClick(prop.text, prop.isValid)}
            />
          );
        })}
      </div>
    </main>
  );
}

function CpcPropButton({
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
    "relative flex min-h-[56px] w-full items-center justify-center rounded-xl border-2 px-4 py-3 text-base font-semibold transition-all";

  const stateClasses = {
    idle:
      "border-border bg-card text-navy hover:border-sky hover:bg-sky/10 hover:scale-[1.02]",
    "clicked-valid":
      "border-life-green bg-life-green/15 text-life-green line-through decoration-2",
    "clicked-intrus":
      "border-buzz bg-buzz/15 text-buzz shadow-[0_0_24px_rgba(230,57,70,0.4)]",
    "revealed-intrus": "border-buzz bg-buzz/5 text-buzz border-dashed",
  }[state];

  return (
    <motion.button
      type="button"
      disabled={disabled}
      onClick={onClick}
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
    </motion.button>
  );
}

// ===========================================================================
// DcFaceAFaceStage — final 2 joueurs restants
// ===========================================================================

function DcFaceAFaceStage({
  fafQuestions,
}: {
  fafQuestions: FafQuestion[];
}) {
  const players = useDouzeCoupsStore((s) => s.players);
  const finalizeFaceAFace = useDouzeCoupsStore((s) => s.finalizeFaceAFace);
  const alivePlayers = players.filter((p) => !p.isEliminated);

  // 2 premiers survivants
  const p1 = alivePlayers[0];
  const p2 = alivePlayers[1];

  const [p1Time, setP1Time] = useState(FAF_DURATION_MS);
  const [p2Time, setP2Time] = useState(FAF_DURATION_MS);
  const [activeIdx, setActiveIdx] = useState<0 | 1>(0);
  const [qIdx, setQIdx] = useState(0);
  const usedIdxRef = useRef<Set<number>>(new Set([0]));
  const [flash, setFlash] = useState<{
    kind: "wrong" | "pass";
    correctAnswer: string;
  } | null>(null);
  const [phaseLocal, setPhaseLocal] = useState<
    "playing" | "transition" | "done"
  >("playing");
  const [winnerLocalIdx, setWinnerLocalIdx] = useState<0 | 1 | null>(null);
  const isTransitioningRef = useRef(false);

  const activePlayer = activeIdx === 0 ? p1 : p2;
  const currentQuestion = fafQuestions[qIdx];

  // Chrono tick
  useEffect(() => {
    if (phaseLocal !== "playing") return;
    let raf = 0;
    let last = performance.now();
    const loop = (now: number) => {
      const dt = now - last;
      last = now;
      if (activeIdx === 0) setP1Time((t) => Math.max(0, t - dt));
      else setP2Time((t) => Math.max(0, t - dt));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [phaseLocal, activeIdx]);

  // Timeout detection
  useEffect(() => {
    if (phaseLocal !== "playing") return;
    if (winnerLocalIdx !== null) return;
    if (p1Time <= 0) {
      setWinnerLocalIdx(1);
      setPhaseLocal("done");
      playSound("lose");
    } else if (p2Time <= 0) {
      setWinnerLocalIdx(0);
      setPhaseLocal("done");
      playSound("win");
    }
  }, [p1Time, p2Time, phaseLocal, winnerLocalIdx]);

  // Apply final result to store when local 'done' — élimine le perdant,
  // transfère sa cagnotte au vainqueur, puis passe en 'results'.
  useEffect(() => {
    if (phaseLocal !== "done") return;
    if (winnerLocalIdx === null) return;
    if (!p1 || !p2) return;
    const winner = winnerLocalIdx === 0 ? p1 : p2;
    const loser = winnerLocalIdx === 0 ? p2 : p1;
    finalizeFaceAFace(winner.id, loser.id);
  }, [phaseLocal, winnerLocalIdx, p1, p2, finalizeFaceAFace]);

  const advance = useCallback(() => {
    const next = nextQuestionIndex(fafQuestions.length, usedIdxRef.current);
    if (next >= 0) {
      usedIdxRef.current.add(next);
      setQIdx(next);
    }
    setFlash(null);
    isTransitioningRef.current = false;
  }, [fafQuestions.length]);

  const handleAnswer = useCallback(
    (raw: string) => {
      if (phaseLocal !== "playing" || isTransitioningRef.current) return;
      if (!currentQuestion) return;
      const value = raw.trim();
      if (!value) return;
      const correct = isMatch(
        value,
        currentQuestion.bonne_reponse,
        currentQuestion.alias,
      );
      if (correct) {
        playSound("ding");
        isTransitioningRef.current = true;
        setPhaseLocal("transition");
      } else {
        playSound("buzz");
        isTransitioningRef.current = true;
        setFlash({
          kind: "wrong",
          correctAnswer: currentQuestion.bonne_reponse,
        });
        window.setTimeout(() => advance(), 1400);
      }
    },
    [phaseLocal, currentQuestion, advance],
  );

  const handlePass = useCallback(() => {
    if (phaseLocal !== "playing" || isTransitioningRef.current) return;
    if (!currentQuestion) return;
    playSound("tick");
    isTransitioningRef.current = true;
    setFlash({
      kind: "pass",
      correctAnswer: currentQuestion.bonne_reponse,
    });
    window.setTimeout(() => advance(), 1400);
  }, [phaseLocal, currentQuestion, advance]);

  const continueTurn = useCallback(() => {
    if (phaseLocal !== "transition") return;
    setActiveIdx((prev) => (prev === 0 ? 1 : 0));
    advance();
    setPhaseLocal("playing");
  }, [phaseLocal, advance]);

  // Bot answer
  useEffect(() => {
    if (phaseLocal !== "playing") return;
    if (!activePlayer?.isBot) return;
    if (!currentQuestion) return;
    if (isTransitioningRef.current) return;
    const delay = botResponseDelayMs(activePlayer.botLevel ?? "moyen");
    const t = window.setTimeout(() => {
      if (isTransitioningRef.current) return;
      const correct = botAnswersCorrectly(activePlayer.botLevel ?? "moyen");
      if (correct) {
        playSound("ding");
        isTransitioningRef.current = true;
        setPhaseLocal("transition");
      } else {
        playSound("buzz");
        isTransitioningRef.current = true;
        setFlash({
          kind: "pass",
          correctAnswer: currentQuestion.bonne_reponse,
        });
        window.setTimeout(() => advance(), 1400);
      }
    }, delay);
    return () => window.clearTimeout(t);
  }, [phaseLocal, activePlayer, currentQuestion, advance]);

  if (!p1 || !p2 || !currentQuestion) {
    return (
      <main className="mx-auto flex flex-1 items-center justify-center p-8">
        <p className="text-navy/60">Préparation du Face-à-Face…</p>
      </main>
    );
  }

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-5 p-4 sm:p-6 lg:p-8">
      <PhaseLabel label="Face-à-Face final" />

      <div className="grid grid-cols-2 gap-3">
        <FafPlayerCard
          name={p1.pseudo}
          cagnotte={p1.cagnotte}
          isBot={p1.isBot}
          timeLeft={p1Time}
          active={activeIdx === 0 && phaseLocal === "playing"}
        />
        <FafPlayerCard
          name={p2.pseudo}
          cagnotte={p2.cagnotte}
          isBot={p2.isBot}
          timeLeft={p2Time}
          active={activeIdx === 1 && phaseLocal === "playing"}
        />
      </div>

      {phaseLocal === "transition" ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.96 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center gap-5 rounded-2xl border border-gold/40 bg-gradient-to-br from-gold-pale via-cream to-sky-pale p-8 text-center glow-sun"
        >
          <Trophy
            className="h-12 w-12 text-life-green"
            aria-hidden="true"
            fill="currentColor"
          />
          <p className="font-display text-xl font-bold text-navy">
            {activePlayer?.pseudo} a trouvé
          </p>
          <p className="text-sm text-navy/70">
            Réponse : <strong>{currentQuestion.bonne_reponse}</strong>
          </p>
          <Button variant="gold" size="lg" onClick={continueTurn}>
            <Play className="h-4 w-4" aria-hidden="true" fill="currentColor" />
            Au tour de {activeIdx === 0 ? p2.pseudo : p1.pseudo}
          </Button>
        </motion.div>
      ) : (
        <>
          <QuestionCard
            keyId={currentQuestion.id}
            enonce={currentQuestion.enonce}
            category={currentQuestion.category?.nom}
            categoryColor={currentQuestion.category?.couleur ?? undefined}
            difficulte={currentQuestion.difficulte}
          />
          <div className="flex justify-center">
            <SpeakerButton text={currentQuestion.enonce} />
          </div>
          <AnimatePresence>
            {flash && (
              <motion.div
                initial={{ opacity: 0, y: -8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
                className="mx-auto rounded-xl border border-buzz/40 bg-buzz/10 px-4 py-3 text-center text-sm text-buzz"
              >
                <p className="font-display font-bold text-buzz">
                  {flash.kind === "wrong"
                    ? "Mauvaise réponse"
                    : activePlayer?.isBot
                      ? "Le bot passe"
                      : "Passé"}
                </p>
                <p className="mt-1 text-navy">
                  La bonne réponse était&nbsp;:{" "}
                  <strong className="text-life-green">
                    {flash.correctAnswer}
                  </strong>
                </p>
              </motion.div>
            )}
          </AnimatePresence>
          {activePlayer?.isBot ? (
            <BotThinkingMini name={activePlayer.pseudo} />
          ) : (
            <div className="flex flex-col gap-3">
              <VoiceInput
                onSubmit={handleAnswer}
                placeholder="Ta réponse…"
                focusKey={`${activeIdx}-${qIdx}`}
                disabled={phaseLocal !== "playing"}
              />
              <button
                type="button"
                onClick={handlePass}
                disabled={phaseLocal !== "playing"}
                className="mx-auto inline-flex items-center gap-1.5 rounded-md border border-navy/20 bg-white/60 px-4 py-2 text-sm font-semibold text-navy hover:border-navy/40 hover:bg-navy/5 disabled:opacity-40"
              >
                <SkipForward className="h-4 w-4" aria-hidden="true" />
                Passer
              </button>
            </div>
          )}
        </>
      )}
    </main>
  );
}

function BotThinkingMini({ name }: { name: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-white p-5 glow-card">
      <p className="font-display text-sm font-bold text-navy">
        {name} réfléchit
        <motion.span
          animate={{ opacity: [1, 0.3, 1] }}
          transition={{ repeat: Infinity, duration: 1.2 }}
        >
          …
        </motion.span>
      </p>
    </div>
  );
}

function FafPlayerCard({
  name,
  cagnotte,
  isBot,
  timeLeft,
  active,
}: {
  name: string;
  cagnotte: number;
  isBot: boolean;
  timeLeft: number;
  active: boolean;
}) {
  const whole = Math.floor(Math.max(0, timeLeft) / 1000);
  const tenths = Math.floor((Math.max(0, timeLeft) % 1000) / 100);
  const critical = timeLeft <= 10_000;
  const ratio = Math.max(0, Math.min(1, timeLeft / FAF_DURATION_MS));

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
            isBot ? "bg-sky/15 text-sky" : "bg-gold/20 text-gold-warm",
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
          critical
            ? "animate-pulse text-buzz"
            : active
              ? "text-navy"
              : "text-navy/60",
        )}
      >
        {whole}
        <span className="text-xl">.{tenths}</span>
        <span className="text-base text-navy/40">s</span>
      </div>
      <p className="mt-1 text-sm font-bold text-gold-warm">
        {formatMoney(cagnotte)}
      </p>
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

// ===========================================================================
// DcResultsScreen — podium + save
// ===========================================================================

function DcResultsScreen({ userPlayerId }: { userPlayerId: string }) {
  const router = useRouter();
  const players = useDouzeCoupsStore((s) => s.players);
  const startedAt = useDouzeCoupsStore((s) => s.startedAt);
  const reset = useDouzeCoupsStore((s) => s.reset);

  const [saveResult, setSaveResult] = useState<SaveDcResult | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (saveResult || isSaving) return;
    setIsSaving(true);
    const duration = Math.round((Date.now() - (startedAt || Date.now())) / 1000);
    void saveDouzeCoupsSession({
      players,
      durationSeconds: duration,
      userPlayerId,
    })
      .then(setSaveResult)
      .finally(() => setIsSaving(false));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const podium = useMemo(() => dcPodium(players), [players]);
  const winner = podium[0];
  const userPlayer = players.find((p) => p.id === userPlayerId);
  const userWon = winner?.id === userPlayerId;
  const xpGained = saveResult?.status === "ok" ? saveResult.xpGained : null;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <motion.div
        initial={{ scale: 0.5, opacity: 0, rotate: -10 }}
        animate={{ scale: 1, opacity: 1, rotate: 0 }}
        transition={{ type: "spring", stiffness: 160, damping: 12 }}
        className={cn(
          "flex h-32 w-32 items-center justify-center rounded-3xl",
          userWon
            ? "bg-gold/20 shadow-[0_0_64px_rgba(245,183,0,0.6)]"
            : "bg-sky/15",
        )}
      >
        {userWon ? (
          <Trophy
            className="h-16 w-16 text-gold-warm"
            aria-hidden="true"
            fill="currentColor"
          />
        ) : (
          <Users className="h-16 w-16 text-sky" aria-hidden="true" />
        )}
      </motion.div>

      <div className="flex flex-col gap-1">
        <p className="text-xs font-bold uppercase tracking-widest text-gold-warm">
          12 Coups de Midi
        </p>
        <h1 className="font-display text-4xl font-extrabold text-navy">
          {userWon ? "Tu remportes la partie !" : `${winner?.pseudo} gagne`}
        </h1>
        {winner && (
          <p className="mt-1 font-display text-3xl font-extrabold text-gold-warm">
            {formatMoney(winner.cagnotte)}
          </p>
        )}
      </div>

      {/* Podium */}
      <ul className="flex w-full flex-col gap-2 rounded-xl border border-border bg-white p-4 text-left text-sm glow-card">
        {podium.map((p, i) => (
          <li
            key={p.id}
            className={cn(
              "flex items-center gap-3",
              i === 0 && "font-bold text-gold-warm",
            )}
          >
            <span className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-navy/10 text-xs font-bold text-navy">
              {i + 1}
            </span>
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
            <span className="flex-1 truncate text-navy">{p.pseudo}</span>
            <span className="text-xs text-navy/60">
              {p.correctCount} bonnes · {p.wrongCount} erreurs
            </span>
            <span className="tabular-nums text-navy">
              {formatMoney(p.cagnotte)}
            </span>
            {p.isEliminated && (
              <span className="rounded-full bg-buzz/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-buzz">
                KO
              </span>
            )}
          </li>
        ))}
      </ul>

      {/* Stats user + XP */}
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
        {userPlayer && !userWon && (
          <span className="text-xs text-navy/50">
            (cagnotte finale : {formatMoney(userPlayer.cagnotte)})
          </span>
        )}
      </div>

      {saveResult?.status === "error" && (
        <p className="rounded-md border border-buzz/40 bg-buzz/10 px-3 py-2 text-sm text-buzz">
          Sauvegarde BDD échouée : {saveResult.message}
        </p>
      )}

      <div className="flex flex-wrap items-center justify-center gap-3">
        <Button
          variant="gold"
          size="lg"
          onClick={() => {
            reset();
            router.refresh();
          }}
        >
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

// ===========================================================================
// Shared UI helpers
// ===========================================================================

function PhaseLabel({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-between">
      <p className="inline-flex items-center gap-2 rounded-full bg-navy/5 px-3 py-1 text-xs font-bold uppercase tracking-widest text-navy">
        <Crown className="h-3 w-3 text-gold-warm" aria-hidden="true" />
        {label}
      </p>
    </div>
  );
}

function TurnLabel({ player }: { player: DcPlayer }) {
  return (
    <motion.div
      key={player.id}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="text-center"
    >
      <p className="text-xs uppercase tracking-widest text-navy/50">
        Au tour de
      </p>
      <p className="font-display text-xl font-extrabold text-navy">
        {player.pseudo}
        {player.isBot && (
          <span className="ml-1 text-xs text-sky">(bot)</span>
        )}
      </p>
    </motion.div>
  );
}

// Prevent unused imports warnings (pickDuelQuestion / shuffleDuelAnswers sont
// indirectement utilisés via DuelPanel)
void pickDuelQuestion;
void shuffleDuelAnswers;
void buildDuelThemes;
void DC_STARTING_CAGNOTTE;
void Sword;
void Swords;
void Grid3x3;
