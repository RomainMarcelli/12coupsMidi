"use client";

import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Layers,
  Shuffle,
} from "lucide-react";
import Link from "next/link";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";

interface CategoryWithCount {
  id: number;
  nom: string;
  slug: string;
  couleur: string | null;
  count: number;
}

interface Props {
  categories: CategoryWithCount[];
  totalQuestions: number;
}

/**
 * Page de sélection de catégorie pour les Fiches de révision (E2.4).
 *
 * Grille responsive (1/2/3 cols) de cards colorées (1 par catégorie).
 * Hover : scale + shadow. Apparition en stagger via Framer Motion.
 * Card "Toutes les catégories" en bas qui mélange tout.
 */
export function FichesCategoriesClient({
  categories,
  totalQuestions,
}: Props) {
  const playableCategories = categories.filter((c) => c.count > 0);

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5 p-4 sm:p-6 lg:p-8">
      {/* Retour */}
      <Link
        href="/revision"
        className="inline-flex w-fit items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-semibold text-foreground/80 hover:border-gold/50 hover:bg-gold/10"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Retour aux modes
      </Link>

      {/* Header */}
      <header className="flex flex-col gap-2">
        <div className="inline-flex items-center gap-2 self-start rounded-full bg-sky/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-sky">
          <BookOpen className="h-3.5 w-3.5" aria-hidden="true" />
          Fiches de révision
        </div>
        <h1 className="font-display text-3xl font-extrabold text-foreground sm:text-4xl">
          Choisis une catégorie
        </h1>
        <p className="text-foreground/70">
          Apprends carte par carte avec révélation guidée. Auto-évaluation
          à chaque question — tes erreurs alimentent ton « Retravailler ».
        </p>
        <p className="text-sm text-foreground/55">
          <strong className="text-foreground">{totalQuestions}</strong>{" "}
          fiche{totalQuestions > 1 ? "s" : ""} au total ·{" "}
          <strong className="text-foreground">
            {playableCategories.length}
          </strong>{" "}
          catégorie{playableCategories.length > 1 ? "s" : ""} disponible
          {playableCategories.length > 1 ? "s" : ""}
        </p>
      </header>

      {/* Grille de cards */}
      <motion.div
        initial="hidden"
        animate="show"
        variants={{
          hidden: {},
          show: { transition: { staggerChildren: 0.05 } },
        }}
        className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3"
      >
        {playableCategories.map((c) => (
          <CategoryCard key={c.id} category={c} />
        ))}
      </motion.div>

      {/* Card "Toutes les catégories" en bas */}
      {playableCategories.length > 1 && (
        <Link
          href="/revision/fiches/toutes"
          className="mt-2 flex items-center gap-3 rounded-2xl border border-border bg-card p-4 transition-all hover:scale-[1.01] hover:border-gold/50 hover:shadow-[0_0_24px_rgba(245,183,0,0.2)]"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gold/15 text-gold-warm">
            <Shuffle className="h-6 w-6" aria-hidden="true" />
          </div>
          <div className="flex-1">
            <h3 className="font-display text-lg font-bold text-foreground">
              Toutes les catégories
            </h3>
            <p className="text-sm text-foreground/70">
              Mélange aléatoire de toutes les fiches dispo
            </p>
          </div>
          <ArrowRight
            className="h-5 w-5 text-foreground/40"
            aria-hidden="true"
          />
        </Link>
      )}

      {/* Catégories sans questions (info) */}
      {categories.length > playableCategories.length && (
        <p className="rounded-md border border-border bg-card/40 px-3 py-2 text-xs text-foreground/55">
          {categories.length - playableCategories.length} catégorie
          {categories.length - playableCategories.length > 1 ? "s" : ""} sans
          fiche disponible — bientôt seedée
          {categories.length - playableCategories.length > 1 ? "s" : ""}.
        </p>
      )}
    </main>
  );
}

function CategoryCard({ category }: { category: CategoryWithCount }) {
  const bg = category.couleur ?? "#F5B700";
  return (
    <motion.div
      variants={{
        hidden: { opacity: 0, y: 12 },
        show: { opacity: 1, y: 0 },
      }}
    >
      <Link
        href={`/revision/fiches/${category.slug}`}
        className={cn(
          "group relative flex h-full flex-col gap-3 overflow-hidden rounded-2xl border border-border p-5 text-left transition-all",
          "hover:scale-[1.04] hover:border-gold/60 hover:shadow-[0_0_28px_rgba(245,183,0,0.35)]",
        )}
        style={{
          backgroundColor: bg,
          color: "#0B1F4D",
        }}
      >
        {/* Halo/blob décoratif en background */}
        <div
          aria-hidden="true"
          className="pointer-events-none absolute -right-10 -top-10 h-32 w-32 rounded-full bg-white/15 blur-2xl"
        />
        <div
          className="relative flex h-14 w-14 items-center justify-center rounded-xl text-on-color backdrop-blur-sm transition-transform group-hover:scale-110"
          style={{ backgroundColor: "rgba(11, 31, 77, 0.15)" }}
        >
          <Layers className="h-7 w-7" aria-hidden="true" />
        </div>
        <div className="relative">
          <h3 className="font-display text-2xl font-extrabold leading-tight">
            {category.nom}
          </h3>
          <p className="mt-1 text-xs font-semibold uppercase tracking-widest opacity-80">
            {category.count} fiche{category.count > 1 ? "s" : ""}
          </p>
        </div>
        <div className="relative mt-auto inline-flex items-center gap-1 text-sm font-bold opacity-70 transition-opacity group-hover:opacity-100">
          Réviser
          <ArrowRight className="h-4 w-4" aria-hidden="true" />
        </div>
      </Link>
    </motion.div>
  );
}
