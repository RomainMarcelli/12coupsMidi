import {
  ChevronRight,
  Dices,
  Gamepad2,
  Grid3x3,
  Star,
  Sword,
  Tv,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import type { LucideIcon } from "lucide-react";
import { getCurrentBranding } from "@/lib/branding";
import { cn } from "@/lib/utils";

export const metadata = { title: "Jouer" };

interface GameItem {
  href: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  accent: "gold" | "buzz" | "sky";
  available: boolean;
  bonus?: boolean;
}

// J4.2 — Coup de Maître retiré de l'UI (mode pas implémenté
// pour V1). Les fichiers du repo sont conservés (route et
// composants), juste plus exposés dans la liste.
// const COUP_DE_MAITRE_DISABLED: GameItem = {
//   href: "/jouer/coup-de-maitre",
//   title: "Coup de Maître",
//   subtitle: "4 célébrités, 45 s. Le finale légendaire.",
//   icon: Trophy,
//   accent: "gold",
//   available: false,
// };

const MAIN_GAMES: GameItem[] = [
  {
    href: "/jouer/jeu-1",
    title: "Le Coup d'Envoi",
    subtitle: "Vrai / Faux, L'un ou l'autre, Plus ou moins. 2 erreurs = Duel.",
    icon: Dices,
    accent: "gold",
    available: true,
  },
  {
    href: "/jouer/jeu-2",
    title: "Le Coup par Coup",
    subtitle: "7 propositions par manche, 6 liées, 1 intrus à éviter.",
    icon: Grid3x3,
    accent: "sky",
    available: true,
  },
  {
    href: "/jouer/face-a-face",
    title: "Le Coup Fatal",
    subtitle: "60 s par joueur, vs bot ou ami, voix ou clavier.",
    icon: Sword,
    accent: "buzz",
    available: true,
  },
];

const BONUS_GAMES: GameItem[] = [
  {
    href: "/jouer/etoile",
    title: "Étoile Mystérieuse",
    subtitle: "Devine la célébrité à partir de 5 indices progressifs.",
    icon: Star,
    accent: "sky",
    available: true,
    bonus: true,
  },
];

export default async function JouerPage() {
  // K4 + K5.2 — Logo principal conditionnel utilisé dans le hero
  // "Les 12 Coups de Midi". Owner = logo Mahylan, sinon générique.
  const branding = await getCurrentBranding();
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-3xl font-extrabold text-foreground sm:text-4xl">
          Choisis ton jeu
        </h1>
        <p className="text-foreground/70">
          Le parcours complet ou les épreuves prises individuellement.
        </p>
      </header>

      {/* J4.2 — Hero "12 Coups de Midi" en tête de page : parcours
          multijoueur complet, mis en avant avec un liseré doré. Style
          aligné sur la HeroTile de l'accueil.
          K5.2 — Logo PNG (branding-aware) au lieu de l'icône Crown. */}
      <Link
        href="/jouer/douze-coups"
        className="group relative flex items-center gap-4 overflow-hidden rounded-2xl border border-border bg-card p-4 glow-card transition-all hover:border-gold/60 hover:shadow-[0_0_32px_rgba(245,183,0,0.18)] sm:p-5"
      >
        <div
          className="absolute inset-y-0 left-0 w-1 bg-gold"
          aria-hidden="true"
        />
        <Image
          src={branding.logoUrl}
          alt=""
          width={120}
          height={120}
          className="h-14 w-14 shrink-0 rounded-xl object-contain"
        />
        <div className="min-w-0 flex-1">
          <p className="text-[11px] font-bold uppercase tracking-widest text-gold-warm">
            Parcours complet
          </p>
          <h2 className="mt-0.5 font-display text-xl font-extrabold text-foreground sm:text-2xl">
            Les 12 Coups de Midi
          </h2>
          <p className="mt-0.5 text-sm text-foreground/65">
            Le parcours complet, contre des bots ou des humains.
          </p>
        </div>
        <ChevronRight
          className="h-5 w-5 shrink-0 text-foreground/30 transition-transform group-hover:translate-x-1 group-hover:text-gold"
          aria-hidden="true"
        />
      </Link>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-bold uppercase tracking-widest text-foreground/50">
          Épreuves individuelles
        </h2>
        {MAIN_GAMES.map((g) => (
          <GameRow key={g.href} game={g} />
        ))}
      </section>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-bold uppercase tracking-widest text-foreground/50">
          Bonus
        </h2>
        {BONUS_GAMES.map((g) => (
          <GameRow key={g.href} game={g} />
        ))}
      </section>

      {/* H4.4 — Mode TV : 2 boutons côte à côte (style Kahoot). Le
          bouton "Rejoindre" pointe vers /play (publique, sans auth)
          pour que des invités puissent s'y connecter. */}
      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-bold uppercase tracking-widest text-foreground/50">
          Mode TV Soirée
        </h2>
        <div className="grid gap-3 sm:grid-cols-2">
          <Link
            href="/tv/host"
            className="group flex flex-col items-start gap-2 rounded-2xl border-2 border-gold/40 bg-card p-5 transition-all hover:scale-[1.02] hover:border-gold hover:shadow-[0_0_24px_rgba(245,183,0,0.25)]"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-gold/15 text-gold-warm transition-transform group-hover:scale-110">
              <Tv className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <h3 className="font-display text-lg font-bold text-foreground">
                Créer une partie TV
              </h3>
              <p className="text-sm text-foreground/70">
                Affiche un code à 4 chiffres et un QR code. Tes invités
                rejoignent depuis leur téléphone.
              </p>
            </div>
          </Link>
          <Link
            href="/play"
            className="group flex flex-col items-start gap-2 rounded-2xl border-2 border-sky/40 bg-card p-5 transition-all hover:scale-[1.02] hover:border-sky hover:shadow-[0_0_24px_rgba(43,142,230,0.25)]"
          >
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-sky/15 text-sky transition-transform group-hover:scale-110">
              <Gamepad2 className="h-6 w-6" aria-hidden="true" />
            </div>
            <div>
              <h3 className="font-display text-lg font-bold text-foreground">
                Rejoindre une partie
              </h3>
              <p className="text-sm text-foreground/70">
                Entre le code à 4 chiffres affiché sur la TV de l&apos;hôte.
              </p>
            </div>
          </Link>
        </div>
      </section>
    </main>
  );
}

function GameRow({ game }: { game: GameItem }) {
  const accentRing = {
    gold: "hover:border-gold/60",
    sky: "hover:border-sky/60",
    buzz: "hover:border-buzz/60",
  }[game.accent];
  const iconBg = {
    gold: "bg-gold/15 text-gold-warm",
    sky: "bg-sky/15 text-sky",
    buzz: "bg-buzz/15 text-buzz",
  }[game.accent];

  const Icon = game.icon;

  return (
    <Link
      href={game.href}
      className={cn(
        "group relative flex items-center gap-5 rounded-2xl border border-border bg-card p-5 glow-card transition-all hover:scale-[1.01]",
        accentRing,
      )}
    >
      <div
        className={cn(
          "flex h-14 w-14 shrink-0 items-center justify-center rounded-xl transition-transform group-hover:scale-110",
          iconBg,
        )}
      >
        <Icon className="h-7 w-7" aria-hidden="true" />
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2">
          <h2 className="font-display text-xl font-bold text-foreground">
            {game.title}
          </h2>
          {!game.available && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-foreground/60">
              Bientôt
            </span>
          )}
          {game.bonus && (
            <span className="rounded-full bg-sky/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-sky">
              Bonus
            </span>
          )}
        </div>
        <p className="text-sm text-foreground/70">{game.subtitle}</p>
      </div>
      <ChevronRight
        className="h-6 w-6 text-foreground/30 transition-transform group-hover:translate-x-1 group-hover:text-gold-warm"
        aria-hidden="true"
      />
    </Link>
  );
}
