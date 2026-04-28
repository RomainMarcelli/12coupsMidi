"use client";

import { useEffect, useState } from "react";
import { Clock, Lock, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

interface DefiCountdownProps {
  /** Callback déclenché quand on franchit minuit (= nouveau défi). */
  onTick?: () => void;
  /** Variant compact (icône + texte court). */
  compact?: boolean;
  className?: string;
}

/**
 * Affiche le temps restant avant le prochain défi (minuit local).
 *
 * Update toutes les 60 secondes. Quand minuit est franchi, affiche un
 * message d'invitation à recharger et appelle `onTick`.
 *
 * Format : "Prochain défi dans 5h 32m" (ou "Prochain défi dans 32m"
 * si moins d'une heure restante).
 */
export function DefiCountdown({ onTick, compact = false, className }: DefiCountdownProps) {
  const [now, setNow] = useState<Date>(() => new Date());
  const [hasFired, setHasFired] = useState(false);

  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(id);
  }, []);

  // Calcul du temps restant jusqu'à minuit local.
  const tomorrow = new Date(now);
  tomorrow.setHours(24, 0, 0, 0); // = 00:00 le lendemain
  const diffMs = tomorrow.getTime() - now.getTime();

  useEffect(() => {
    if (diffMs <= 0 && !hasFired) {
      setHasFired(true);
      onTick?.();
    }
  }, [diffMs, hasFired, onTick]);

  if (diffMs <= 0) {
    return (
      <p
        className={cn(
          "inline-flex items-center gap-1.5 rounded-full bg-gold/15 px-3 py-1 text-sm font-bold text-gold-warm",
          className,
        )}
      >
        <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
        Le défi du jour est dispo !
      </p>
    );
  }

  const totalMin = Math.floor(diffMs / 60_000);
  const hours = Math.floor(totalMin / 60);
  const minutes = totalMin % 60;
  const label =
    hours > 0
      ? `${hours}h ${String(minutes).padStart(2, "0")}m`
      : `${minutes}m`;

  if (compact) {
    return (
      <p
        className={cn(
          "inline-flex items-center gap-1.5 text-xs font-bold text-foreground/60",
          className,
        )}
      >
        <Lock className="h-3 w-3" aria-hidden="true" />
        Prochain défi dans {label}
      </p>
    );
  }

  return (
    <p
      className={cn(
        "inline-flex items-center gap-2 rounded-full bg-foreground/10 px-3 py-1 text-sm font-bold text-foreground/70",
        className,
      )}
    >
      <Clock className="h-3.5 w-3.5" aria-hidden="true" />
      Prochain défi dans <strong className="text-foreground">{label}</strong>
    </p>
  );
}
