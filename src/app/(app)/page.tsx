import {
  Brain,
  ChevronRight,
  Crown,
  Dices,
  RotateCcw,
  Star,
  Sword,
  Trophy,
} from "lucide-react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8">
      {/* Hero — parcours complet */}
      <HeroTile
        href="/parcours"
        title="Lancer le parcours"
        subtitle="L'émission complète : Jeu 1 → Étoile → Face-à-Face → Coup de Maître"
        icon={Crown}
      />

      {/* 4 tuiles de jeux */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Tile
          href="/jouer/jeu-1"
          title="Quizz 1 / 2"
          subtitle="10 questions, 3 vies"
          icon={Dices}
          accent="gold"
        />
        <Tile
          href="/jouer/jeu-2"
          title="Étoile Mystérieuse"
          subtitle="Devine la personnalité"
          icon={Star}
          accent="gold"
        />
        <Tile
          href="/jouer/face-a-face"
          title="Face-à-Face"
          subtitle="Vs bot ou ami, 60s"
          icon={Sword}
          accent="buzz"
        />
        <Tile
          href="/jouer/coup-de-maitre"
          title="Coup de Maître"
          subtitle="4 célébrités, 45s"
          icon={Trophy}
          accent="gold"
        />
      </div>

      {/* Révision */}
      <Link
        href="/revision"
        className="group relative flex items-center gap-5 overflow-hidden rounded-2xl border border-white/10 bg-card p-5 transition-all hover:scale-[1.01] hover:border-gold/40 hover:bg-card/80"
      >
        <div className="flex h-14 w-14 shrink-0 items-center justify-center rounded-xl bg-life-green/20 text-life-green">
          <Brain className="h-7 w-7" aria-hidden="true" />
        </div>
        <div className="flex-1">
          <h2 className="font-display text-xl font-bold text-cream">
            Mode Révision
          </h2>
          <p className="text-sm text-cream/70">
            Rejoue les questions que tu as ratées jusqu'à les maîtriser.
          </p>
        </div>
        <ChevronRight
          className="h-6 w-6 text-cream/40 transition-transform group-hover:translate-x-1 group-hover:text-gold"
          aria-hidden="true"
        />
      </Link>
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

function HeroTile({ href, title, subtitle, icon: Icon }: HeroTileProps) {
  return (
    <Link
      href={href}
      className="group relative overflow-hidden rounded-3xl border border-gold/30 bg-gradient-to-br from-gold/20 via-midnight to-midnight-deep p-8 transition-all hover:scale-[1.02] hover:border-gold glow-midnight sm:p-10"
    >
      <div className="absolute -right-8 -top-8 h-48 w-48 rounded-full bg-gold/20 blur-3xl transition-opacity group-hover:opacity-80" />
      <div className="relative flex items-start gap-6">
        <div className="flex h-16 w-16 shrink-0 items-center justify-center rounded-2xl bg-gold text-midnight shadow-[0_0_32px_rgba(245,197,24,0.6)]">
          <Icon className="h-9 w-9" aria-hidden="true" />
        </div>
        <div className="flex-1">
          <p className="text-xs font-semibold uppercase tracking-widest text-gold">
            Parcours complet
          </p>
          <h1 className="mt-1 font-display text-3xl font-extrabold text-cream sm:text-4xl">
            {title}
          </h1>
          <p className="mt-2 text-cream/70 sm:text-lg">{subtitle}</p>
        </div>
        <ChevronRight
          className="h-8 w-8 text-gold transition-transform group-hover:translate-x-2"
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
  accent: "gold" | "buzz";
}

function Tile({ href, title, subtitle, icon: Icon, accent }: TileProps) {
  return (
    <Link
      href={href}
      className={cn(
        "group relative flex flex-col gap-3 overflow-hidden rounded-2xl border border-white/10 bg-card p-5 transition-all hover:scale-[1.02]",
        accent === "gold"
          ? "hover:border-gold/60 hover:shadow-[0_0_32px_rgba(245,197,24,0.25)]"
          : "hover:border-buzz/60 hover:shadow-[0_0_32px_rgba(230,57,70,0.25)]",
      )}
    >
      <div
        className={cn(
          "flex h-12 w-12 items-center justify-center rounded-xl transition-transform group-hover:scale-110",
          accent === "gold"
            ? "bg-gold/20 text-gold"
            : "bg-buzz/20 text-buzz",
        )}
      >
        <Icon className="h-6 w-6" aria-hidden="true" />
      </div>
      <div className="flex-1">
        <h3 className="font-display text-lg font-bold text-cream">{title}</h3>
        <p className="text-sm text-cream/60">{subtitle}</p>
      </div>
    </Link>
  );
}
