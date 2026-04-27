import { ChevronLeft, Construction } from "lucide-react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";

interface ComingSoonProps {
  title: string;
  subtitle?: string;
  phase?: string;
  icon?: LucideIcon;
}

/**
 * Placeholder pour les routes qui seront développées dans les phases
 * ultérieures. Évite les 404 agressifs sur les liens de la navbar.
 */
export function ComingSoon({
  title,
  subtitle,
  phase,
  icon: Icon = Construction,
}: ComingSoonProps) {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="relative">
        <div className="absolute inset-0 -z-10 rounded-full bg-gold/20 blur-3xl" />
        <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-card shadow-[0_4px_24px_rgba(245,183,0,0.25)]">
          <Icon className="h-12 w-12 text-gold-warm" aria-hidden="true" />
        </div>
      </div>
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-3xl font-extrabold text-foreground sm:text-4xl">
          {title}
        </h1>
        {subtitle && <p className="text-foreground/70 sm:text-lg">{subtitle}</p>}
        {phase && (
          <p className="text-sm font-semibold uppercase tracking-wider text-gold-warm">
            En construction — {phase}
          </p>
        )}
      </div>
      <Link
        href="/"
        className="flex items-center gap-1.5 rounded-md border border-border bg-card px-4 py-2 text-sm font-semibold text-foreground transition-colors hover:border-gold hover:bg-gold/10"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Retour à l'accueil
      </Link>
    </main>
  );
}
