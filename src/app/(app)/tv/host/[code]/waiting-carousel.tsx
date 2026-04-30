"use client";

import { useEffect, useMemo, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { BarChart2, Lightbulb, Quote } from "lucide-react";
import { CITATIONS } from "@/lib/tv/citations";
import { getFunStats } from "@/lib/tv/stats";

interface QuizPreview {
  enonce: string;
  format?: string | null;
}

interface WaitingCarouselProps {
  /** Seed pour stabiliser les stats fun (ex. code de room). */
  seed: string;
  /** Quiz d'aperçu chargé côté serveur (1 question random pour l'ambiance). */
  quizPreview: QuizPreview | null;
  /** Délai entre 2 cartes en ms (default 7000). */
  intervalMs?: number;
}

type CardKind = "quiz" | "stat" | "citation";

interface CarouselCard {
  kind: CardKind;
  key: string;
  // Contenu déjà rendu pour ce slot
  title: string;
  body: string;
  caption?: string;
}

/**
 * P3.1 — Carrousel d'ambiance affiché dans le lobby TV pendant que les
 * joueurs rejoignent. Alterne 3 types de cartes (quiz preview, stats fun,
 * citations) toutes les ~7 secondes avec une transition Framer Motion
 * fade + slide.
 *
 * Pas de fetch dynamique : le quiz preview est chargé côté serveur, les
 * stats sont générées à partir d'un seed déterministe (cf. lib/tv/stats.ts),
 * les citations sont en dur dans lib/tv/citations.ts.
 */
export function WaitingCarousel({
  seed,
  quizPreview,
  intervalMs = 7000,
}: WaitingCarouselProps) {
  const cards = useMemo(
    () => buildCards({ seed, quizPreview }),
    [seed, quizPreview],
  );
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (cards.length <= 1) return;
    const id = window.setInterval(() => {
      setIndex((i) => (i + 1) % cards.length);
    }, intervalMs);
    return () => window.clearInterval(id);
  }, [cards.length, intervalMs]);

  if (cards.length === 0) return null;
  const current = cards[index];
  if (!current) return null;

  return (
    <div className="relative h-full w-full overflow-hidden rounded-2xl border border-border bg-card p-5">
      <AnimatePresence mode="wait">
        <motion.div
          key={current.key}
          initial={{ opacity: 0, y: 16 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -16 }}
          transition={{ duration: 0.4, ease: "easeOut" }}
          className="flex h-full flex-col gap-3"
        >
          <header className="flex items-center gap-2">
            {iconFor(current.kind)}
            <p className="text-[10px] font-bold uppercase tracking-widest text-gold-warm">
              {current.title}
            </p>
          </header>
          <p className="font-display text-xl font-extrabold text-foreground sm:text-2xl">
            {current.body}
          </p>
          {current.caption && (
            <p className="mt-auto text-sm text-foreground/60">
              {current.caption}
            </p>
          )}
        </motion.div>
      </AnimatePresence>
      {/* Indicateurs de progression (dots) */}
      <div className="absolute bottom-3 right-3 flex gap-1">
        {cards.map((c, i) => (
          <span
            key={c.key}
            className={
              i === index
                ? "h-1.5 w-4 rounded-full bg-gold transition-all"
                : "h-1.5 w-1.5 rounded-full bg-foreground/20 transition-all"
            }
          />
        ))}
      </div>
    </div>
  );
}

function iconFor(kind: CardKind) {
  if (kind === "quiz") {
    return <Lightbulb className="h-4 w-4 text-gold-warm" aria-hidden="true" />;
  }
  if (kind === "stat") {
    return <BarChart2 className="h-4 w-4 text-gold-warm" aria-hidden="true" />;
  }
  return <Quote className="h-4 w-4 text-gold-warm" aria-hidden="true" />;
}

function buildCards({
  seed,
  quizPreview,
}: {
  seed: string;
  quizPreview: QuizPreview | null;
}): CarouselCard[] {
  const cards: CarouselCard[] = [];

  // Quiz preview en premier (s'il y en a un)
  if (quizPreview) {
    cards.push({
      kind: "quiz",
      key: `quiz-${seed}`,
      title: "Aperçu d'une question",
      body: quizPreview.enonce,
      caption: quizPreview.format ?? "Une de celles qui pourraient tomber",
    });
  }

  // Stats fun
  const stats = getFunStats(seed);
  for (let i = 0; i < stats.length; i++) {
    const s = stats[i];
    if (!s) continue;
    cards.push({
      kind: "stat",
      key: `stat-${i}`,
      title: "Stat du moment",
      body: s.text,
      caption: s.caption,
    });
  }

  // Citations (3 random, ordre stable par seed)
  const pickedCitations = pickCitations(seed, 3);
  for (let i = 0; i < pickedCitations.length; i++) {
    const c = pickedCitations[i];
    if (!c) continue;
    cards.push({
      kind: "citation",
      key: `citation-${i}`,
      title: "Citation",
      body: `« ${c.text} »`,
      caption: c.author,
    });
  }

  return interleave(cards);
}

/**
 * Re-mélange les cartes pour alterner les types (quiz/stat/citation/...)
 * plutôt que de les afficher par bloc. Round-robin par kind.
 */
function interleave(cards: CarouselCard[]): CarouselCard[] {
  const byKind: Record<CardKind, CarouselCard[]> = {
    quiz: [],
    stat: [],
    citation: [],
  };
  for (const c of cards) byKind[c.kind].push(c);
  const order: CardKind[] = ["quiz", "stat", "citation"];
  const out: CarouselCard[] = [];
  let added = true;
  while (added) {
    added = false;
    for (const k of order) {
      const next = byKind[k].shift();
      if (next) {
        out.push(next);
        added = true;
      }
    }
  }
  return out;
}

/**
 * Sélection déterministe de N citations à partir du seed (rotation
 * différente entre rooms, mais stable au sein d'une session).
 */
function pickCitations(seed: string, n: number) {
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const startIdx = h % CITATIONS.length;
  const out = [];
  for (let i = 0; i < n; i++) {
    out.push(CITATIONS[(startIdx + i) % CITATIONS.length]);
  }
  return out;
}
