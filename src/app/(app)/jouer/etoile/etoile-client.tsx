"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  BarChart3,
  Eye,
  Flag,
  Home,
  Play,
  Repeat,
  Star,
  Trophy,
} from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { VoiceInput } from "@/components/game/VoiceInput";
import { Button } from "@/components/ui/button";
import {
  JEU2_AUTO_REVEAL_INTERVAL_SECONDS,
  JEU2_DURATION_SECONDS,
  JEU2_MAX_INDICES,
  computeBlurPx,
  computeJeu2Xp,
  placeholderAvatarUrl,
  type Jeu2Question,
} from "@/lib/game-logic/jeu2";
import { isMatch } from "@/lib/matching/fuzzy-match";
import { playSound } from "@/lib/sounds";
import { cn } from "@/lib/utils";
import { saveEtoileSession, type SaveEtoileResult } from "./actions";

type Phase = "intro" | "playing" | "results";

interface EtoileClientProps {
  question: Jeu2Question;
}

export function EtoileClient({ question }: EtoileClientProps) {
  const router = useRouter();
  const [phase, setPhase] = useState<Phase>("intro");
  const [indicesRevealed, setIndicesRevealed] = useState(1);
  const [indicesRevealedAtFound, setIndicesRevealedAtFound] = useState<number | null>(null);
  const [attempts, setAttempts] = useState<string[]>([]);
  const [found, setFound] = useState(false);
  const [elapsedSec, setElapsedSec] = useState(0);
  const [lastAttemptFeedback, setLastAttemptFeedback] = useState<
    null | { value: string; correct: boolean }
  >(null);
  const [saveResult, setSaveResult] = useState<SaveEtoileResult | null>(null);
  const [isSaving, setIsSaving] = useState(false);

  const startedAtRef = useRef<number>(0);
  const feedbackTimerRef = useRef<number | null>(null);

  const totalIndices = question.indices.length || JEU2_MAX_INDICES;
  const maxReveal = Math.min(totalIndices, JEU2_MAX_INDICES);

  const imageUrl = question.image_url ?? placeholderAvatarUrl(question.bonne_reponse);
  const blurPx = computeBlurPx(indicesRevealed);

  const remainingSec = Math.max(0, JEU2_DURATION_SECONDS - elapsedSec);
  const mm = Math.floor(remainingSec / 60);
  const ss = remainingSec % 60;

  // Tick timer (1 seul setState par seconde)
  useEffect(() => {
    if (phase !== "playing") return;
    const id = window.setInterval(() => {
      setElapsedSec((prev) => prev + 1);
    }, 1000);
    return () => window.clearInterval(id);
  }, [phase]);

  // Effets dérivés du chrono : auto-reveal tous les 20 s + timeout partie.
  // Séparé du tick pour éviter les double setState sous StrictMode.
  useEffect(() => {
    if (phase !== "playing") return;
    if (elapsedSec === 0) return;
    if (elapsedSec >= JEU2_DURATION_SECONDS) {
      playSound("lose");
      setPhase("results");
      return;
    }
    if (elapsedSec % JEU2_AUTO_REVEAL_INTERVAL_SECONDS === 0) {
      setIndicesRevealed((r) => Math.min(maxReveal, r + 1));
    }
  }, [elapsedSec, phase, maxReveal]);

  // Début de partie
  const start = useCallback(() => {
    startedAtRef.current = Date.now();
    setElapsedSec(0);
    setPhase("playing");
  }, []);

  // Sauvegarde BDD à l'entrée en "results"
  useEffect(() => {
    if (phase !== "results" || saveResult || isSaving) return;
    setIsSaving(true);
    const revealedForScoring = indicesRevealedAtFound ?? indicesRevealed;
    const xpGained = found ? computeJeu2Xp(revealedForScoring) : 0;
    const durationSeconds = Math.round(
      (Date.now() - startedAtRef.current) / 1000,
    );
    saveEtoileSession({
      questionId: question.id,
      found,
      indicesRevealed: revealedForScoring,
      xpGained,
      durationSeconds,
      attempts: attempts.length,
    })
      .then(setSaveResult)
      .finally(() => setIsSaving(false));
  }, [phase, found, indicesRevealed, indicesRevealedAtFound, question.id, saveResult, isSaving, attempts.length]);

  function revealNext() {
    if (indicesRevealed >= maxReveal) return;
    setIndicesRevealed((r) => Math.min(maxReveal, r + 1));
  }

  function handleSubmit(value: string) {
    if (phase !== "playing") return;
    const correct = isMatch(value, question.bonne_reponse, question.alias);
    setLastAttemptFeedback({ value, correct });
    if (feedbackTimerRef.current) {
      window.clearTimeout(feedbackTimerRef.current);
    }
    feedbackTimerRef.current = window.setTimeout(() => {
      setLastAttemptFeedback(null);
    }, 2500);

    if (correct) {
      playSound("win");
      setFound(true);
      setIndicesRevealedAtFound(indicesRevealed); // fige le compte réel
      setIndicesRevealed(maxReveal); // puis révèle tout visuellement
      setPhase("results");
    } else {
      playSound("buzz");
      setAttempts((a) => [...a, value]);
    }
  }

  function abandon() {
    if (phase !== "playing") return;
    if (!confirm("Abandonner la partie ? La bonne réponse sera affichée.")) {
      return;
    }
    playSound("lose");
    setPhase("results");
  }

  // ---- INTRO -----------------------------------------------------------------
  if (phase === "intro") {
    return <IntroScreen onStart={start} category={question.category?.nom} />;
  }

  // ---- RESULTS ---------------------------------------------------------------
  if (phase === "results") {
    return (
      <ResultsScreen
        found={found}
        bonneReponse={question.bonne_reponse}
        indicesRevealed={indicesRevealedAtFound ?? indicesRevealed}
        imageUrl={imageUrl}
        explication={question.explication}
        saveResult={saveResult}
        isSaving={isSaving}
        onReplay={() => {
          router.refresh();
          setPhase("intro");
          setIndicesRevealed(1);
          setIndicesRevealedAtFound(null);
          setAttempts([]);
          setFound(false);
          setElapsedSec(0);
          setSaveResult(null);
        }}
      />
    );
  }

  // ---- PLAYING ---------------------------------------------------------------
  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5 p-4 sm:p-6 lg:p-8">
      {/* Header : titre + chrono + abandonner */}
      <div className="flex items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <Star className="h-5 w-5 text-gold-warm" aria-hidden="true" />
          <h1 className="font-display text-lg font-bold text-foreground">
            Étoile Mystérieuse
          </h1>
        </div>
        <div className="flex items-center gap-3">
          <div
            className={cn(
              "rounded-lg border px-3 py-1 font-display text-lg font-bold tabular-nums",
              remainingSec <= 15
                ? "border-buzz/50 bg-buzz/10 text-buzz animate-pulse"
                : "border-border bg-card text-foreground",
            )}
          >
            {String(mm).padStart(1, "0")}:{String(ss).padStart(2, "0")}
          </div>
          <button
            type="button"
            onClick={abandon}
            className="flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1.5 text-xs font-semibold text-foreground/70 transition-colors hover:border-buzz hover:text-buzz"
            title="Abandonner"
          >
            <Flag className="h-3.5 w-3.5" aria-hidden="true" />
            Abandonner
          </button>
        </div>
      </div>

      <div className="grid gap-5 md:grid-cols-2">
        {/* Image floutée */}
        <div className="relative flex aspect-square items-center justify-center overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-cream-deep via-white to-sky-pale glow-card">
          <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle,rgba(245,183,0,0.25),transparent_60%)]" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img
            src={imageUrl}
            alt=""
            className="h-[70%] w-[70%] select-none object-contain transition-[filter] duration-700"
            style={{ filter: `blur(${blurPx}px)` }}
            draggable={false}
          />
          <div className="absolute bottom-2 right-2 rounded-full bg-card/80 px-2 py-0.5 text-xs font-semibold text-foreground/70 backdrop-blur">
            {indicesRevealed} / {maxReveal} indices
          </div>
        </div>

        {/* Indices */}
        <ol className="flex flex-col gap-2">
          {Array.from({ length: maxReveal }).map((_, idx) => {
            const revealed = idx < indicesRevealed;
            const content = question.indices[idx];
            return (
              <motion.li
                key={idx}
                initial={revealed ? { opacity: 1 } : { opacity: 0.4 }}
                animate={{ opacity: revealed ? 1 : 0.4, x: 0 }}
                transition={{ duration: 0.3 }}
                className={cn(
                  "flex items-start gap-3 rounded-xl border p-3 text-sm",
                  revealed
                    ? "border-gold/40 bg-gold/10 text-foreground"
                    : "border-dashed border-border bg-card/50 text-foreground/40",
                )}
              >
                <span
                  className={cn(
                    "flex h-7 w-7 shrink-0 items-center justify-center rounded-full font-display text-sm font-bold",
                    revealed
                      ? "bg-gold text-on-color"
                      : "bg-muted text-foreground/40",
                  )}
                >
                  {idx + 1}
                </span>
                <span className="pt-0.5">
                  {revealed ? content : "???"}
                </span>
              </motion.li>
            );
          })}
          <button
            type="button"
            onClick={revealNext}
            disabled={indicesRevealed >= maxReveal}
            className="mt-1 flex items-center justify-center gap-2 rounded-md border border-gold/50 bg-card px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:bg-gold/10 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Eye className="h-4 w-4" aria-hidden="true" />
            {indicesRevealed >= maxReveal
              ? "Tous les indices révélés"
              : "Indice suivant"}
          </button>
        </ol>
      </div>

      {/* Input voix + clavier */}
      <div className="rounded-2xl border border-border bg-card p-5 glow-card">
        <VoiceInput onSubmit={handleSubmit} placeholder="Propose ta réponse…" />
        {lastAttemptFeedback && (
          <motion.p
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            className={cn(
              "mt-3 text-center text-sm font-semibold",
              lastAttemptFeedback.correct ? "text-life-green" : "text-buzz",
            )}
            role={lastAttemptFeedback.correct ? "status" : "alert"}
          >
            {lastAttemptFeedback.correct
              ? `Bravo ! ${lastAttemptFeedback.value}`
              : `Non : « ${lastAttemptFeedback.value} »`}
          </motion.p>
        )}
      </div>

      {/* Historique des essais ratés (discret) */}
      {attempts.length > 0 && (
        <p className="text-center text-xs text-foreground/40">
          Essais : {attempts.join(" · ")}
        </p>
      )}
    </main>
  );
}

// =============================================================================
// Sous-écrans
// =============================================================================

function IntroScreen({
  onStart,
  category,
}: {
  onStart: () => void;
  category?: string;
}) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-8 p-8 text-center">
      <div className="relative">
        <div className="absolute inset-0 -z-10 animate-sun-pulse rounded-full bg-sky/30 blur-3xl" />
        <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-card shadow-[0_4px_24px_rgba(43,142,230,0.35)]">
          <Star
            className="h-12 w-12 text-sky"
            aria-hidden="true"
            fill="currentColor"
          />
        </div>
      </div>

      <div className="flex flex-col gap-3">
        <p className="font-display text-sm font-bold uppercase tracking-widest text-sky">
          Jeu 2
        </p>
        <h1 className="font-display text-4xl font-extrabold text-foreground sm:text-5xl">
          Étoile Mystérieuse
        </h1>
        <p className="text-foreground/70 sm:text-lg">
          Devine la personnalité à partir d'indices progressifs.
          <br />
          Tu as <strong className="text-foreground">2 minutes</strong>.
        </p>
      </div>

      <ul className="flex flex-col gap-2 rounded-xl border border-border bg-card p-5 text-left text-sm text-foreground/80 glow-card">
        <li className="flex items-start gap-2">
          <Eye
            className="mt-0.5 h-4 w-4 shrink-0 text-gold-warm"
            aria-hidden="true"
          />
          <span>
            <strong>5 indices</strong>. Un apparaît toutes les 20 s, ou tu peux
            le demander à l'avance.
          </span>
        </li>
        <li className="flex items-start gap-2">
          <Trophy
            className="mt-0.5 h-4 w-4 shrink-0 text-gold-warm"
            aria-hidden="true"
          />
          <span>
            XP : <strong>500 / 400 / 300 / 200 / 100</strong> selon le nombre
            d'indices déjà révélés quand tu trouves.
          </span>
        </li>
        <li className="flex items-start gap-2">
          <Star
            className="mt-0.5 h-4 w-4 shrink-0 text-sky"
            aria-hidden="true"
          />
          <span>
            Réponds à la voix (FR) ou au clavier. La tolérance aux fautes est
            activée (Levenshtein ≤ 2 + alias).
          </span>
        </li>
      </ul>

      {category && (
        <p className="text-sm text-foreground/60">
          Thème du jour :{" "}
          <span className="font-semibold text-foreground">{category}</span>
        </p>
      )}

      <button
        type="button"
        onClick={onStart}
        className="inline-flex items-center gap-2 rounded-xl bg-gold px-10 py-5 font-display text-xl font-extrabold uppercase tracking-wide text-on-color shadow-[0_6px_0_0_#e89e00] transition-all hover:-translate-y-0.5 hover:shadow-[0_8px_24px_rgba(245,183,0,0.55)] active:translate-y-0 active:shadow-[0_2px_0_0_#e89e00]"
      >
        <Play className="h-5 w-5" aria-hidden="true" fill="currentColor" />
        C'est parti !
      </button>
    </main>
  );
}

function ResultsScreen({
  found,
  bonneReponse,
  indicesRevealed,
  imageUrl,
  explication,
  saveResult,
  isSaving,
  onReplay,
}: {
  found: boolean;
  bonneReponse: string;
  indicesRevealed: number;
  imageUrl: string;
  explication: string | null;
  saveResult: SaveEtoileResult | null;
  isSaving: boolean;
  onReplay: () => void;
}) {
  const xpGained =
    saveResult?.status === "ok" ? saveResult.xpGained : null;

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      {/* Image révélée */}
      <motion.div
        initial={{ scale: 0.8, opacity: 0, filter: "blur(20px)" }}
        animate={{ scale: 1, opacity: 1, filter: "blur(0px)" }}
        transition={{ duration: 0.8, ease: "easeOut" }}
        className="relative flex aspect-square w-48 items-center justify-center overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-cream-deep via-white to-sky-pale glow-sun"
      >
        <div className="absolute inset-0 -z-10 bg-[radial-gradient(circle,rgba(245,183,0,0.35),transparent_60%)]" />
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img
          src={imageUrl}
          alt={bonneReponse}
          className="h-[80%] w-[80%] object-contain"
          draggable={false}
        />
      </motion.div>

      <div className="flex flex-col gap-2">
        <h1
          className={cn(
            "font-display text-4xl font-extrabold",
            found ? "text-life-green" : "text-foreground",
          )}
        >
          {found ? "Trouvé !" : "Presque…"}
        </h1>
        <p className="text-foreground/70 sm:text-lg">
          C'était{" "}
          <strong className="text-gold-warm">{bonneReponse}</strong>.
        </p>
        {found && (
          <p className="text-sm text-foreground/60">
            Trouvé avec {indicesRevealed} indice{indicesRevealed > 1 ? "s" : ""}{" "}
            révélé{indicesRevealed > 1 ? "s" : ""}.
          </p>
        )}
        {explication && (
          <p className="mt-2 rounded-md border border-border bg-card p-3 text-sm text-foreground/80">
            {explication}
          </p>
        )}
      </div>

      {/* XP */}
      <div className="flex items-center gap-3 rounded-xl border border-border bg-card px-6 py-3 glow-card">
        <Trophy
          className="h-6 w-6 text-gold-warm"
          aria-hidden="true"
          fill="currentColor"
        />
        <span className="font-display text-lg font-bold text-foreground">
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
