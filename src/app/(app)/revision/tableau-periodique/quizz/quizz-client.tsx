"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowLeft,
  Brain,
  Eye,
  RotateCcw,
  Send,
  Trophy,
  X,
} from "lucide-react";
import Link from "next/link";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import { PeriodicGrid } from "../_components/PeriodicGrid";
import { FamilyLegend } from "../_components/FamilyLegend";
import {
  matchElementByName,
  type PeriodicElement,
} from "@/lib/periodic/types";
import { playSound } from "@/lib/sounds";

interface Props {
  elements: PeriodicElement[];
}

const SS_KEY = "mahylan-periodic-quizz-missed-v1";

/**
 * Quizz tableau périodique (F2.1.b).
 *
 * - Tableau vide au départ (cases grises avec juste le numéro).
 * - L'user tape un symbole ou un nom → matching tolérant.
 * - Si match : la case se remplit (couleur famille), animation flip,
 *   son ding, compteur à jour. L'input se vide auto.
 * - Si pas de match : input se vide doucement (pas de feedback dur).
 * - Bouton "Donner ma langue au chat" : révèle les manqués en gris,
 *   passe en mode "résultat".
 * - À la fin : bouton "Tout recommencer" et "Recommencer ce qui m'a
 *   manqué" (utilise sessionStorage pour conserver les manqués entre
 *   les 2 routes).
 */
export function QuizzClient({ elements }: Props) {
  const [mode, setMode] = useState<"playing" | "done">("playing");
  const [restrictTo, setRestrictTo] = useState<Set<number> | null>(null);
  const [revealed, setRevealed] = useState<Set<number>>(new Set());
  const [abandoned, setAbandoned] = useState<Set<number>>(new Set());
  const [input, setInput] = useState("");
  const [justFound, setJustFound] = useState<number | null>(null);
  // G3.2 — Toast d'erreur fugace (1.5 s) si la saisie ne matche aucun
  // élément. Affiché à la soumission (Entrée / clic Valider).
  const [errorToast, setErrorToast] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  // G3.3 — Ref vers le bloc résultats pour scroll auto après abandon.
  const resultsRef = useRef<HTMLDivElement>(null);

  // À l'arrivée, on vérifie sessionStorage pour le mode "Recommencer
  // ce qui m'a manqué" (set par l'écran de fin).
  useEffect(() => {
    try {
      const stored = window.sessionStorage.getItem(SS_KEY);
      if (stored) {
        const parsed = JSON.parse(stored) as number[];
        if (Array.isArray(parsed) && parsed.length > 0) {
          setRestrictTo(new Set(parsed));
        }
        window.sessionStorage.removeItem(SS_KEY);
      }
    } catch {
      // ignore
    }
  }, []);

  const targetElements = useMemo(() => {
    if (!restrictTo) return elements;
    return elements.filter((e) => restrictTo.has(e.numero_atomique));
  }, [elements, restrictTo]);

  const total = targetElements.length;
  const found = revealed.size;
  const remaining = total - found;
  const percent = total > 0 ? Math.round((found / total) * 100) : 0;

  /**
   * G3.2 — Submit handler (Entrée ou clic Valider).
   *
   * - Match nom uniquement (pas symbole) via matchElementByName.
   * - Si match nouveau → révèle la case, vide l'input, ding.
   * - Si déjà trouvé → vide l'input silencieusement (cas neutre).
   * - Si pas de match → toast rouge fugace 1.5 s, l'input est CONSERVÉ
   *   pour que l'utilisateur puisse corriger sa typo.
   */
  function handleSubmit(e?: React.FormEvent) {
    e?.preventDefault();
    if (mode === "done") return;
    const value = input.trim();
    if (!value) return;
    const match = matchElementByName(value, targetElements);
    if (!match) {
      setErrorToast(`Aucun élément ne correspond à "${value}"`);
      playSound("buzz");
      window.setTimeout(() => setErrorToast(null), 1500);
      return;
    }
    if (revealed.has(match.numero_atomique)) {
      setInput("");
      return;
    }
    const next = new Set(revealed);
    next.add(match.numero_atomique);
    setRevealed(next);
    setJustFound(match.numero_atomique);
    playSound("ding");
    setInput("");
    window.setTimeout(() => setJustFound(null), 800);
    if (next.size >= total) {
      setMode("done");
    }
  }

  function handleAbandon() {
    if (mode === "done") return;
    const missed = targetElements
      .filter((e) => !revealed.has(e.numero_atomique))
      .map((e) => e.numero_atomique);
    setAbandoned(new Set(missed));
    setMode("done");
    playSound("buzz");
    // G3.3 — Scroll vers les résultats après l'animation cascade
    // (50 ms × N + 300 ms de marge).
    window.setTimeout(
      () => {
        resultsRef.current?.scrollIntoView({
          behavior: "smooth",
          block: "center",
        });
      },
      missed.length * 50 + 300,
    );
  }

  function handleRestartAll() {
    setRevealed(new Set());
    setAbandoned(new Set());
    setRestrictTo(null);
    setInput("");
    setMode("playing");
    inputRef.current?.focus();
  }

  function handleRestartMissed() {
    const missed = Array.from(abandoned);
    if (missed.length === 0) {
      handleRestartAll();
      return;
    }
    setRestrictTo(new Set(missed));
    setRevealed(new Set());
    setAbandoned(new Set());
    setInput("");
    setMode("playing");
    inputRef.current?.focus();
  }

  return (
    <main className="mx-auto flex w-full max-w-7xl flex-1 flex-col gap-4 p-3 sm:p-6 lg:p-8">
      <Link
        href="/revision/tableau-periodique"
        className="inline-flex w-fit items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-semibold text-foreground/80 hover:border-gold/50 hover:bg-gold/10"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Retour
      </Link>

      <header className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="flex flex-col gap-2">
          <div className="inline-flex items-center gap-2 self-start rounded-full bg-gold/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-gold-warm">
            <Brain className="h-3.5 w-3.5" aria-hidden="true" />
            Quizz — Trouve les éléments
          </div>
          <h1 className="font-display text-2xl font-extrabold text-foreground sm:text-3xl">
            {restrictTo
              ? `${total} éléments à retrouver (manqués)`
              : "Trouve les 118 éléments"}
          </h1>
          {mode === "playing" ? (
            <p className="text-sm text-foreground/65">
              Tape le <strong>nom français</strong> de l&apos;élément puis{" "}
              <strong>Entrée</strong>. Le symbole n&apos;est pas accepté ;
              les noms longs tolèrent 1 typo.
            </p>
          ) : (
            <p className="text-sm text-foreground/65">
              {abandoned.size > 0
                ? `Tu as trouvé ${found}/${total} éléments. Bien essayé !`
                : `Bravo ! Tu as trouvé tous les ${total} éléments !`}
            </p>
          )}
        </div>
        <div className="flex flex-col items-end gap-1">
          <p className="font-display text-3xl font-extrabold text-foreground tabular-nums">
            {found}
            <span className="text-foreground/40"> / {total}</span>
          </p>
          <div className="h-2 w-40 overflow-hidden rounded-full bg-foreground/10">
            <motion.div
              className="h-full bg-gold"
              initial={{ width: 0 }}
              animate={{ width: `${percent}%` }}
              transition={{ duration: 0.3 }}
            />
          </div>
        </div>
      </header>

      <FamilyLegend />

      <PeriodicGrid
        elements={elements}
        mode="quizz"
        revealed={revealed}
        abandoned={abandoned}
        justFound={justFound}
      />

      {mode === "playing" && (
        <div className="sticky bottom-2 z-10 mx-auto flex w-full max-w-xl flex-col gap-1.5">
          {/* G3.2 — Toast d'erreur fugace si match KO. */}
          <AnimatePresence>
            {errorToast && (
              <motion.p
                key="err"
                role="alert"
                initial={{ opacity: 0, y: 8 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -4 }}
                className="inline-flex items-center gap-1.5 self-center rounded-full border border-buzz/40 bg-buzz/15 px-3 py-1 text-xs font-bold text-buzz shadow"
              >
                <X className="h-3.5 w-3.5" aria-hidden="true" />
                {errorToast}
              </motion.p>
            )}
          </AnimatePresence>
          <form
            onSubmit={handleSubmit}
            className="flex w-full items-center gap-2 rounded-2xl border-2 border-gold bg-card p-2 shadow-[0_4px_24px_rgba(245,183,0,0.35)]"
          >
            <input
              ref={inputRef}
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Tape un nom d'élément…"
              autoFocus
              autoComplete="off"
              spellCheck={false}
              className="h-11 flex-1 rounded-md border border-border bg-card px-3 text-base text-foreground focus:border-gold focus:outline-none"
            />
            <button
              type="submit"
              disabled={!input.trim()}
              className="inline-flex h-11 items-center gap-1.5 rounded-md bg-gold px-3 text-sm font-bold text-on-color shadow-[0_3px_0_0_#e89e00] transition-all hover:-translate-y-px disabled:opacity-50"
            >
              <Send className="h-4 w-4" aria-hidden="true" />
              Valider
            </button>
            <button
              type="button"
              onClick={handleAbandon}
              className="inline-flex h-11 items-center gap-1.5 rounded-md border border-buzz/40 bg-buzz/5 px-3 text-xs font-bold text-buzz transition-colors hover:border-buzz hover:bg-buzz/10 sm:text-sm"
              title="Donner ma langue au chat"
            >
              <Eye className="h-4 w-4" aria-hidden="true" />
              Abandonner
            </button>
          </form>
        </div>
      )}

      {mode === "done" && (
        <div ref={resultsRef}>
          <DoneSection
            total={total}
            found={found}
            remaining={remaining}
            missed={Array.from(abandoned)
              .map((id) => elements.find((e) => e.numero_atomique === id))
              .filter((e): e is PeriodicElement => !!e)}
            onRestartAll={handleRestartAll}
            onRestartMissed={handleRestartMissed}
          />
        </div>
      )}
    </main>
  );
}

/**
 * G3.3 — Bloc résultats refondu : cercle de progression + 2 actions.
 * Cohérent avec le DoneScreen de QuizPlayer (E2.3).
 */
function DoneSection({
  total,
  found,
  remaining,
  missed,
  onRestartAll,
  onRestartMissed,
}: {
  total: number;
  found: number;
  remaining: number;
  missed: PeriodicElement[];
  onRestartAll: () => void;
  onRestartMissed: () => void;
}) {
  const ratio = total > 0 ? Math.round((found / total) * 100) : 0;
  const titleText =
    ratio === 100
      ? "Session parfaite !"
      : ratio >= 80
        ? "Excellent travail !"
        : ratio >= 60
          ? "Bien joué !"
          : "Continue à t'entraîner !";

  return (
    <motion.section
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: 0.1 }}
      className="flex flex-col items-center gap-5 rounded-2xl border border-gold/40 bg-gradient-to-br from-gold/10 to-sky/5 p-6 text-center"
    >
      <div className="flex h-16 w-16 items-center justify-center rounded-3xl bg-gold/20 text-gold-warm">
        <Trophy className="h-8 w-8" aria-hidden="true" fill="currentColor" />
      </div>
      <h2 className="font-display text-2xl font-extrabold text-foreground sm:text-3xl">
        {titleText}
      </h2>

      {/* Cercle de progression (cohérent avec DoneScreen QuizPlayer). */}
      <CircleProgress percent={ratio} />

      <div className="flex w-full max-w-md gap-3">
        <StatBlock value={found} label="trouvés" tone="green" />
        <StatBlock value={remaining} label="manqués" tone="red" />
      </div>

      {missed.length > 0 && (
        <div className="w-full max-w-2xl rounded-md border border-buzz/30 bg-buzz/5 p-3 text-left">
          <p className="text-xs font-bold uppercase tracking-widest text-buzz">
            À retravailler ({missed.length})
          </p>
          <p className="mt-1 text-sm text-foreground/80">
            {missed
              .slice(0, 30)
              .map((e) => `${e.symbole} (${e.nom})`)
              .join(", ")}
            {missed.length > 30 && ` … et ${missed.length - 30} autre(s).`}
          </p>
        </div>
      )}
      <div className="flex flex-wrap items-center justify-center gap-2">
        <Button variant="gold" size="lg" onClick={onRestartAll}>
          <RotateCcw className="h-4 w-4" aria-hidden="true" />
          Tout recommencer
        </Button>
        {missed.length > 0 && (
          <button
            type="button"
            onClick={onRestartMissed}
            className="inline-flex h-11 items-center gap-2 rounded-md border-2 border-buzz/40 bg-buzz/5 px-5 text-sm font-bold text-buzz transition-colors hover:border-buzz hover:bg-buzz/10"
          >
            <RotateCcw className="h-4 w-4" aria-hidden="true" />
            Recommencer ce qui m&apos;a manqué
          </button>
        )}
      </div>
    </motion.section>
  );
}

/**
 * Cercle SVG animé (1 s) qui affiche le pourcentage au centre.
 * Couleur du trait selon le score : gold ≥ 60, buzz sinon.
 */
function CircleProgress({ percent }: { percent: number }) {
  const radius = 58;
  const circumference = 2 * Math.PI * radius;
  const stroke = percent >= 60 ? "var(--color-gold)" : "var(--color-buzz)";
  return (
    <div className="relative h-36 w-36">
      <svg viewBox="0 0 140 140" className="h-full w-full -rotate-90">
        <circle
          cx="70"
          cy="70"
          r={radius}
          stroke="currentColor"
          strokeWidth="10"
          fill="none"
          className="text-foreground/10"
        />
        <motion.circle
          cx="70"
          cy="70"
          r={radius}
          stroke={stroke}
          strokeWidth="10"
          strokeLinecap="round"
          fill="none"
          strokeDasharray={circumference}
          initial={{ strokeDashoffset: circumference }}
          animate={{
            strokeDashoffset: circumference * (1 - percent / 100),
          }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        <span className="font-display text-3xl font-extrabold text-foreground">
          {percent}%
        </span>
      </div>
    </div>
  );
}

function StatBlock({
  value,
  label,
  tone,
}: {
  value: number;
  label: string;
  tone: "green" | "red";
}) {
  const cls =
    tone === "green"
      ? "border-life-green/30 bg-life-green/10 text-life-green"
      : "border-buzz/30 bg-buzz/10 text-buzz";
  return (
    <div
      className={`flex-1 rounded-xl border p-3 text-center ${cls}`}
    >
      <p className="font-display text-2xl font-extrabold tabular-nums">
        {value}
      </p>
      <p className="text-[11px] font-bold uppercase tracking-widest opacity-80">
        {label}
      </p>
    </div>
  );
}
