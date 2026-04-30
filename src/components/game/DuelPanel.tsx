"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  Bot,
  Crown,
  Play,
  Skull,
  Swords,
  Target,
  Trophy,
} from "lucide-react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { QuestionCard } from "@/components/game/QuestionCard";
import { AnswerButton } from "@/components/game/AnswerButton";
import { SpeakerButton } from "@/components/game/SpeakerButton";
import {
  pickDuelQuestion,
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
  /**
   * G4.2 — IDs des catégories déjà consommées dans un duel précédent
   * de la même partie. Ces thèmes restent affichés mais grisés
   * (badge "Déjà utilisé", clic désactivé).
   */
  consumedCategoryIds?: ReadonlyArray<number>;
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
  consumedCategoryIds = [],
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

  // Passage à la phase "choose-theme" dès qu'un adversaire est choisi.
  // G4.2 — On affiche TOUJOURS les 2 thèmes (mêmes que ceux tirés au
  // début de la partie). Au 2e duel, le thème consommé est passé via
  // `consumedCategoryIds` et grisé dans l'UI. Si un seul thème dispo
  // (cas dégradé pool < 2), on saute la phase choix.
  useEffect(() => {
    if (phase !== "choose-adversary") return;
    if (!adversaryId) return;
    // On garde tous les thèmes passés en props. Le filtrage "déjà
    // utilisé" est purement visuel (grayed) et empêche le clic, mais
    // les 2 thèmes restent visibles pour rappel.
    const proposed = themes.slice(0, 2);
    setProposedThemes(proposed);
    if (proposed.length === 1) {
      setChosenTheme(proposed[0] ?? null);
      setPhase("question");
    } else {
      setPhase("choose-theme");
    }
  }, [phase, adversaryId, themes, isSecondDuel]);

  // Si l'adversaire est un bot, il choisit automatiquement un thème.
  // G4.2 — Le bot ne pioche que dans les thèmes NON consommés.
  useEffect(() => {
    if (phase !== "choose-theme") return;
    if (!adversary?.isBot) return;
    const id = window.setTimeout(() => {
      const choosable = proposedThemes.filter(
        (t) => !consumedCategoryIds.includes(t.categoryId),
      );
      const pool = choosable.length > 0 ? choosable : proposedThemes;
      const pick = pool[Math.floor(Math.random() * pool.length)];
      if (pick) {
        setChosenTheme(pick);
        setPhase("question");
      }
    }, BOT_CHOICE_DELAY_MS);
    return () => window.clearTimeout(id);
  }, [phase, adversary, proposedThemes, consumedCategoryIds]);

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
    const reponsesLen = duelQuestion.reponses.reduce(
      (sum, r) => sum + r.text.length,
      0,
    );
    const delay = botResponseDelayMs(botDifficulty, {
      enonceLength: duelQuestion.enonce.length + reponsesLen,
      answerLength: 0,
    });
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
        chosenCategoryId: chosenTheme?.categoryId ?? -1,
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
    [duelQuestion, adversaryId, rougePlayer.id, chosenTheme],
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
        consumedCategoryIds={consumedCategoryIds}
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
          className="rounded-full px-3 py-1 text-xs font-bold uppercase tracking-widest text-on-color"
          style={{ backgroundColor: chosenTheme.couleur ?? "#F5B700" }}
        >
          Thème · {chosenTheme.label}
        </span>
        <p className="font-display text-sm font-bold text-foreground">
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
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center gap-5 p-4 sm:p-6">
      {/* Header avec photo du rouge */}
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="relative">
          <PlayerAvatarTile player={rougePlayer} kind="rouge" />
          <span
            aria-hidden="true"
            className="absolute -bottom-1 -right-1 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-buzz text-white shadow-md"
          >
            <Swords className="h-3.5 w-3.5" aria-hidden="true" />
          </span>
        </div>
        <div className="flex flex-col gap-1">
          <p className="text-xs font-bold uppercase tracking-widest text-buzz">
            Duel
          </p>
          <h1 className="font-display text-2xl font-extrabold text-foreground sm:text-3xl">
            {rougePlayer.pseudo} désigne un adversaire
          </h1>
          <p className="text-sm text-foreground/65">
            Bonne réponse de l&apos;adversaire → {rougePlayer.pseudo}{" "}
            éliminé. Mauvaise → adversaire éliminé.
          </p>
        </div>
      </div>

      {rougePlayer.isBot && (
        <p className="animate-pulse text-sm text-sky">
          Le bot {rougePlayer.pseudo} choisit…
        </p>
      )}

      {/* Liste des adversaires */}
      <ul className="flex w-full flex-col gap-2.5">
        {otherPlayers.map((p) => (
          <li key={p.id}>
            <button
              type="button"
              onClick={() => onPick(p.id)}
              disabled={rougePlayer.isBot}
              className={cn(
                "group flex w-full items-center gap-4 rounded-2xl border-2 border-border bg-card p-3 text-left transition-all sm:p-4",
                !rougePlayer.isBot &&
                  "hover:border-buzz/60 hover:bg-buzz/5 hover:scale-[1.01] hover:shadow-[0_0_24px_rgba(230,57,70,0.18)]",
                rougePlayer.isBot && "cursor-not-allowed opacity-70",
              )}
            >
              <PlayerAvatarTile player={p} kind="adversary" />
              <div className="flex flex-1 flex-col">
                <span className="font-display text-lg font-extrabold text-foreground sm:text-xl">
                  {p.pseudo}
                </span>
                <span className="inline-flex items-center gap-1 text-xs font-bold uppercase tracking-wider text-foreground/55">
                  {p.isBot ? (
                    <>
                      <Bot className="h-3 w-3" aria-hidden="true" />
                      Bot
                    </>
                  ) : (
                    <>
                      <Crown className="h-3 w-3" aria-hidden="true" />
                      Humain
                    </>
                  )}
                </span>
              </div>
              <Target
                className={cn(
                  "h-6 w-6 text-buzz/40 transition-all",
                  !rougePlayer.isBot &&
                    "group-hover:scale-110 group-hover:text-buzz",
                )}
                aria-hidden="true"
              />
            </button>
          </li>
        ))}
      </ul>
    </main>
  );
}

/**
 * Avatar carré pour les écrans de duel (sélection adversaire / header).
 * - kind="rouge"     : grand (h-20), bordure rouge, glow rouge
 * - kind="adversary" : moyen (h-14), bordure border, fallback Bot/Crown
 *
 * Affiche la photo si dispo, sinon l'icône par défaut (Bot/Crown).
 */
function PlayerAvatarTile({
  player,
  kind,
}: {
  player: PlayerConfig;
  kind: "rouge" | "adversary";
}) {
  const isRouge = kind === "rouge";
  const sizeClass = isRouge ? "h-20 w-20" : "h-14 w-14 sm:h-16 sm:w-16";
  const iconSize = isRouge ? "h-9 w-9" : "h-7 w-7";
  return (
    <div
      className={cn(
        "relative flex shrink-0 items-center justify-center overflow-hidden rounded-2xl border-2",
        sizeClass,
        isRouge
          ? "border-buzz/60 bg-buzz/15 shadow-[0_0_32px_rgba(230,57,70,0.35)]"
          : player.isBot
            ? "border-border bg-sky/10"
            : "border-border bg-gold/15",
      )}
    >
      {player.avatarUrl ? (
        <Image
          src={player.avatarUrl}
          alt=""
          width={isRouge ? 80 : 64}
          height={isRouge ? 80 : 64}
          className="h-full w-full object-cover"
          unoptimized
        />
      ) : player.isBot ? (
        <Bot
          className={cn(iconSize, isRouge ? "text-buzz" : "text-sky")}
          aria-hidden="true"
        />
      ) : (
        <Crown
          className={cn(
            iconSize,
            isRouge ? "text-buzz" : "text-gold-warm",
          )}
          aria-hidden="true"
        />
      )}
    </div>
  );
}

function ChooseThemePanel({
  adversary,
  themes,
  consumedCategoryIds,
  onPick,
}: {
  adversary: PlayerConfig | null;
  themes: DuelTheme[];
  /** G4.2 — IDs des catégories déjà utilisées dans un duel précédent. */
  consumedCategoryIds: ReadonlyArray<number>;
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
        <h1 className="font-display text-3xl font-extrabold text-foreground">
          {adversary.pseudo}, choisis un thème
        </h1>
      </div>

      {adversary.isBot && (
        <p className="animate-pulse text-sm text-sky">
          Le bot choisit son thème…
        </p>
      )}

      <div className="grid w-full gap-3 sm:grid-cols-2">
        {themes.map((theme) => {
          // G4.2 — Thème consommé au duel précédent : grisé, clic
          // désactivé, badge "Déjà utilisé".
          const isConsumed = consumedCategoryIds.includes(theme.categoryId);
          const disabled = adversary.isBot || isConsumed;
          return (
            <button
              key={theme.categoryId}
              type="button"
              onClick={() => onPick(theme)}
              disabled={disabled}
              title={
                isConsumed
                  ? "Ce thème a déjà été choisi au tour précédent"
                  : undefined
              }
              className={cn(
                "relative flex flex-col items-center gap-2 rounded-2xl border-2 p-6 transition-all",
                !disabled &&
                  "border-border bg-card hover:border-gold hover:bg-gold/5 hover:scale-[1.02]",
                isConsumed &&
                  "cursor-not-allowed border-border bg-card opacity-40",
                !isConsumed &&
                  adversary.isBot &&
                  "cursor-not-allowed border-border bg-card/50 opacity-70",
              )}
            >
              {isConsumed && (
                <span className="absolute -top-2 left-1/2 -translate-x-1/2 rounded-full bg-foreground/80 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-background">
                  Déjà utilisé
                </span>
              )}
              <div
                className="flex h-12 w-12 items-center justify-center rounded-xl text-on-color"
                style={{ backgroundColor: theme.couleur ?? "#F5B700" }}
              >
                <Target className="h-6 w-6" aria-hidden="true" />
              </div>
              <span className="font-display text-lg font-bold text-foreground">
                {theme.label}
              </span>
              <span className="text-xs text-foreground/50">
                {theme.questions.length} question
                {theme.questions.length > 1 ? "s" : ""}
              </span>
            </button>
          );
        })}
      </div>
    </main>
  );
}

/**
 * Écran de fin de duel — refonte E2.2.
 *
 * Séquence :
 *   1. Animation « VS » plein cadre (1.2 s) — son de victoire en simultané.
 *   2. Apparition des 2 portraits côte à côte (vainqueur grand + couronne
 *      animée, perdant plus petit + barré + skull).
 *   3. Pluie de confettis dorés sur le vainqueur (Framer Motion).
 *   4. Animation « +X € » qui jaillit du perdant vers le vainqueur si une
 *      cagnotte non nulle a été transférée.
 *   5. Bouton « Continuer » en gold.
 *
 * `prefers-reduced-motion` : on supprime les VS/confettis/pluie de pièces,
 * on affiche directement le résultat avec un fade simple.
 */
function DuelResultPanel({
  winner,
  eliminated,
  correctAnswer,
  onContinue,
}: {
  winner: PlayerConfig | null;
  eliminated: PlayerConfig | null;
  correctAnswer: string;
  onContinue: () => void;
}) {
  const [showVS, setShowVS] = useState(true);
  const [showResult, setShowResult] = useState(false);

  useEffect(() => {
    // VS pendant 1.2 s puis on bascule vers le résultat
    const t = window.setTimeout(() => {
      setShowVS(false);
      setShowResult(true);
    }, 1200);
    return () => window.clearTimeout(t);
  }, []);

  const transferredAmount =
    typeof eliminated?.cagnotte === "number" ? eliminated.cagnotte : 0;

  return (
    <main className="relative mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-6 overflow-hidden p-6 text-center sm:p-8">
      {/* Phase 1 : Animation VS */}
      <AnimatePresence>
        {showVS && (
          <motion.div
            key="vs"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="flex flex-col items-center gap-4"
          >
            <motion.div
              initial={{ scale: 0.3, rotate: -45 }}
              animate={{ scale: [0.3, 1.4, 1], rotate: [-45, 8, 0] }}
              transition={{ duration: 0.7, ease: "easeOut" }}
              className="relative flex h-32 w-32 items-center justify-center rounded-full bg-buzz shadow-[0_0_80px_rgba(230,57,70,0.7)]"
            >
              <Swords
                className="h-16 w-16 text-white"
                aria-hidden="true"
                strokeWidth={2.5}
              />
            </motion.div>
            <motion.p
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 }}
              className="font-display text-6xl font-extrabold uppercase tracking-widest text-buzz drop-shadow-[0_4px_12px_rgba(230,57,70,0.5)] sm:text-7xl"
            >
              VS
            </motion.p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Phase 2 : Résultat */}
      <AnimatePresence>
        {showResult && (
          <motion.div
            key="result"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.4 }}
            className="flex w-full flex-col items-center gap-6"
          >
            <p className="text-xs font-bold uppercase tracking-widest text-foreground/50">
              Duel terminé
            </p>

            {/* Portraits côte à côte */}
            <div className="relative flex w-full items-end justify-center gap-4 sm:gap-8">
              {/* Vainqueur — grand, doré, couronne animée */}
              <DuelPortrait kind="winner" player={winner} />
              {/* Pluie de confettis dorés (visible au-dessus du vainqueur) */}
              <Confetti />
              {/* Perdant — plus petit, grisé */}
              <DuelPortrait kind="eliminated" player={eliminated} />
              {/* Animation +X€ qui vole du perdant vers le vainqueur */}
              {transferredAmount > 0 && (
                <CagnotteTransferAnim amount={transferredAmount} />
              )}
            </div>

            <div className="flex flex-col items-center gap-2">
              <h1 className="inline-flex items-center gap-2 font-display text-3xl font-extrabold text-foreground sm:text-4xl">
                <Trophy
                  className="h-7 w-7 text-gold-warm"
                  aria-hidden="true"
                  fill="currentColor"
                />
                {winner ? `${winner.pseudo} remporte le duel !` : "Vainqueur"}
              </h1>
              {eliminated && (
                <p className="text-sm text-foreground/70 sm:text-base">
                  <strong className="text-buzz">{eliminated.pseudo}</strong>{" "}
                  est éliminé
                  {transferredAmount > 0 && (
                    <>
                      {" "}
                      ·{" "}
                      <span className="font-bold text-gold-warm">
                        cagnotte transférée : +
                        {transferredAmount.toLocaleString("fr-FR")} €
                      </span>
                    </>
                  )}
                </p>
              )}
            </div>

            <p className="rounded-md border border-border bg-card px-4 py-2 text-sm text-foreground/80">
              Bonne réponse :{" "}
              <strong className="text-foreground">{correctAnswer}</strong>
            </p>

            <button
              type="button"
              onClick={onContinue}
              className="inline-flex items-center gap-2 rounded-xl bg-gold px-8 py-4 font-display text-lg font-extrabold uppercase tracking-wide text-on-color shadow-[0_6px_0_0_#e89e00] transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(245,183,0,0.55)]"
            >
              Continuer
              <Play className="h-5 w-5" aria-hidden="true" fill="currentColor" />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </main>
  );
}

/**
 * Portrait d'un joueur dans l'écran de fin de duel.
 * - kind="winner" : grand (h-32), couronne animée au-dessus, glow doré.
 * - kind="eliminated" : plus petit (h-24), grisé, croix rouge en travers,
 *   skull dans un coin.
 */
function DuelPortrait({
  kind,
  player,
}: {
  kind: "winner" | "eliminated";
  player: PlayerConfig | null;
}) {
  const isWinner = kind === "winner";
  if (!player) return null;
  const sizeClass = isWinner ? "h-28 w-28 sm:h-36 sm:w-36" : "h-20 w-20 sm:h-24 sm:w-24";

  return (
    <motion.div
      initial={{ scale: 0.6, opacity: 0, y: 20 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      transition={{
        type: "spring",
        stiffness: 200,
        damping: 16,
        delay: isWinner ? 0.15 : 0.3,
      }}
      className="relative flex flex-col items-center gap-2"
    >
      {/* Couronne dorée animée au-dessus du vainqueur */}
      {isWinner && (
        <motion.div
          initial={{ y: -10, opacity: 0, rotate: -15 }}
          animate={{
            y: [-10, -16, -10],
            opacity: 1,
            rotate: [-15, 0, 8, 0],
          }}
          transition={{
            y: { duration: 1.6, repeat: Infinity, ease: "easeInOut" },
            opacity: { duration: 0.4, delay: 0.4 },
            rotate: { duration: 0.9, delay: 0.4 },
          }}
          className="absolute -top-9 z-10 sm:-top-11"
        >
          <Crown
            className="h-9 w-9 text-gold drop-shadow-[0_4px_8px_rgba(245,183,0,0.7)] sm:h-11 sm:w-11"
            aria-hidden="true"
            fill="currentColor"
          />
        </motion.div>
      )}

      {/* Avatar */}
      <div
        className={cn(
          "relative flex shrink-0 items-center justify-center overflow-hidden rounded-3xl border-4",
          sizeClass,
          isWinner
            ? "border-gold bg-gold/15 shadow-[0_0_64px_rgba(245,183,0,0.5)]"
            : "border-navy/20 bg-navy/10 grayscale",
        )}
      >
        {player.avatarUrl ? (
          <Image
            src={player.avatarUrl}
            alt=""
            width={isWinner ? 144 : 96}
            height={isWinner ? 144 : 96}
            className="h-full w-full object-cover"
            unoptimized
          />
        ) : player.isBot ? (
          <Bot
            className={cn(
              isWinner ? "h-12 w-12 text-sky" : "h-10 w-10 text-foreground/50",
            )}
            aria-hidden="true"
          />
        ) : (
          <Crown
            className={cn(
              isWinner ? "h-12 w-12 text-gold-warm" : "h-10 w-10 text-foreground/40",
            )}
            aria-hidden="true"
          />
        )}
        {/* Croix rouge sur l'éliminé */}
        {!isWinner && (
          <motion.div
            initial={{ scale: 0, rotate: 0 }}
            animate={{ scale: 1, rotate: -8 }}
            transition={{ delay: 0.6, type: "spring", stiffness: 220 }}
            className="absolute inset-0 flex items-center justify-center"
          >
            <div className="h-1.5 w-[140%] rotate-45 rounded-full bg-buzz/85" />
          </motion.div>
        )}
        {/* Skull en bas-droite de l'éliminé */}
        {!isWinner && (
          <motion.div
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ delay: 0.7 }}
            className="absolute -bottom-1.5 -right-1.5 flex h-7 w-7 items-center justify-center rounded-full border-2 border-white bg-buzz text-white shadow-md"
          >
            <Skull className="h-4 w-4" aria-hidden="true" />
          </motion.div>
        )}
      </div>

      {/* Pseudo */}
      <p
        className={cn(
          "font-display font-extrabold",
          isWinner
            ? "text-base text-foreground sm:text-lg"
            : "text-sm text-foreground/55 line-through sm:text-base",
        )}
      >
        {player.pseudo}
      </p>
    </motion.div>
  );
}

/**
 * Pluie de confettis dorés sur le vainqueur. 14 particules qui tombent
 * du haut vers le bas avec rotation, départ étalé.
 */
function Confetti() {
  const count = 14;
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 overflow-hidden"
    >
      {Array.from({ length: count }).map((_, i) => {
        const left = ((i * 7) % 100) + (i % 3) * 3;
        const delay = (i % 5) * 0.12 + 0.4;
        const duration = 2.4 + (i % 3) * 0.4;
        const color =
          i % 4 === 0
            ? "bg-gold"
            : i % 4 === 1
              ? "bg-gold-warm"
              : i % 4 === 2
                ? "bg-[#ffffff]"
                : "bg-sky";
        return (
          <motion.span
            key={i}
            className={cn(
              "absolute h-2.5 w-1.5 rounded-sm shadow-sm",
              color,
            )}
            style={{ left: `${left}%`, top: -10 }}
            initial={{ y: 0, opacity: 0, rotate: 0 }}
            animate={{
              y: ["0%", "120%"],
              opacity: [0, 1, 1, 0],
              rotate: [0, 360, 720],
            }}
            transition={{ duration, delay, ease: "easeIn" }}
          />
        );
      })}
    </div>
  );
}

/**
 * Animation de transfert de cagnotte : 4 pièces « € » qui volent du
 * portrait éliminé (à droite) vers le portrait vainqueur (à gauche),
 * étalées dans le temps. Le label « +X € » apparaît au centre.
 */
function CagnotteTransferAnim({ amount }: { amount: number }) {
  const coins = 4;
  return (
    <div
      aria-hidden="true"
      className="pointer-events-none absolute inset-0 flex items-center justify-center"
    >
      {/* Pièces qui volent de droite vers gauche */}
      {Array.from({ length: coins }).map((_, i) => {
        const delay = 0.7 + i * 0.18;
        return (
          <motion.span
            key={i}
            initial={{ x: 100, y: 0, scale: 0, opacity: 0, rotate: 0 }}
            animate={{
              x: [100, -100],
              y: [0, -28, 0],
              scale: [0, 1, 0.8],
              opacity: [0, 1, 0],
              rotate: [0, 360],
            }}
            transition={{ duration: 1.1, delay, ease: "easeOut" }}
            className="absolute flex h-7 w-7 items-center justify-center rounded-full bg-gold font-display text-sm font-extrabold text-on-color shadow-md"
          >
            €
          </motion.span>
        );
      })}
      {/* Label central qui apparaît brièvement */}
      <motion.div
        initial={{ scale: 0.3, opacity: 0, y: 0 }}
        animate={{
          scale: [0.3, 1.1, 1],
          opacity: [0, 1, 1, 0],
          y: [10, -20, -40],
        }}
        transition={{ duration: 1.6, delay: 1.2, ease: "easeOut" }}
        className="rounded-full bg-gold/90 px-4 py-1.5 font-display text-base font-extrabold text-on-color shadow-lg"
      >
        +{amount.toLocaleString("fr-FR")} €
      </motion.div>
    </div>
  );
}

// Prevent unused imports warning for BOT_PROFILES
void BOT_PROFILES;
