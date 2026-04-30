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
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { AnimatePresence, motion } from "framer-motion";
import { AnswerButton } from "@/components/game/AnswerButton";
import { DuelPanel } from "@/components/game/DuelPanel";
import { AnimEffect } from "@/components/animations/AnimEffect";
import { ColorTransitionOverlay } from "@/components/game/ColorTransitionOverlay";
import {
  isGenericChoiceLabel,
  resolveCorrectAnswerLabel,
} from "@/lib/game-logic/answer-display";
import {
  buildTTSFeedbackText,
  useAutoPlayTTS,
} from "@/lib/tts-helpers";
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
import { stripDatesFromText } from "@/lib/text-helpers/strip-dates";
import { cn } from "@/lib/utils";
import type { Database } from "@/types/database";
import { useDouzeCoupsStore } from "@/stores/douzeCoupsStore";
import {
  recordGamePlayed,
  upsertSavedPlayer,
} from "@/lib/saved-players/actions";
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
  /** Avatar du compte connecté (pour pré-remplir le slot 0 du setup). */
  userAvatarUrl?: string | null;
  /** Joueurs locaux mémorisés pour autocomplétion + photos. */
  savedPlayers: import("@/lib/saved-players/actions").SavedPlayer[];
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
    userAvatarUrl,
    savedPlayers,
  } = props;

  const phase = useDouzeCoupsStore((s) => s.phase);
  const initParty = useDouzeCoupsStore((s) => s.initParty);
  const startIntro = useDouzeCoupsStore((s) => s.startIntro);
  const startJeu1 = useDouzeCoupsStore((s) => s.startJeu1);
  const reset = useDouzeCoupsStore((s) => s.reset);
  const players = useDouzeCoupsStore((s) => s.players);
  const userPlayerId = players[0]?.id ?? "";
  // Phase de retour du duel pour décider du stage à rendre pendant
  // `transition_duel`. Doit être appelé AVANT les early returns sinon
  // violation des Rules of Hooks (le hook n'est pas appelé pendant les
  // phases setup/intro qui retournent tôt).
  const pendingReturnPhase = useDouzeCoupsStore(
    (s) => s.pendingDuel?.returnPhase ?? null,
  );

  // ---------------------------------------------------------------------
  // Détection transitions vert→jaune et jaune→rouge → overlay plein écran
  // ---------------------------------------------------------------------
  // On compare les errors courants à un snapshot des errors précédents
  // (par playerId) pour détecter les passages de palier. Quand un joueur
  // passe au rouge, l'overlay s'enchaîne naturellement avec la phase
  // `transition_duel` qui prend le relais derrière (sas 20s).
  // Une seule overlay à la fois (file d'attente) pour éviter d'empiler.
  const prevErrorsRef = useRef<Map<string, number>>(new Map());
  const [colorOverlay, setColorOverlay] = useState<{
    to: "yellow" | "red";
    playerName: string;
    /** Suffixe pour forcer un remount si une 2e transition arrive vite. */
    nonce: number;
  } | null>(null);

  useEffect(() => {
    if (phase === "setup" || phase === "intro" || phase === "results") {
      prevErrorsRef.current.clear();
      return;
    }
    let triggeredYellow: { name: string } | null = null;
    let triggeredRed: { name: string } | null = null;
    for (const p of players) {
      const prev = prevErrorsRef.current.get(p.id) ?? 0;
      // Ne déclenche pas si le joueur est déjà éliminé (errors résiduels)
      if (!p.isEliminated) {
        if (prev < 1 && p.errors >= 1 && p.errors < 2) {
          triggeredYellow = { name: p.pseudo };
        } else if (prev < 2 && p.errors >= 2) {
          triggeredRed = { name: p.pseudo };
        }
      }
      prevErrorsRef.current.set(p.id, p.errors);
    }
    // Le rouge prime sur le jaune (cas pathologique 0→2 d'un coup).
    if (triggeredRed) {
      setColorOverlay({
        to: "red",
        playerName: triggeredRed.name,
        nonce: Date.now(),
      });
    } else if (triggeredYellow) {
      setColorOverlay({
        to: "yellow",
        playerName: triggeredYellow.name,
        nonce: Date.now(),
      });
    }
  }, [players, phase]);

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
    // Sauvegarde OPT-IN : seuls les joueurs humains slots ≥ 1 ayant
    // explicitement coché "Enregistrer ce joueur" sont mémorisés en BDD.
    // Le slot 0 = compte connecté est déjà dans `profiles`, jamais
    // dédoublonné dans saved_players.
    void Promise.all(
      result.players
        .map((p, idx) => ({ ...p, idx }))
        .filter(
          (p) =>
            p.idx > 0 &&
            !p.isBot &&
            p.pseudo.trim().length > 0 &&
            p.saveToBdd === true,
        )
        .map((p) =>
          upsertSavedPlayer({
            pseudo: p.pseudo,
            avatarUrl: p.avatarUrl ?? null,
          }),
        ),
    ).catch(() => {
      // best-effort
    });
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
    return (
      <DcSetupScreen
        userPseudo={userPseudo}
        userAvatarUrl={userAvatarUrl ?? null}
        savedPlayers={savedPlayers}
        onReady={startGame}
      />
    );
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
      {colorOverlay && (
        <ColorTransitionOverlay
          key={`color-${colorOverlay.nonce}`}
          to={colorOverlay.to}
          playerName={colorOverlay.playerName}
          onComplete={() => setColorOverlay(null)}
        />
      )}
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
        <span className="absolute -right-1 -top-1 rotate-12 rounded-full bg-buzz px-2 py-0.5 text-[9px] font-extrabold uppercase tracking-widest text-white shadow-md">
          Éliminé
        </span>
      )}
      <div className="flex items-center gap-1.5">
        <div
          className={cn(
            "flex h-6 w-6 shrink-0 items-center justify-center overflow-hidden rounded-md",
            colorStyle.iconBg,
          )}
        >
          {player.avatarUrl && !player.isBot ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={player.avatarUrl}
              alt=""
              className="h-full w-full object-cover"
            />
          ) : player.isBot ? (
            <Bot className="h-3.5 w-3.5" aria-hidden="true" />
          ) : (
            <Crown className="h-3.5 w-3.5" aria-hidden="true" />
          )}
        </div>
        <span
          className={cn(
            "flex-1 truncate text-xs font-bold",
            player.isEliminated ? "text-foreground/40" : colorStyle.text,
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
          player.isEliminated ? "text-foreground/40" : "text-gold-warm",
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
  const phase = useDouzeCoupsStore((s) => s.phase);
  const players = useDouzeCoupsStore((s) => s.players);
  const currentPlayerIdx = useDouzeCoupsStore((s) => s.currentPlayerIdx);
  const pendingDuel = useDouzeCoupsStore((s) => s.pendingDuel);
  const recordCorrect = useDouzeCoupsStore((s) => s.recordCorrect);
  const recordWrong = useDouzeCoupsStore((s) => s.recordWrong);
  const nextPlayer = useDouzeCoupsStore((s) => s.nextPlayer);
  const startDuelPhase = useDouzeCoupsStore((s) => s.startDuelPhase);

  // Vrai dès que la 2e erreur a déclenché le sas avant duel.
  const inTransitionDuel = phase === "transition_duel";

  const [qIdx, setQIdx] = useState(0);
  const usedIdxRef = useRef<Set<number>>(new Set([0]));
  // E2.1 — On stocke `correctText` et `explication` aussi pour le cas
  // "correct" afin que l'encart vert puisse afficher l'explication +
  // résoudre les libellés génériques (« L'un » → « La France »).
  const [feedback, setFeedback] = useState<
    | {
        kind: "correct";
        correctIdx: number;
        correctText: string;
        explication: string | null;
      }
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

  // Lecture auto TTS : énoncé + 2 choix au mount, puis feedback dès que
  // l'utilisateur a répondu (avec stop si on enchaîne avant la fin).
  const ttsFeedback =
    feedback?.kind === "wrong"
      ? buildTTSFeedbackText({
          isCorrect: false,
          correctLabel: resolveCorrectAnswerLabel(
            feedback.correctText,
            feedback.explication,
          ),
          explanation: feedback.explication,
        })
      : feedback?.kind === "correct" && feedback.explication
        ? buildTTSFeedbackText({
            isCorrect: true,
            explanation: feedback.explication,
          })
        : null;
  useAutoPlayTTS({
    enonce: currentQuestion?.enonce ?? "",
    choices: currentQuestion?.reponses.map((r) => r.text) ?? [],
    feedbackText: ttsFeedback,
  });

  useEffect(() => {
    return () => {
      if (pendingTimerRef.current !== null) {
        window.clearTimeout(pendingTimerRef.current);
      }
    };
  }, []);

  const advanceToNext = useCallback(() => {
    // Anti-doublons : reset si on a vu tout le pool.
    if (usedIdxRef.current.size >= ceQuestions.length) {
      usedIdxRef.current = new Set();
    }
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
          ? {
              kind: "correct",
              correctIdx,
              correctText,
              explication: currentQuestion.explication,
            }
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

  // Bot auto-answer (gelé pendant le sas transition_duel).
  // H1.2 — Capture player+question au moment du schedule. Si le tour
  // ou la question change pendant le délai, le timer est cleanup ; mais
  // par sécurité on re-vérifie au firing time qu'on opère bien sur le
  // même couple (currentPlayer, currentQuestion) — évite les races
  // résiduelles où un setTimeout obsolète appellerait processAnswer
  // sur une question déjà passée.
  useEffect(() => {
    if (!currentPlayer?.isBot) return;
    if (!currentQuestion) return;
    if (isTransitioningRef.current) return;
    if (inTransitionDuel) return;
    const scheduledPlayerId = currentPlayer.id;
    const scheduledQuestionId = currentQuestion.id;
    const reponsesLen = currentQuestion.reponses.reduce(
      (sum, r) => sum + r.text.length,
      0,
    );
    const delay = botResponseDelayMs(currentPlayer.botLevel ?? "moyen", {
      enonceLength: currentQuestion.enonce.length + reponsesLen,
      answerLength: 0,
    });
    const t = window.setTimeout(() => {
      if (isTransitioningRef.current) return;
      // Garde stricte : si le tour ou la question a glissé entre-temps,
      // on annule. Évite les questions qui "changent toutes seules".
      if (currentPlayer.id !== scheduledPlayerId) return;
      if (currentQuestion.id !== scheduledQuestionId) return;
      const correct = botAnswersCorrectly(currentPlayer.botLevel ?? "moyen");
      const correctIdx = currentQuestion.reponses.findIndex((r) => r.correct);
      const wrongIdx = correctIdx === 0 ? 1 : 0;
      processAnswer(correct ? correctIdx : wrongIdx);
    }, delay);
    return () => window.clearTimeout(t);
  }, [currentPlayer, currentQuestion, processAnswer, inTransitionDuel]);

  // Keyboard shortcuts for humans (gelés pendant le sas transition_duel)
  useEffect(() => {
    if (currentPlayer?.isBot) return;
    if (inTransitionDuel) return;
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
  }, [currentPlayer, processAnswer, inTransitionDuel]);

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
          choices={currentQuestion.reponses.map((r) => r.text)}
          explanation={
            feedback?.kind === "wrong" ? feedback.explication : undefined
          }
          autoPlay={false}
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

      <AnswerFeedback feedback={feedback} />

      {/* Pendant `transition_duel` : on cache le bouton "Passer à la suite"
          (on ne change plus de question) et on affiche l'overlay rouge
          de sas 20 s avec bouton "Passer au duel". */}
      {inTransitionDuel && pendingDuel && (
        <TransitionDuelOverlay
          pseudo={
            players.find((p) => p.id === pendingDuel.challengerId)?.pseudo ??
            currentPlayer.pseudo
          }
          seconds={20}
          onStartDuel={startDuelPhase}
        />
      )}

      {/* Bouton "Passer à la suite" + countdown, visible dès qu'une réponse
          a été enregistrée. Humain : 30 s pour lire / relire l'explication.
          Bot : 8 s avec bouton "Suivant" pour permettre à l'humain
          spectateur de voir la bonne réponse + l'explication des bots
          mais d'accélérer s'il a déjà compris. */}
      {feedback && !inTransitionDuel && (
        <FeedbackCountdown
          key={`countdown-${currentQuestion.id}-${currentPlayerIdx}`}
          seconds={currentPlayer.isBot ? 8 : 30}
          label={currentPlayer.isBot ? "Suivant" : "Passer à la suite"}
          onSkip={advanceToNext}
        />
      )}

      <p className="text-center text-xs text-foreground/40">
        <ArrowLeft className="inline h-3 w-3 align-text-bottom" aria-hidden="true" />{" "}
        A pour la gauche · B pour la droite{" "}
        <ArrowRight className="inline h-3 w-3 align-text-bottom" aria-hidden="true" />
      </p>
    </main>
  );
}

/**
 * Encart de feedback unifié — vert sur bonne réponse, rouge sur
 * mauvaise. Affiche TOUJOURS l'explication si disponible (E2.1) +
 * résout les libellés génériques type « L'un » → « La France » via
 * `resolveCorrectAnswerLabel`.
 */
function AnswerFeedback({
  feedback,
}: {
  feedback:
    | {
        kind: "correct";
        correctIdx: number;
        correctText: string;
        explication: string | null;
      }
    | {
        kind: "wrong";
        selectedIdx: number;
        correctIdx: number;
        correctText: string;
        explication: string | null;
      }
    | null;
}) {
  if (!feedback) return null;
  const label = resolveCorrectAnswerLabel(
    feedback.correctText,
    feedback.explication,
  );
  const isCorrect = feedback.kind === "correct";
  // Pour le cas correct : on n'affiche le couple "X = label" que si le
  // texte affiché était générique (« L'un », « Vrai », …). Sinon le
  // libellé serait redondant avec le bouton vert mis en évidence.
  const showResolvedLabel =
    isCorrect && label && isGenericChoiceLabel(feedback.correctText);
  // Pour le cas wrong : on l'affiche dès qu'on a un label propre.
  const showWrongLabel = !isCorrect && !!label;

  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "rounded-xl border p-4 text-sm text-foreground",
        isCorrect
          ? "border-life-green/40 bg-life-green/10"
          : "border-buzz/40 bg-buzz/10",
      )}
    >
      <p
        className={cn(
          "font-display text-base font-bold",
          isCorrect ? "text-life-green" : "text-buzz",
        )}
      >
        {isCorrect ? "Bonne réponse" : "Mauvaise réponse"}
      </p>
      {showResolvedLabel && (
        <p className="mt-1">
          {feedback.correctText}{" "}
          <span className="text-foreground/50">=</span>{" "}
          <strong className="text-life-green">{label}</strong>
        </p>
      )}
      {showWrongLabel && (
        <p className="mt-1">
          La bonne réponse était&nbsp;:{" "}
          <strong className="text-life-green">{label}</strong>
        </p>
      )}
      {feedback.explication && (
        <p
          className={cn(
            "text-foreground/80",
            showResolvedLabel || showWrongLabel
              ? "mt-2"
              : "mt-1 font-semibold text-foreground",
          )}
        >
          {feedback.explication}
        </p>
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

  // G4.2 — On affiche TOUJOURS les 2 thèmes initiaux (mêmes que ceux
  // tirés au début), avec le ou les déjà consommés grisés via
  // `consumedCategoryIds`. Plus de filtrage avec availableDuelThemes.
  const availableThemeObjects = duelThemes;
  const consumedCategoryIds = useMemo<number[]>(() => {
    if (!storeThemes) return [];
    const out: number[] = [];
    if (storeThemes.theme1Used) out.push(storeThemes.theme1.id);
    if (storeThemes.theme2Used) out.push(storeThemes.theme2.id);
    return out;
  }, [storeThemes]);

  // Mapping pour convertir le PlayerConfig attendu par DuelPanel.
  // E2.2 — On propage avatarUrl + cagnotte pour que DuelResultPanel
  // puisse afficher photos + montant transféré.
  const rougePlayerForPanel = useMemo(() => {
    if (!challengerPlayer) return null;
    return {
      id: challengerPlayer.id,
      pseudo: challengerPlayer.pseudo,
      isBot: challengerPlayer.isBot,
      avatarUrl: challengerPlayer.avatarUrl ?? null,
      cagnotte: challengerPlayer.cagnotte,
    };
  }, [challengerPlayer]);

  const othersForPanel = useMemo(
    () =>
      otherPlayers.map((p) => ({
        id: p.id,
        pseudo: p.pseudo,
        isBot: p.isBot,
        avatarUrl: p.avatarUrl ?? null,
        cagnotte: p.cagnotte,
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
        <p className="text-foreground/60">
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
      consumedCategoryIds={consumedCategoryIds}
      isSecondDuel={consumedCategoryIds.length > 0}
      botDifficulty={challengerPlayer.botLevel ?? "moyen"}
      onComplete={(result: DuelResult) => {
        // H1.1 — Le DuelPanel retourne maintenant `chosenCategoryId`
        // directement (au lieu d'avoir à le re-deviner via la question).
        // Garantit que `consumeDuelTheme` est appelé avec un id valide.
        designateAdversary(
          result.eliminatedId === challengerPlayer.id
            ? result.winnerId
            : result.eliminatedId,
        );
        resolveDuel(
          result.adversaryAnsweredCorrectly,
          result.chosenCategoryId,
        );
      }}
    />
  );
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
        className="font-display text-4xl font-extrabold text-foreground sm:text-5xl"
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
  const phase = useDouzeCoupsStore((s) => s.phase);
  const players = useDouzeCoupsStore((s) => s.players);
  const currentPlayerIdx = useDouzeCoupsStore((s) => s.currentPlayerIdx);
  const pendingDuel = useDouzeCoupsStore((s) => s.pendingDuel);
  const recordCorrect = useDouzeCoupsStore((s) => s.recordCorrect);
  const recordWrong = useDouzeCoupsStore((s) => s.recordWrong);
  const nextPlayer = useDouzeCoupsStore((s) => s.nextPlayer);
  const advanceToFaceAFace = useDouzeCoupsStore((s) => s.advanceToFaceAFace);
  const forceResetErrorsJeu2 = useDouzeCoupsStore((s) => s.forceResetErrorsJeu2);
  const startDuelPhase = useDouzeCoupsStore((s) => s.startDuelPhase);

  const [roundIdx, setRoundIdx] = useState(0);
  const [clicked, setClicked] = useState<Set<string>>(new Set());
  const [shakeText, setShakeText] = useState<string | null>(null);
  // E1.4 — Feedback persistant (avec explication) jusqu'au clic du
  // bouton "Passer à la suite" ou expiration du countdown.
  const [feedback, setFeedback] = useState<
    | {
        kind: "correct" | "wrong";
        intrusText: string;
        explication: string | null;
      }
    | null
  >(null);
  const isTransitioningRef = useRef(false);
  const showingFeedback = feedback !== null;

  // Vrai dès que la 2e erreur a déclenché le sas avant duel.
  const inTransitionDuel = phase === "transition_duel";

  // Safety net : à l'entrée en Jeu 2, on s'assure que tous les survivants
  // sont à 0 erreur (pour éviter un bug où une erreur résiduelle de Jeu 1
  // ferait passer au rouge dès la 1re erreur de Jeu 2).
  useEffect(() => {
    forceResetErrorsJeu2();
  }, [forceResetErrorsJeu2]);

  const currentPlayer = players[currentPlayerIdx];
  const current = cpcRounds[roundIdx];

  // Lecture auto TTS Jeu 2 : énoncé "Trouve l'intrus parmi : X, Y, … ou Z"
  // au mount, puis explication dès qu'on entre en feedback.
  const ttsFeedbackText =
    feedback && feedback.explication
      ? buildTTSFeedbackText({
          isCorrect: feedback.kind === "correct",
          correctLabel: feedback.intrusText
            ? `L'intrus était ${feedback.intrusText}`
            : null,
          explanation: feedback.explication,
        })
      : null;
  useAutoPlayTTS({
    enonce: current?.theme
      ? `${current.theme}. Trouve l'intrus`
      : "",
    choices: current?.propositions.map((p) => p.text) ?? [],
    feedbackText: ttsFeedbackText,
  });

  const advanceToNext = useCallback(() => {
    // Si on est passé en sas avant duel, on NE change pas le round /
    // le tour : l'écran reste figé sur l'intrus pendant que la
    // TransitionDuelOverlay prend le relais.
    const currentPhase = useDouzeCoupsStore.getState().phase;
    if (currentPhase === "transition_duel") {
      setFeedback(null);
      isTransitioningRef.current = false;
      return;
    }
    setFeedback(null);
    setClicked(new Set());
    setRoundIdx((i) => (i + 1) % cpcRounds.length);
    nextPlayer();
    isTransitioningRef.current = false;
  }, [cpcRounds.length, nextPlayer]);

  const endRound = useCallback(
    (kind: "correct" | "wrong") => {
      if (!current) return;
      const intrusProp = current.propositions.find((p) => !p.isValid);
      setFeedback({
        kind,
        intrusText: intrusProp?.text ?? "",
        explication: current.explication,
      });
    },
    [current],
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
          endRound("correct");
        } else {
          nextPlayer();
        }
      } else {
        playSound("buzz");
        setShakeText(propText);
        window.setTimeout(() => setShakeText(null), 500);
        isTransitioningRef.current = true;
        recordWrong(currentPlayer.id, "jeu2");
        endRound("wrong");
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

  // Bot auto-click (gelé pendant le sas transition_duel)
  useEffect(() => {
    if (!currentPlayer?.isBot) return;
    if (!current) return;
    if (isTransitioningRef.current) return;
    if (showingFeedback) return;
    if (inTransitionDuel) return;
    const propsLen = current.propositions.reduce(
      (sum, p) => sum + p.text.length,
      0,
    );
    const delay = botResponseDelayMs(currentPlayer.botLevel ?? "moyen", {
      enonceLength: current.theme.length + propsLen,
      answerLength: 0,
    });
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
  }, [
    currentPlayer,
    current,
    clicked,
    showingFeedback,
    processClick,
    inTransitionDuel,
  ]);

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
            className="inline-flex items-center rounded-full px-3 py-1 text-xs font-bold uppercase tracking-wide text-on-color"
            style={{ backgroundColor: current.category.couleur ?? "#F5B700" }}
          >
            {current.category.nom}
          </span>
        )}
        <h1 className="mt-3 font-display text-2xl font-extrabold text-foreground sm:text-3xl">
          {current.theme}
        </h1>
        <p className="mt-1 text-sm text-foreground/60">
          6 propositions liées · évite l&apos;
          <strong className="text-buzz">intrus</strong>
        </p>
        <div className="mt-3 flex justify-center">
          <SpeakerButton
            text={`${current.theme}. Six propositions liées, évite l'intrus.`}
            choices={current.propositions.map((p) => p.text)}
            autoPlay={false}
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
              // H1.3 — Strip dates pour ne pas trahir l'intrus.
              text={stripDatesFromText(prop.text)}
              state={state}
              shaking={shakeText === prop.text}
              disabled={
                isClicked ||
                showingFeedback ||
                currentPlayer.isBot ||
                inTransitionDuel
              }
              onClick={() => processClick(prop.text, prop.isValid)}
            />
          );
        })}
      </div>

      {/* E1.4 + E2.1 — Encart de feedback (rouge si intrus cliqué,
          vert si l'humain a trouvé tous les valides) avec libellé de
          l'intrus + explication. Reste visible jusqu'au clic "Passer
          à la suite" ou expiration du countdown. */}
      {feedback && !inTransitionDuel && (
        <CpcAnswerFeedback feedback={feedback} />
      )}

      {/* Bouton "Passer à la suite" + countdown. Humain : 30 s pour
          lire / relire l'explication. Bot : 8 s avec bouton "Suivant"
          pour permettre à l'humain spectateur de voir l'intrus +
          l'explication mais d'accélérer s'il a déjà compris. */}
      {feedback && !inTransitionDuel && (
        <FeedbackCountdown
          key={`countdown-${current.questionId}-${currentPlayerIdx}`}
          seconds={currentPlayer.isBot ? 8 : 30}
          label={currentPlayer.isBot ? "Suivant" : "Passer à la suite"}
          onSkip={advanceToNext}
        />
      )}

      {/* Sas 20 s avant duel : on garde l'écran Jeu 2 figé (intrus révélé,
          propositions en feedback) et on ajoute en bas un encart rouge
          avec bouton "Passer au duel" + countdown. */}
      {inTransitionDuel && pendingDuel && (
        <TransitionDuelOverlay
          pseudo={
            players.find((p) => p.id === pendingDuel.challengerId)?.pseudo ??
            currentPlayer.pseudo
          }
          seconds={20}
          onStartDuel={startDuelPhase}
        />
      )}
    </main>
  );
}

/**
 * Encart de feedback Jeu 2 — vert (« Bonne réponse ») ou rouge
 * (« Mauvaise réponse »), avec libellé de l'intrus et explication.
 */
function CpcAnswerFeedback({
  feedback,
}: {
  feedback: {
    kind: "correct" | "wrong";
    intrusText: string;
    explication: string | null;
  };
}) {
  const isCorrect = feedback.kind === "correct";
  return (
    <motion.div
      initial={{ opacity: 0, y: -6 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "rounded-xl border p-4 text-sm text-foreground",
        isCorrect
          ? "border-life-green/40 bg-life-green/10"
          : "border-buzz/40 bg-buzz/10",
      )}
    >
      <p
        className={cn(
          "font-display text-base font-bold",
          isCorrect ? "text-life-green" : "text-buzz",
        )}
      >
        {isCorrect ? "Bonne réponse" : "Mauvaise réponse"}
      </p>
      {feedback.intrusText && (
        <p className="mt-1">
          L&apos;intrus était&nbsp;:{" "}
          <strong className="text-buzz">{feedback.intrusText}</strong>
        </p>
      )}
      {feedback.explication && (
        <p className="mt-2 text-foreground/80">{feedback.explication}</p>
      )}
    </motion.div>
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
      "border-border bg-card text-foreground hover:border-sky hover:bg-sky/10 hover:scale-[1.02]",
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

  // Lecture auto TTS Face-à-Face : énoncé seul (réponse libre, pas de
  // propositions). Le feedback est trop court ici pour mériter une
  // lecture (transition automatique 1.4 s → on enchaîne vite).
  useAutoPlayTTS({
    enonce: phaseLocal === "playing" ? (currentQuestion?.enonce ?? "") : "",
  });

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
    // Anti-doublons : reset si on a vu tout le pool (rare dans une
    // session normale, mais sécurise contre le wrap-around aléatoire
    // de nextQuestionIndex qui pourrait re-renvoyer une question vue).
    if (usedIdxRef.current.size >= fafQuestions.length) {
      usedIdxRef.current = new Set();
    }
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

  // Raccourcis clavier pour "Passer" — voir le commentaire identique dans
  // face-a-face-client.tsx. Si focus dans un champ de saisie, on laisse
  // le navigateur gérer (Entrée valide la réponse via le form).
  useEffect(() => {
    if (phaseLocal !== "playing") return;
    if (activePlayer?.isBot) return;

    function isTypingTarget(el: Element | null): boolean {
      if (!el) return false;
      const tag = el.tagName;
      return (
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        (el as HTMLElement).isContentEditable === true
      );
    }

    function onKey(e: KeyboardEvent) {
      if (e.repeat) return;
      if (isTypingTarget(document.activeElement)) return;
      const key = e.key;
      const isPassKey =
        key === "$" || key === " " || key === "Enter" || key === "ArrowRight";
      if (!isPassKey) return;
      e.preventDefault();
      handlePass();
    }

    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [phaseLocal, activePlayer, handlePass]);

  // Bot answer
  useEffect(() => {
    if (phaseLocal !== "playing") return;
    if (!activePlayer?.isBot) return;
    if (!currentQuestion) return;
    if (isTransitioningRef.current) return;
    const delay = botResponseDelayMs(activePlayer.botLevel ?? "moyen", {
      enonceLength: currentQuestion.enonce.length,
      answerLength: (currentQuestion.bonne_reponse ?? "").length,
    });
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
        <p className="text-foreground/60">Préparation du Face-à-Face…</p>
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
          <p className="font-display text-xl font-bold text-foreground">
            {activePlayer?.pseudo} a trouvé
          </p>
          <p className="text-sm text-foreground/70">
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
            <SpeakerButton text={currentQuestion.enonce} autoPlay={false} />
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
                <p className="mt-1 text-foreground">
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
                // Désactive pendant la fenêtre de feedback (1.4 s) pour
                // ne pas pouvoir taper sur une question qui va basculer.
                disabled={phaseLocal !== "playing" || flash !== null}
              />
              <div className="mx-auto flex flex-col items-center gap-1">
                <button
                  type="button"
                  onClick={handlePass}
                  disabled={phaseLocal !== "playing" || flash !== null}
                  className="inline-flex items-center gap-1.5 rounded-md border border-foreground/20 bg-card/60 px-4 py-2 text-sm font-semibold text-foreground hover:border-foreground/40 hover:bg-foreground/5 disabled:opacity-40"
                >
                  <SkipForward className="h-4 w-4" aria-hidden="true" />
                  Passer
                </button>
                <p className="text-[11px] text-foreground/40">
                  Raccourcis : <kbd className="rounded bg-navy/5 px-1">Espace</kbd>{" "}
                  <kbd className="rounded bg-navy/5 px-1">Entrée</kbd>{" "}
                  <kbd className="rounded bg-navy/5 px-1">$</kbd>{" "}
                  <kbd className="rounded bg-navy/5 px-1">→</kbd>
                </p>
              </div>
            </div>
          )}
        </>
      )}
    </main>
  );
}

function BotThinkingMini({ name }: { name: string }) {
  return (
    <div className="flex flex-col items-center gap-2 rounded-2xl border border-border bg-card p-5 glow-card">
      <p className="font-display text-sm font-bold text-foreground">
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
          : "border-border bg-card opacity-70",
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
        <span className="flex-1 truncate font-display text-sm font-bold text-foreground">
          {name}
        </span>
        {active && (
          <span className="animate-pulse rounded-full bg-gold px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-on-color">
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
              ? "text-foreground"
              : "text-foreground/60",
        )}
      >
        {whole}
        <span className="text-xl">.{tenths}</span>
        <span className="text-base text-foreground/40">s</span>
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

  // On garde l'enregistrement BDD (historique de partie) — l'XP est juste
  // retirée de l'affichage utilisateur, pas du backend.
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

    // Bump des stats des saved_players (humains slots 2+ uniquement,
    // le slot 0 = compte connecté est suivi via game_sessions).
    const winnerId = dcPodium(players)[0]?.id ?? null;
    void Promise.all(
      players
        .map((p, idx) => ({ ...p, idx }))
        .filter((p) => p.idx > 0 && !p.isBot && p.pseudo.trim().length > 0)
        .map((p) =>
          recordGamePlayed({ pseudo: p.pseudo, won: p.id === winnerId }),
        ),
    ).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const podium = useMemo(() => dcPodium(players), [players]);
  const winner = podium[0];
  const userWon = winner?.id === userPlayerId;

  return (
    <main className="relative mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-5 overflow-hidden p-6 text-center sm:p-8">
      {/* Pluie de pièces fullscreen si l'user gagne */}
      {userWon && (
        <AnimEffect
          animation="coins-rain"
          size="fullscreen"
          autoCloseMs={2400}
        />
      )}

      {/* Avatar du vainqueur en grand avec couronne dorée animée */}
      {winner && (
        <div className="relative flex flex-col items-center gap-3">
          <motion.div
            initial={{ y: -24, opacity: 0, rotate: -25 }}
            animate={{
              y: [-12, -18, -12],
              opacity: 1,
              rotate: [-12, 0, 8, 0],
            }}
            transition={{
              y: { duration: 1.6, repeat: Infinity, ease: "easeInOut" },
              opacity: { duration: 0.5 },
              rotate: { duration: 1, ease: "easeOut" },
            }}
            className="relative z-10"
          >
            <Crown
              className="h-12 w-12 text-gold drop-shadow-[0_4px_10px_rgba(245,183,0,0.65)] sm:h-14 sm:w-14"
              aria-hidden="true"
              fill="currentColor"
            />
          </motion.div>
          <motion.div
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{
              type: "spring",
              stiffness: 200,
              damping: 16,
              delay: 0.2,
            }}
            className="relative -mt-3 flex h-32 w-32 shrink-0 items-center justify-center overflow-hidden rounded-3xl border-4 border-gold bg-gold/15 shadow-[0_0_64px_rgba(245,183,0,0.55)] sm:h-36 sm:w-36"
          >
            {winner.avatarUrl ? (
              <Image
                src={winner.avatarUrl}
                alt=""
                width={144}
                height={144}
                className="h-full w-full object-cover"
                unoptimized
              />
            ) : winner.isBot ? (
              <Bot className="h-14 w-14 text-sky" aria-hidden="true" />
            ) : (
              <Crown
                className="h-14 w-14 text-gold-warm"
                aria-hidden="true"
              />
            )}
          </motion.div>
          {/* Badge MAÎTRE DE MIDI */}
          <motion.div
            initial={{ scale: 0.6, opacity: 0, y: 12 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            transition={{
              type: "spring",
              stiffness: 220,
              damping: 14,
              delay: 0.6,
            }}
            className="inline-flex items-center gap-2 rounded-full border-2 border-gold bg-gradient-to-r from-gold via-gold-warm to-gold px-4 py-1.5 font-display text-xs font-extrabold uppercase tracking-widest text-on-color shadow-[0_4px_18px_rgba(245,183,0,0.5)] sm:text-sm"
          >
            <Trophy
              className="h-4 w-4"
              aria-hidden="true"
              fill="currentColor"
            />
            Maître de Midi
          </motion.div>
        </div>
      )}

      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.4 }}
        className="flex flex-col gap-1"
      >
        <p className="text-xs font-bold uppercase tracking-widest text-gold-warm">
          12 Coups de Midi
        </p>
        <h1 className="font-display text-4xl font-extrabold text-foreground sm:text-5xl">
          {userWon ? "Tu remportes la partie !" : `${winner?.pseudo} gagne`}
        </h1>
        {winner && (
          <motion.p
            initial={{ scale: 0.5, opacity: 0 }}
            animate={{ scale: [0.5, 1.15, 1], opacity: 1 }}
            transition={{ delay: 0.7, duration: 0.6, ease: "easeOut" }}
            className="mt-1 font-display text-3xl font-extrabold text-gold-warm sm:text-4xl"
          >
            {formatMoney(winner.cagnotte)}
          </motion.p>
        )}
      </motion.div>

      {/* Podium animé en stagger */}
      <motion.ul
        initial="hidden"
        animate="show"
        variants={{
          hidden: {},
          show: { transition: { staggerChildren: 0.08, delayChildren: 0.5 } },
        }}
        className="flex w-full flex-col gap-2 rounded-2xl border border-border bg-card p-3 text-left text-sm glow-card sm:p-4"
      >
        {podium.map((p, i) => (
          <motion.li
            key={p.id}
            variants={{
              hidden: { opacity: 0, x: -12 },
              show: { opacity: 1, x: 0 },
            }}
            className={cn(
              "flex items-center gap-3 rounded-lg p-2 transition-colors",
              i === 0 &&
                "bg-gold/10 ring-2 ring-gold/40 ring-offset-1 ring-offset-card",
            )}
          >
            {/* Rang */}
            <span
              className={cn(
                "flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-xs font-extrabold",
                i === 0
                  ? "bg-gold text-on-color"
                  : "bg-foreground/10 text-foreground",
              )}
            >
              {i + 1}
            </span>
            {/* Avatar / icône fallback */}
            <div
              className={cn(
                "relative flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border",
                i === 0 ? "border-gold" : "border-border",
                p.isBot ? "bg-sky/10" : "bg-gold/10",
              )}
            >
              {p.avatarUrl ? (
                <Image
                  src={p.avatarUrl}
                  alt=""
                  width={36}
                  height={36}
                  className="h-full w-full object-cover"
                  unoptimized
                />
              ) : p.isBot ? (
                <Bot className="h-4 w-4 text-sky" aria-hidden="true" />
              ) : (
                <Crown
                  className="h-4 w-4 text-gold-warm"
                  aria-hidden="true"
                />
              )}
            </div>
            {/* Pseudo + Trophy mini si vainqueur */}
            <span
              className={cn(
                "flex flex-1 items-center gap-1.5 truncate text-foreground",
                i === 0 && "font-display font-extrabold text-foreground",
              )}
            >
              {i === 0 && (
                <Trophy
                  className="h-3.5 w-3.5 shrink-0 text-gold-warm"
                  aria-hidden="true"
                  fill="currentColor"
                />
              )}
              {p.pseudo}
            </span>
            <span className="hidden text-xs text-foreground/55 sm:inline">
              {p.correctCount} bonnes · {p.wrongCount} erreurs
            </span>
            <span
              className={cn(
                "tabular-nums",
                i === 0 ? "font-bold text-gold-warm" : "text-foreground",
              )}
            >
              {formatMoney(p.cagnotte)}
            </span>
            {p.isEliminated && (
              <span className="rounded-full bg-buzz/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-buzz">
                KO
              </span>
            )}
          </motion.li>
        ))}
      </motion.ul>

      {saveResult?.status === "error" && (
        <p className="rounded-md border border-buzz/40 bg-buzz/10 px-3 py-2 text-sm text-buzz">
          Sauvegarde BDD échouée : {saveResult.message}
        </p>
      )}

      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1 }}
        className="flex flex-wrap items-center justify-center gap-3"
      >
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
          className="inline-flex h-9 items-center gap-1.5 rounded-md border border-gold/50 bg-card px-4 text-sm font-semibold text-foreground transition-colors hover:border-gold hover:bg-gold/15"
        >
          <Home className="h-4 w-4" aria-hidden="true" />
          Accueil
        </Link>
      </motion.div>
    </main>
  );
}

// ===========================================================================
// Shared UI helpers
// ===========================================================================

function PhaseLabel({ label }: { label: string }) {
  return (
    <div className="flex items-center justify-between">
      <p className="inline-flex items-center gap-2 rounded-full bg-foreground/5 px-3 py-1 text-xs font-bold uppercase tracking-widest text-foreground">
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
      <p className="text-xs uppercase tracking-widest text-foreground/50">
        Au tour de
      </p>
      <p className="font-display text-xl font-extrabold text-foreground">
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
