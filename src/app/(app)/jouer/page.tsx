import {
  ChevronRight,
  Dices,
  Star,
  Sword,
  Trophy,
} from "lucide-react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";

export const metadata = { title: "Jouer" };

interface GameItem {
  href: string;
  title: string;
  subtitle: string;
  icon: LucideIcon;
  accent: "gold" | "buzz" | "sky";
  available: boolean;
}

const GAMES: GameItem[] = [
  {
    href: "/jouer/jeu-1",
    title: "Quizz 1 / 2",
    subtitle: "10 questions, 3 vies. 10 secondes par question.",
    icon: Dices,
    accent: "gold",
    available: true,
  },
  {
    href: "/jouer/jeu-2",
    title: "Étoile Mystérieuse",
    subtitle: "Trouve la personnalité à partir d'indices progressifs.",
    icon: Star,
    accent: "sky",
    available: false,
  },
  {
    href: "/jouer/face-a-face",
    title: "Face-à-Face",
    subtitle: "Vs bot ou ami, 60 s par joueur, sonnerie quand on bloque.",
    icon: Sword,
    accent: "buzz",
    available: false,
  },
  {
    href: "/jouer/coup-de-maitre",
    title: "Coup de Maître",
    subtitle: "4 célébrités, 45 s. Le finale légendaire.",
    icon: Trophy,
    accent: "gold",
    available: false,
  },
];

export default function JouerPage() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col gap-2">
        <h1 className="font-display text-3xl font-extrabold text-navy sm:text-4xl">
          Choisis ton jeu
        </h1>
        <p className="text-navy/70">
          Quatre épreuves, comme à la télé. Pour l'émission complète, lance le
          parcours depuis l'accueil.
        </p>
      </header>

      <div className="flex flex-col gap-3">
        {GAMES.map((g) => (
          <GameRow key={g.href} game={g} />
        ))}
      </div>
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
          <h2 className="font-display text-xl font-bold text-navy">
            {game.title}
          </h2>
          {!game.available && (
            <span className="rounded-full bg-cream-deep px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-navy/60">
              Bientôt
            </span>
          )}
        </div>
        <p className="text-sm text-navy/70">{game.subtitle}</p>
      </div>
      <ChevronRight
        className="h-6 w-6 text-navy/30 transition-transform group-hover:translate-x-1 group-hover:text-gold-warm"
        aria-hidden="true"
      />
    </Link>
  );
}
