"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "@/lib/utils";

interface TimerProps {
  /** Durée totale en secondes. */
  duration: number;
  /** Callback quand le timer atteint 0. */
  onEnd: () => void;
  /** Pause le timer sans reset. */
  paused?: boolean;
  /** Taille du cercle en pixels (par défaut 96). */
  size?: number;
  /** Épaisseur du trait en pixels (par défaut 8). */
  strokeWidth?: number;
  /** Seuil (secondes) à partir duquel le timer passe en rouge + scale. */
  dangerAt?: number;
  className?: string;
}

/**
 * Cercle SVG qui se vide (stroke-dashoffset). Couleur or, passe au rouge buzz
 * à `dangerAt` secondes (par défaut 3s) avec une pulse subtile.
 *
 * Appelle `onEnd` une seule fois au passage à 0.
 */
export function Timer({
  duration,
  onEnd,
  paused = false,
  size = 96,
  strokeWidth = 8,
  dangerAt = 3,
  className,
}: TimerProps) {
  const [remaining, setRemaining] = useState(duration);
  const lastTickRef = useRef<number | null>(null);
  const rafRef = useRef<number | null>(null);
  const endedRef = useRef(false);
  const onEndRef = useRef(onEnd);
  onEndRef.current = onEnd;

  // Reset si la durée change (changement de question p.ex.)
  useEffect(() => {
    setRemaining(duration);
    endedRef.current = false;
    lastTickRef.current = null;
  }, [duration]);

  useEffect(() => {
    if (paused || endedRef.current) {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
      lastTickRef.current = null;
      return;
    }

    const tick = (now: number) => {
      if (lastTickRef.current === null) lastTickRef.current = now;
      const deltaSec = (now - lastTickRef.current) / 1000;
      lastTickRef.current = now;

      setRemaining((prev) => {
        const next = Math.max(0, prev - deltaSec);
        if (next === 0 && !endedRef.current) {
          endedRef.current = true;
          onEndRef.current();
        }
        return next;
      });

      if (!endedRef.current) {
        rafRef.current = requestAnimationFrame(tick);
      }
    };

    rafRef.current = requestAnimationFrame(tick);
    return () => {
      if (rafRef.current !== null) cancelAnimationFrame(rafRef.current);
    };
  }, [paused]);

  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const progress = duration > 0 ? remaining / duration : 0;
  const dashOffset = circumference * (1 - progress);
  const isDanger = remaining <= dangerAt && remaining > 0;
  const display = Math.ceil(remaining);

  return (
    <div
      className={cn(
        "relative flex items-center justify-center transition-transform",
        isDanger && "animate-pulse scale-110",
        className,
      )}
      style={{ width: size, height: size }}
      role="timer"
      aria-label={`${display} secondes restantes`}
    >
      <svg
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
        className="-rotate-90"
      >
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          stroke="rgba(255,255,255,0.12)"
          fill="none"
        />
        <circle
          cx={size / 2}
          cy={size / 2}
          r={radius}
          strokeWidth={strokeWidth}
          stroke={isDanger ? "var(--color-buzz)" : "var(--color-gold)"}
          fill="none"
          strokeDasharray={circumference}
          strokeDashoffset={dashOffset}
          strokeLinecap="round"
          style={{ transition: "stroke 0.3s ease" }}
        />
      </svg>
      <span
        className={cn(
          "absolute font-display text-2xl font-bold tabular-nums",
          isDanger ? "text-buzz" : "text-gold",
        )}
      >
        {display}
      </span>
    </div>
  );
}
