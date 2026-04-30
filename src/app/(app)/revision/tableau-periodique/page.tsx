import { redirect } from "next/navigation";
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Brain,
  FlaskConical,
} from "lucide-react";
import Link from "next/link";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Tableau périodique" };
export const dynamic = "force-dynamic";

/**
 * Hub du tableau périodique (F2.1).
 * 2 sous-modes : Apprendre (consultation) et Quizz (saisie progressive).
 */
export default async function TableauPeriodiqueHub() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // Stats simples : combien d'éléments en BDD ?
  const { count } = await supabase
    .from("periodic_elements")
    .select("numero_atomique", { count: "exact", head: true });

  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <Link
        href="/revision"
        className="inline-flex w-fit items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-semibold text-foreground/80 hover:border-gold/50 hover:bg-gold/10"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Retour aux modes
      </Link>

      <header className="flex flex-col items-center gap-3 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-sky/15 text-sky">
          <FlaskConical className="h-10 w-10" aria-hidden="true" />
        </div>
        <p className="text-xs font-bold uppercase tracking-widest text-sky">
          Tableau périodique
        </p>
        <h1 className="font-display text-4xl font-extrabold text-foreground">
          Mendeleïev, ton ami
        </h1>
        <p className="max-w-xl text-foreground/70">
          {count ?? 118} éléments — apprends-les ou défie-toi à les
          retrouver de mémoire.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/revision/tableau-periodique/apprendre"
          className="group flex flex-col gap-3 rounded-2xl border border-border bg-card p-6 transition-all hover:scale-[1.02] hover:border-sky/50 hover:bg-sky/5 hover:shadow-[0_0_24px_rgba(43,142,230,0.25)]"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-sky/15 text-sky transition-transform group-hover:scale-110">
            <BookOpen className="h-7 w-7" aria-hidden="true" />
          </div>
          <h2 className="font-display text-2xl font-extrabold text-foreground">
            Apprendre
          </h2>
          <p className="text-sm text-foreground/70">
            Tableau complet, cases colorées par famille, clic pour les
            détails. Filtres par famille, période, état.
          </p>
          <span className="mt-auto inline-flex items-center gap-1 text-sm font-bold text-sky">
            Consulter
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </span>
        </Link>

        <Link
          href="/revision/tableau-periodique/quizz"
          className="group flex flex-col gap-3 rounded-2xl border border-border bg-card p-6 transition-all hover:scale-[1.02] hover:border-gold/50 hover:bg-gold/5 hover:shadow-[0_0_24px_rgba(245,183,0,0.25)]"
        >
          <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gold/15 text-gold-warm transition-transform group-hover:scale-110">
            <Brain className="h-7 w-7" aria-hidden="true" />
          </div>
          <h2 className="font-display text-2xl font-extrabold text-foreground">
            Quizz
          </h2>
          <p className="text-sm text-foreground/70">
            Tableau vide. Tape un symbole ou un nom : la case se remplit
            avec sa couleur. Trouve les 118 éléments !
          </p>
          <span className="mt-auto inline-flex items-center gap-1 text-sm font-bold text-gold-warm">
            Démarrer
            <ArrowRight className="h-4 w-4" aria-hidden="true" />
          </span>
        </Link>
      </div>
    </main>
  );
}
