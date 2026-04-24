import {
  Brain,
  ChevronRight,
  Crown,
  Dices,
  Grid3x3,
  Star,
  Sword,
  Trophy,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8">
      {/* Hero — parcours complet (mode 12 Coups multijoueur) */}
      <HeroTile
        href="/jouer/douze-coups"
        title="Les 12 Coups de Midi"
        subtitle="Parcours multijoueur : Coup d'Envoi → Duel → Coup par Coup → Face-à-Face"
        icon={Crown}
      />

      {/* 4 tuiles des jeux principaux */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile
          href="/jouer/jeu-1"
          title="Le Coup d'Envoi"
          subtitle="Vrai / Faux, l'un ou l'autre"
          icon={Dices}
          accent="gold"
        />
        <Tile
          href="/jouer/jeu-2"
          title="Le Coup par Coup"
          subtitle="7 propositions, 1 intrus"
          icon={Grid3x3}
          accent="sky"
        />
        <Tile
          href="/jouer/face-a-face"
          title="Le Coup Fatal"
          subtitle="Duel 60 s, voix ou clavier"
          icon={Sword}
          accent="buzz"
        />
        <Tile
          href="/jouer/coup-de-maitre"
          title="Coup de Maître"
          subtitle="4 célébrités, 45 s"
          icon={Trophy}
          accent="gold"
        />
      </div>

      {/* Ligne bonus + révision */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Link
          href="/revision"
          className="group relative flex items-center gap-5 overflow-hidden rounded-2xl border border-border bg-card p-5 glow-card transition-all hover:scale-[1.01] hover:border-life-green/60"
        >
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-life-green/15 text-life-green">
            <Brain className="h-7 w-7" aria-hidden="true" />
          </div>
          <div className="flex-1">
            <h2 className="font-display text-xl font-bold text-navy">
              Mode Révision
            </h2>
            <p className="text-sm text-navy/70">
              Rejoue tes questions ratées.
            </p>
          </div>
          <ChevronRight
            className="h-6 w-6 text-navy/30 transition-transform group-hover:translate-x-1 group-hover:text-life-green"
            aria-hidden="true"
          />
        </Link>

        <Link
          href="/jouer/etoile"
          className="group relative flex items-center gap-5 overflow-hidden rounded-2xl border border-border bg-card p-5 glow-card transition-all hover:scale-[1.01] hover:border-sky/60"
        >
          <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-sky/15 text-sky">
            <Star className="h-7 w-7" aria-hidden="true" fill="currentColor" />
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <h2 className="font-display text-xl font-bold text-navy">
                Étoile Mystérieuse
              </h2>
              <span className="rounded-full bg-cream-deep px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-navy/60">
                Bonus
              </span>
            </div>
            <p className="text-sm text-navy/70">
              Devine la célébrité avec 5 indices.
            </p>
          </div>
          <ChevronRight
            className="h-6 w-6 text-navy/30 transition-transform group-hover:translate-x-1 group-hover:text-sky"
            aria-hidden="true"
          />
        </Link>
      </div>
    </main>
  );
}

// ---------------------------------------------------------------------------

interface HeroTileProps {
  href: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
}

function HeroTile({ href, title, subtitle }: HeroTileProps) {
  return (
    <Link
      href={href}
      className="group relative overflow-hidden rounded-3xl border border-gold/40 bg-gradient-to-br from-gold-pale via-cream to-sky-pale p-8 transition-all hover:scale-[1.01] hover:border-gold glow-sun sm:p-10"
    >
      <div className="absolute -right-12 -top-12 h-56 w-56 rounded-full bg-gold/35 blur-3xl animate-sun-pulse" />
      <div className="absolute -bottom-16 -left-16 h-56 w-56 rounded-full bg-sky/15 blur-3xl" />
      <div className="relative flex items-start gap-6">
        <div className="flex h-20 w-20 shrink-0 items-center justify-center rounded-2xl bg-white shadow-[0_8px_32px_rgba(245,183,0,0.45)]">
          <Image
            src="/logo.svg"
            alt=""
            width={64}
            height={64}
            className="h-14 w-14"
            priority
          />
        </div>
        <div className="flex-1">
          <p className="text-xs font-bold uppercase tracking-widest text-gold-warm">
            Parcours complet
          </p>
          <h1 className="mt-1 font-display text-3xl font-extrabold text-navy sm:text-4xl">
            {title}
          </h1>
          <p className="mt-2 text-navy/75 sm:text-lg">{subtitle}</p>
        </div>
        <ChevronRight
          className="h-8 w-8 text-gold-warm transition-transform group-hover:translate-x-2"
          aria-hidden="true"
        />
      </div>
    </Link>
  );
}

// ---------------------------------------------------------------------------

interface TileProps {
  href: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  accent: "gold" | "buzz" | "sky";
}

function Tile({ href, title, subtitle, icon: Icon, accent }: TileProps) {
  const accentClass = {
    gold: {
      hoverBorder: "hover:border-gold/60",
      hoverShadow: "hover:shadow-[0_0_32px_rgba(245,183,0,0.25)]",
      iconBg: "bg-gold/15 text-gold-warm",
    },
    sky: {
      hoverBorder: "hover:border-sky/60",
      hoverShadow: "hover:shadow-[0_0_32px_rgba(43,142,230,0.25)]",
      iconBg: "bg-sky/15 text-sky",
    },
    buzz: {
      hoverBorder: "hover:border-buzz/60",
      hoverShadow: "hover:shadow-[0_0_32px_rgba(230,57,70,0.25)]",
      iconBg: "bg-buzz/15 text-buzz",
    },
  }[accent];

  return (
    <Link
      href={href}
      className={cn(
        "group relative flex flex-col gap-3 overflow-hidden rounded-2xl border border-border bg-card p-5 glow-card transition-all hover:scale-[1.02]",
        accentClass.hoverBorder,
        accentClass.hoverShadow,
      )}
    >
      <div
        className={cn(
          "flex h-12 w-12 items-center justify-center rounded-xl transition-transform group-hover:scale-110",
          accentClass.iconBg,
        )}
      >
        <Icon className="h-6 w-6" aria-hidden="true" />
      </div>
      <div className="flex-1">
        <h3 className="font-display text-lg font-bold text-navy">{title}</h3>
        <p className="text-sm text-navy/60">{subtitle}</p>
      </div>
    </Link>
  );
}
