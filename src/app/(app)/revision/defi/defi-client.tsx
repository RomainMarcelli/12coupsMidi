"use client";

import { useEffect, useState, useTransition } from "react";
import Link from "next/link";
import { motion, AnimatePresence } from "framer-motion";
import {
  AlertTriangle,
  ArrowLeft,
  Calendar,
  CheckCircle2,
  Eye,
  Loader2,
  Play,
  Sparkles,
  Trophy,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import type { RevQuestion } from "@/lib/revision/types";
import { QuizPlayer } from "../_components/QuizPlayer";
import { DAILY_CHALLENGE_QUESTION_COUNT } from "./constants";
import {
  fetchDailyChallenge,
  submitDailyChallengeResult,
  type ChallengeAnswer,
  type ChallengeResult,
  type DailyStats,
} from "./actions";
import { DefiCalendar } from "./_components/DefiCalendar";
import { DefiCountdown } from "./_components/DefiCountdown";
import { DefiResultViewer } from "./_components/DefiResultViewer";
import { DefiStatsBlock } from "./_components/DefiStatsBlock";

// ---------------------------------------------------------------------------
// Types & helpers
// ---------------------------------------------------------------------------

type TodayResponse =
  | {
      status: "ok";
      date: string;
      questions: RevQuestion[];
      existingResult: ChallengeResult | null;
    }
  | { status: "not_found" }
  | { status: "error"; message: string };

interface DefiClientProps {
  todayChallenge: TodayResponse;
  stats: DailyStats | null;
  /**
   * I3.1 — Date de création du compte (YYYY-MM-DD). Le calendrier ne
   * marque en rouge que les jours passés ≥ cette date — on n'inflige
   * pas un calendrier "tout rouge" aux nouveaux comptes.
   */
  accountCreatedAtIso: string | null;
}

type View =
  | { kind: "hub" }
  | { kind: "playing"; date: string; questions: RevQuestion[]; isPast: boolean }
  | {
      kind: "viewing-result";
      date: string;
      questions: RevQuestion[];
      result: ChallengeResult;
      /** L1.2 — `true` si on vient juste de finir le défi (hero festif). */
      justFinished?: boolean;
    }
  | { kind: "loading" };

/**
 * Formate "YYYY-MM-DD" en français avec jour de la semaine.
 * Ex: "lundi 27 avril 2026".
 */
function formatDateFr(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  }).format(d);
}

// ---------------------------------------------------------------------------
// Composant principal
// ---------------------------------------------------------------------------

/**
 * Orchestrateur du Défi du jour.
 *
 * Vues :
 *   - "hub"            : aperçu + CTA principal + calendrier + stats.
 *   - "playing"        : QuizPlayer en cours sur le défi sélectionné.
 *   - "viewing-result" : DefiResultViewer (lecture seule).
 *   - "loading"        : transition entre vues (chargement d'un défi passé).
 */
export function DefiClient({
  todayChallenge,
  stats,
  accountCreatedAtIso,
}: DefiClientProps) {
  const [view, setView] = useState<View>({ kind: "hub" });
  const [successFlash, setSuccessFlash] = useState<{
    correct: number;
    total: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Cache local du défi du jour pour pouvoir le relancer après submit.
  const [todayState, setTodayState] = useState<TodayResponse>(todayChallenge);

  // J3.1 — Compteur incrémenté après chaque submit pour forcer un
  // remount du DefiCalendar (sa data fetcher est en useEffect
  // [year, month], donc ne se rafraîchit pas tout seul après submit).
  const [calendarRefreshKey, setCalendarRefreshKey] = useState(0);

  // Auto-clear du flash de succès après 5s.
  useEffect(() => {
    if (!successFlash) return;
    const id = setTimeout(() => setSuccessFlash(null), 5000);
    return () => clearTimeout(id);
  }, [successFlash]);

  // -------------------------------------------------------------------------
  // Handlers
  // -------------------------------------------------------------------------

  function startToday() {
    if (todayState.status !== "ok") return;
    setError(null);
    setView({
      kind: "playing",
      date: todayState.date,
      questions: todayState.questions,
      isPast: false,
    });
  }

  function viewResult(
    date: string,
    questions: RevQuestion[],
    result: ChallengeResult,
  ) {
    setView({ kind: "viewing-result", date, questions, result });
  }

  /**
   * Clic sur une date du calendrier.
   * - Si c'est aujourd'hui et déjà joué → viewing-result
   * - Si c'est aujourd'hui et pas joué → playing
   * - Si c'est passé → on charge via fetchDailyChallenge(date) :
   *     - existingResult présent → viewing-result
   *     - sinon → playing-past
   */
  function handlePickDate(iso: string) {
    setError(null);
    // Cas court-circuit : aujourd'hui dans le state local.
    if (todayState.status === "ok" && iso === todayState.date) {
      if (todayState.existingResult) {
        viewResult(
          todayState.date,
          todayState.questions,
          todayState.existingResult,
        );
      } else {
        startToday();
      }
      return;
    }

    setView({ kind: "loading" });
    startTransition(async () => {
      const res = await fetchDailyChallenge(iso);
      if (res.status === "error") {
        setError(res.message);
        setView({ kind: "hub" });
        return;
      }
      if (res.status === "not_found") {
        setError("Aucun défi disponible pour cette date.");
        setView({ kind: "hub" });
        return;
      }
      if (res.existingResult) {
        viewResult(res.date, res.questions, res.existingResult);
      } else {
        setView({
          kind: "playing",
          date: res.date,
          questions: res.questions,
          isPast: true,
        });
      }
    });
  }

  /**
   * Fin de session du QuizPlayer. On envoie le résultat au serveur,
   * puis on revient au hub avec un flash de succès.
   *
   * Note V1 : QuizPlayer ne tracke pas le détail des réponses (texte
   * tapé, choix sélectionné). On envoie donc un payload minimal où
   * `userAnswer` reste vide — on garde uniquement la trace `isCorrect`
   * par questionId pour rejouer l'historique. À enrichir en V2 quand
   * QuizPlayer exposera un `onAnswer(questionId, userAnswer, isCorrect)`.
   */
  async function handleQuizDone(
    playedDate: string,
    playedQuestions: RevQuestion[],
    stats: { correct: number; wrong: number },
  ) {
    const total = playedQuestions.length;
    // V1 : on ne sait pas quelles questions ont été ratées individuellement
    // (QuizPlayer n'expose que correct/wrong en agrégé). On marque les
    // `correct` premières comme correctes — convention pour garder une
    // structure exploitable côté UI. Cette approximation est acceptable
    // car le résultat sert surtout aux stats et au heatmap.
    const answers: ChallengeAnswer[] = playedQuestions.map((q, i) => ({
      questionId: q.questionId,
      userAnswer: "",
      isCorrect: i < stats.correct,
    }));

    // K1 — Logs client pour diagnostiquer le bug "résultat non
    // enregistré silencieusement". Visibles dans la console browser
    // pour que l'utilisateur puisse les transmettre.
    console.log("[defi:client] handleQuizDone called", {
      playedDate,
      total,
      correct: stats.correct,
      wrong: stats.wrong,
    });

    let res: Awaited<ReturnType<typeof submitDailyChallengeResult>>;
    try {
      res = await submitDailyChallengeResult({
        date: playedDate,
        correctCount: stats.correct,
        totalCount: total,
        answers,
      });
    } catch (e) {
      // K1 — Une server action peut throw (réseau, runtime). Ne pas
      // laisser passer en silence : afficher une erreur visible et
      // RESTER sur DoneScreen pour que l'utilisateur voie qu'il y a
      // un problème (au lieu de retourner au hub comme si tout
      // s'était bien passé).
      const message =
        e instanceof Error ? e.message : "Erreur réseau inattendue";
      console.error("[defi:client] submit threw:", e);
      setError(`Échec de l'enregistrement : ${message}`);
      setView({ kind: "hub" });
      return;
    }

    console.log("[defi:client] submit result:", res);

    if (res.status === "error") {
      // K1 — Avant : l'erreur était set dans setError mais l'utilisateur
      // était RAMENÉ au hub où l'alerte rouge se mêlait au reste —
      // d'où le ressenti "ça revient comme si tout s'était bien passé".
      // Maintenant : on garde le préfixe « Échec » + bannière visible,
      // et on affiche aussi un alert() de secours si possible (il
      // ne faut PAS que le user manque l'info).
      setError(`Échec de l'enregistrement : ${res.message}`);
      setView({ kind: "hub" });
      return;
    }

    setSuccessFlash({ correct: stats.correct, total });
    // Si c'était le défi du jour, met à jour le state local pour
    // que la card du hub passe en mode "déjà joué".
    const newResult: ChallengeResult = {
      correctCount: stats.correct,
      totalCount: total,
      answers,
      completedAt: new Date().toISOString(),
    };
    if (
      todayState.status === "ok" &&
      playedDate === todayState.date
    ) {
      setTodayState({
        ...todayState,
        existingResult: newResult,
      });
    }
    // J3.1 — Force le calendrier à re-fetch pour faire passer la
    // case du jour (ou du jour rattrapé) en vert.
    setCalendarRefreshKey((k) => k + 1);

    // L1.2 — Au lieu de retourner direct au hub (où l'utilisateur
    // n'avait pas le temps de lire son score), on bascule sur la
    // vue "viewing-result" qui affiche le hero "Défi terminé !" + le
    // détail des 10 questions. L'utilisateur clique "Retour au
    // calendrier" quand il a fini — pas de redirect auto.
    setView({
      kind: "viewing-result",
      date: playedDate,
      questions: playedQuestions,
      result: newResult,
      justFinished: true,
    });
  }

  // -------------------------------------------------------------------------
  // Rendu
  // -------------------------------------------------------------------------

  if (view.kind === "playing") {
    return (
      <PlayingView
        date={view.date}
        questions={view.questions}
        isPast={view.isPast}
        onCancel={() => setView({ kind: "hub" })}
        onDone={(s) => handleQuizDone(view.date, view.questions, s)}
      />
    );
  }

  if (view.kind === "viewing-result") {
    return (
      <DefiResultViewer
        result={view.result}
        questions={view.questions}
        date={view.date}
        justFinished={view.justFinished === true}
        onClose={() => setView({ kind: "hub" })}
      />
    );
  }

  if (view.kind === "loading") {
    return (
      <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-3 p-8">
        <Loader2
          className="h-8 w-8 animate-spin text-gold-warm"
          aria-hidden="true"
        />
        <p className="text-sm text-foreground/60">Chargement du défi…</p>
      </main>
    );
  }

  // ---- Vue HUB ----
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8">
      {/* K1 — Bandeau d'erreur global persistant. Apparaît en TÊTE de
          page (avant le bouton retour) avec icône + bouton fermer.
          Avant K1 l'erreur n'était affichée qu'en sous-bandeau du Hero
          et passait inaperçue. */}
      {error && (
        <div
          role="alert"
          className="flex items-start gap-3 rounded-xl border-2 border-buzz/60 bg-buzz/10 p-4 shadow-[0_0_24px_rgba(230,57,70,0.15)]"
        >
          <AlertTriangle
            className="mt-0.5 h-5 w-5 shrink-0 text-buzz"
            aria-hidden="true"
          />
          <div className="flex-1">
            <p className="font-display text-sm font-extrabold uppercase tracking-wider text-buzz">
              Problème détecté
            </p>
            <p className="mt-1 text-sm text-foreground">{error}</p>
            <p className="mt-2 text-xs text-foreground/60">
              Ouvre la console (F12) pour voir les détails — préfixes
              <code className="mx-1 rounded bg-buzz/10 px-1 py-0.5 font-mono text-[11px]">
                [defi:client]
              </code>
              et
              <code className="mx-1 rounded bg-buzz/10 px-1 py-0.5 font-mono text-[11px]">
                [defi:server]
              </code>
              .
            </p>
          </div>
          <button
            type="button"
            onClick={() => setError(null)}
            aria-label="Fermer l'alerte"
            className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md text-buzz/70 hover:bg-buzz/10 hover:text-buzz"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </div>
      )}

      {/* Bouton retour vers le hub révision */}
      <div>
        <Link
          href="/revision"
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-semibold text-foreground/80 hover:border-gold/50 hover:bg-gold/10"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Retour aux modes
        </Link>
      </div>

      {/* HERO */}
      <DefiHero
        todayState={todayState}
        successFlash={successFlash}
        isPending={isPending}
        onStart={startToday}
        onViewResult={() => {
          if (
            todayState.status === "ok" &&
            todayState.existingResult
          ) {
            viewResult(
              todayState.date,
              todayState.questions,
              todayState.existingResult,
            );
          }
        }}
      />

      {/* GRID Calendar / Stats */}
      <div className="grid gap-4 lg:grid-cols-2">
        <DefiCalendar
          key={calendarRefreshKey}
          onPickDate={handlePickDate}
          accountCreatedAtIso={accountCreatedAtIso}
        />
        <DefiStatsBlock stats={stats} />
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------
// Sous-composants
// ---------------------------------------------------------------------------

function DefiHero({
  todayState,
  successFlash,
  isPending,
  onStart,
  onViewResult,
}: {
  todayState: TodayResponse;
  successFlash: { correct: number; total: number } | null;
  isPending: boolean;
  onStart: () => void;
  onViewResult: () => void;
}) {
  const todayIso = new Date().toISOString().slice(0, 10);
  const formattedDate = formatDateFr(todayIso);

  const alreadyPlayed =
    todayState.status === "ok" && todayState.existingResult !== null;

  return (
    <section
      className={cn(
        "relative overflow-hidden rounded-3xl border p-6 sm:p-8",
        alreadyPlayed
          ? "border-border bg-muted"
          : "border-gold/30 bg-gradient-to-br from-gold/15 via-card to-sky/10 shadow-[0_0_64px_rgba(245,183,0,0.18)]",
      )}
    >
      {/* Halos décoratifs */}
      {!alreadyPlayed && (
        <>
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -right-12 -top-12 h-40 w-40 rounded-full bg-gold/30 blur-3xl"
          />
          <div
            aria-hidden="true"
            className="pointer-events-none absolute -bottom-10 -left-10 h-32 w-32 rounded-full bg-sky/20 blur-2xl"
          />
        </>
      )}

      <div className="relative flex flex-col items-start gap-4 sm:flex-row sm:items-center sm:gap-6">
        <motion.div
          initial={{ scale: 0.6, opacity: 0 }}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 15 }}
          className={cn(
            "flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl sm:h-20 sm:w-20",
            alreadyPlayed
              ? "bg-life-green/15 text-life-green"
              : "bg-gold/25 text-gold-warm shadow-[0_0_36px_rgba(245,183,0,0.4)]",
          )}
        >
          {alreadyPlayed ? (
            <Trophy
              className="h-8 w-8 sm:h-10 sm:w-10"
              aria-hidden="true"
              fill="currentColor"
            />
          ) : (
            <Calendar className="h-8 w-8 sm:h-10 sm:w-10" aria-hidden="true" />
          )}
        </motion.div>

        <div className="flex flex-1 flex-col gap-1">
          <p className="text-xs font-bold uppercase tracking-widest text-gold-warm">
            Défi du jour
          </p>
          <h1 className="font-display text-2xl font-extrabold capitalize text-foreground sm:text-3xl">
            {formattedDate}
          </h1>
          <p className="text-sm text-foreground/70">
            {DAILY_CHALLENGE_QUESTION_COUNT} questions identiques pour tous,
            chaque jour.
          </p>
        </div>
      </div>

      {/* Flash de succès */}
      <AnimatePresence>
        {successFlash && (
          <motion.div
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="relative mt-5 flex items-center gap-2 rounded-xl border border-life-green/40 bg-life-green/10 px-4 py-3 text-life-green"
          >
            <CheckCircle2 className="h-5 w-5 shrink-0" aria-hidden="true" />
            <p className="text-sm font-bold">
              Défi enregistré ! Score : {successFlash.correct} /{" "}
              {successFlash.total}
            </p>
          </motion.div>
        )}
      </AnimatePresence>

      {/* K1 — L'erreur est désormais affichée en bandeau global tout
          en haut de la page (cf parent), pas dans le Hero — ça évitait
          que l'utilisateur la rate quand le hero scrollait sous lui. */}

      {/* CTA principal */}
      <div className="relative mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        {todayState.status === "ok" && !todayState.existingResult && (
          <Button variant="gold" size="lg" onClick={onStart} disabled={isPending}>
            <Play className="h-4 w-4" aria-hidden="true" fill="currentColor" />
            Commencer le défi ({DAILY_CHALLENGE_QUESTION_COUNT} questions)
          </Button>
        )}

        {alreadyPlayed && todayState.status === "ok" && todayState.existingResult && (
          <>
            <p className="inline-flex items-center gap-1.5 rounded-full bg-life-green/15 px-3 py-1 text-sm font-bold text-life-green">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              Score : {todayState.existingResult.correctCount} /{" "}
              {todayState.existingResult.totalCount}
            </p>
            <DefiCountdown />
            <Button variant="ghost-gold" size="lg" onClick={onViewResult}>
              <Eye className="h-4 w-4" aria-hidden="true" />
              Voir mes réponses
            </Button>
          </>
        )}

        {todayState.status === "not_found" && (
          <p className="text-sm text-foreground/70">
            Aucun défi n&apos;est disponible aujourd&apos;hui. Reviens un peu
            plus tard.
          </p>
        )}

        {todayState.status === "error" && (
          <p className="text-sm text-buzz">
            Erreur lors du chargement : {todayState.message}
          </p>
        )}
      </div>
    </section>
  );
}

function PlayingView({
  date,
  questions,
  isPast,
  onCancel,
  onDone,
}: {
  date: string;
  questions: RevQuestion[];
  isPast: boolean;
  onCancel: () => void;
  onDone: (stats: { correct: number; wrong: number }) => void;
}) {
  return (
    <div className="flex flex-1 flex-col">
      <div className="mx-auto flex w-full max-w-2xl items-center justify-between gap-2 px-4 pt-4">
        <button
          type="button"
          onClick={onCancel}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-semibold text-foreground/80 hover:border-gold/50 hover:bg-gold/10"
        >
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          Quitter
        </button>
        <p className="text-xs font-bold uppercase tracking-widest text-gold-warm">
          {isPast ? "Défi rejoué" : "Défi du jour"} —{" "}
          <span className="capitalize text-foreground/70">
            {formatDateFr(date)}
          </span>
        </p>
      </div>
      <QuizPlayer
        questions={questions}
        trackWrong={false}
        onDone={onDone}
      />
    </div>
  );
}
