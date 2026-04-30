import Link from "next/link";
import { ArrowRight, ImagePlus, ListChecks, Users } from "lucide-react";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createClient } from "@/lib/supabase/server";

export const metadata = { title: "Administration" };
export const dynamic = "force-dynamic";

/**
 * G4.1 — Hub d'administration.
 *
 * Page d'accueil de la zone admin. Présente 3 cards (Questions, Users,
 * Avatars) avec stats live tirées de la BDD. La card Avatars est
 * désactivée avec badge "Bientôt" — la sous-page n'existe pas encore.
 */
export default async function AdminHubPage() {
  await requireAdmin();
  const supabase = await createClient();

  // Stats live — comptes simples via Supabase head:true (rapide).
  const [{ count: questionsCount }, { count: usersCount }, { count: adminCount }] =
    await Promise.all([
      supabase.from("questions").select("id", { count: "exact", head: true }),
      supabase.from("profiles").select("id", { count: "exact", head: true }),
      supabase
        .from("profiles")
        .select("id", { count: "exact", head: true })
        .eq("role", "admin"),
    ]);

  const cards: HubCard[] = [
    {
      href: "/admin/questions",
      title: "Gérer les questions",
      desc: "Importer, modifier, supprimer les questions du jeu.",
      stats: questionsCount != null ? `${questionsCount} questions au total` : "—",
      icon: ListChecks,
      accent: "gold",
    },
    {
      href: "/admin/users",
      title: "Gérer les utilisateurs",
      desc: "Voir, modifier le rôle ou supprimer des comptes utilisateurs.",
      stats:
        usersCount != null
          ? `${usersCount} users · ${adminCount ?? 0} admin${(adminCount ?? 0) > 1 ? "s" : ""}`
          : "—",
      icon: Users,
      accent: "sky",
    },
    {
      href: "/admin/avatars",
      title: "Gérer les avatars",
      desc: "Importer des avatars custom pour les utilisateurs.",
      stats: "Pack pré-défini + uploads admin",
      icon: ImagePlus,
      accent: "buzz",
    },
  ];

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col gap-1">
        <p className="text-xs font-bold uppercase tracking-widest text-buzz">
          Zone admin
        </p>
        <h1 className="font-display text-3xl font-extrabold text-foreground sm:text-4xl">
          Administration
        </h1>
        <p className="text-foreground/65">
          Gère les questions, les utilisateurs et les paramètres globaux.
        </p>
      </header>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        {cards.map((c) => (
          <AdminCard key={c.href} card={c} />
        ))}
      </div>
    </main>
  );
}

interface HubCard {
  href: string;
  title: string;
  desc: string;
  stats: string;
  icon: typeof Users;
  accent: "gold" | "sky" | "buzz";
  disabled?: boolean;
}

function AdminCard({ card }: { card: HubCard }) {
  const Icon = card.icon;
  const accentBg = {
    gold: "bg-gold/15 text-gold-warm",
    sky: "bg-sky/15 text-sky",
    buzz: "bg-buzz/15 text-buzz",
  }[card.accent];
  const accentBorder = {
    gold: "hover:border-gold/50 hover:shadow-[0_0_24px_rgba(245,183,0,0.25)]",
    sky: "hover:border-sky/50 hover:shadow-[0_0_24px_rgba(43,142,230,0.25)]",
    buzz: "hover:border-buzz/50 hover:shadow-[0_0_24px_rgba(230,57,70,0.25)]",
  }[card.accent];

  const inner = (
    <>
      <div
        className={`flex h-14 w-14 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-110 ${accentBg}`}
      >
        <Icon className="h-7 w-7" aria-hidden="true" />
      </div>
      <div className="flex flex-col gap-1">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-lg font-bold text-foreground">
            {card.title}
          </h2>
          {card.disabled && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-foreground/65">
              Bientôt
            </span>
          )}
        </div>
        <p className="text-sm text-foreground/70">{card.desc}</p>
        <p className="mt-1 text-[11px] font-bold uppercase tracking-widest text-foreground/55">
          {card.stats}
        </p>
      </div>
      {!card.disabled && (
        <ArrowRight
          className="ml-auto h-5 w-5 text-foreground/40 transition-transform group-hover:translate-x-1 group-hover:text-foreground"
          aria-hidden="true"
        />
      )}
    </>
  );

  const baseCls =
    "group relative flex items-start gap-4 rounded-2xl border border-border bg-card p-5 glow-card transition-all";

  if (card.disabled) {
    return (
      <div
        className={`${baseCls} cursor-not-allowed opacity-60`}
        aria-disabled="true"
      >
        {inner}
      </div>
    );
  }

  return (
    <Link
      href={card.href}
      className={`${baseCls} hover:scale-[1.02] ${accentBorder}`}
    >
      {inner}
    </Link>
  );
}
