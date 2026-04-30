"use client";

import { Sparkles, Check } from "lucide-react";
import { DefiCountdown } from "../defi/_components/DefiCountdown";

/**
 * M4.1 — Badge affiché sur la card "Défi du jour" du hub révision
 * pour donner en un coup d'œil le statut du défi :
 *
 *  - Pas de défi en BDD (cron pas tourné) → rien
 *  - Défi disponible et pas joué    → badge "Disponible !" gold pulse
 *  - Défi joué aujourd'hui          → badge "Joué" + countdown jusqu'à
 *                                     minuit (réutilise DefiCountdown)
 *
 * Le composant est `client` car DefiCountdown calcule l'heure courante
 * et tick toutes les 60 s.
 */
interface DefiAvailabilityBadgeProps {
  defiAvailable: boolean;
  defiPlayedToday: boolean;
}

export function DefiAvailabilityBadge({
  defiAvailable,
  defiPlayedToday,
}: DefiAvailabilityBadgeProps) {
  if (!defiAvailable) return null;

  if (!defiPlayedToday) {
    return (
      <span className="inline-flex animate-pulse items-center gap-1 rounded-full bg-gold/25 px-2.5 py-1 text-[11px] font-extrabold uppercase tracking-wider text-gold-warm shadow-[0_0_12px_rgba(245,183,0,0.35)]">
        <Sparkles className="h-3 w-3" aria-hidden="true" />
        Disponible !
      </span>
    );
  }

  return (
    <div className="flex flex-col items-end gap-1">
      <span className="inline-flex items-center gap-1 rounded-full bg-life-green/15 px-2.5 py-0.5 text-[11px] font-bold uppercase tracking-wider text-life-green">
        <Check className="h-3 w-3" aria-hidden="true" />
        Joué
      </span>
      <DefiCountdown compact />
    </div>
  );
}
