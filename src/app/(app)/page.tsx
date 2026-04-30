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
import { getCurrentBranding } from "@/lib/branding";
import { cn } from "@/lib/utils";

export default async function Home() {
  const branding = await getCurrentBranding();
  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8">
      {/* Hero — parcours complet (mode 12 Coups multijoueur).
          L2.2 — Logo plus grand pour le owner, halo doré permanent. */}
      <HeroTile
        href="/jouer/douze-coups"
        title="Les 12 Coups de Midi"
        subtitle="Parcours multijoueur : Coup d'Envoi → Duel → Coup par Coup → Face-à-Face"
        icon={Crown}
        logoUrl={branding.logoUrl}
        logoLargeUrl={branding.logoLargeUrl}
        isOwner={branding.isOwner}
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
            <h2 className="font-display text-xl font-bold text-foreground">
              Mode Révision
            </h2>
            <p className="text-sm text-foreground/70">
              Rejoue tes questions ratées.
            </p>
          </div>
          <ChevronRight
            className="h-6 w-6 text-foreground/30 transition-transform group-hover:translate-x-1 group-hover:text-life-green"
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
              <h2 className="font-display text-xl font-bold text-foreground">
                Étoile Mystérieuse
              </h2>
              <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-foreground/60">
                Bonus
              </span>
            </div>
            <p className="text-sm text-foreground/70">
              Devine la célébrité avec 5 indices.
            </p>
          </div>
          <ChevronRight
            className="h-6 w-6 text-foreground/30 transition-transform group-hover:translate-x-1 group-hover:text-sky"
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
  logoUrl: string;
  logoLargeUrl: string;
  isOwner: boolean;
}

function HeroTile({
  href,
  title,
  subtitle,
  logoUrl,
  logoLargeUrl,
  isOwner,
}: HeroTileProps) {
  return (
    <Link
      href={href}
      className={cn(
        "group relative flex items-center gap-4 overflow-hidden rounded-2xl border bg-card glow-card transition-all hover:border-gold/60 hover:shadow-[0_0_32px_rgba(245,183,0,0.18)]",
        // L2.2 — Pour le owner, hero plus généreux + halo permanent.
        isOwner
          ? "border-gold/40 p-5 shadow-[0_0_28px_rgba(245,183,0,0.18)] sm:gap-6 sm:p-7"
          : "border-border p-4 sm:p-5",
      )}
    >
      {/* Liseré doré gauche : signal "parcours principal" sans gradient
          tape-à-l'œil. */}
      <div
        className="absolute inset-y-0 left-0 w-1 bg-gold"
        aria-hidden="true"
      />
      <Image
        src={isOwner ? logoLargeUrl : logoUrl}
        alt=""
        width={240}
        height={240}
        className={cn(
          // L+ — `object-contain` (pas de crop) + retrait du
          // `rounded-xl` qui cadrait visuellement le logo. Le PNG
          // est transparent, autant le laisser flotter.
          // M3.1 — Tailles bumpées pour plus d'impact (owner inchangé).
          "shrink-0 object-contain",
          isOwner
            ? "h-24 w-24 drop-shadow-[0_0_20px_rgba(245,197,24,0.5)] sm:h-32 sm:w-32"
            : "h-20 w-20 sm:h-24 sm:w-24",
        )}
        priority
      />
      <div className="min-w-0 flex-1">
        <p className="text-[11px] font-bold uppercase tracking-widest text-gold-warm">
          Parcours complet
        </p>
        <h1 className="mt-0.5 truncate font-display text-xl font-extrabold text-foreground sm:text-2xl">
          {title}
        </h1>
        <p className="mt-0.5 text-sm text-foreground/65">{subtitle}</p>
      </div>
      <ChevronRight
        className="h-5 w-5 shrink-0 text-foreground/30 transition-transform group-hover:translate-x-1 group-hover:text-gold"
        aria-hidden="true"
      />
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
        <h3 className="font-display text-lg font-bold text-foreground">{title}</h3>
        <p className="text-sm text-foreground/60">{subtitle}</p>
      </div>
    </Link>
  );
}
