"use client";

import { useEffect, useState } from "react";
import { AlertTriangle, Siren } from "lucide-react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { playSound } from "@/lib/sounds";
import { cn } from "@/lib/utils";

type TransitionTo = "yellow" | "red";

interface ColorTransitionOverlayProps {
  /** Couleur cible. Détermine l'esthétique (gradient, intensité, son). */
  to: TransitionTo;
  /** Pseudo du joueur concerné, affiché dans le sous-titre. */
  playerName: string;
  /**
   * Callback déclenché à la fin de l'animation (auto-fermeture).
   * 2000 ms par défaut, 500 ms en mode reduced-motion.
   */
  onComplete: () => void;
  /** Désactive le shake (déjà inactif si prefers-reduced-motion). */
  disableShake?: boolean;
}

/**
 * Overlay plein écran spectaculaire pour matérialiser le passage d'un
 * joueur au jaune (1re erreur) ou au rouge (2e erreur, déclenche le duel).
 *
 * Polish (Bug #6 du plan post-tests) :
 *   - JAUNE : pluie de particules dorées, halo pulsant, 1 secousse,
 *     bordure jaune épaisse, icône AlertTriangle qui scale+rotate, son
 *     "yellow-warn" (bip bi-tons).
 *   - ROUGE : sirène rotative dans 2 coins, 5 flashs strobe rouge,
 *     3 secousses marquées, particules rouges qui jaillissent du
 *     centre, glow rouge intense sur le texte, son "red-alert"
 *     (sirène 2 tons descendante, 2 cycles).
 *
 * Bloque les interactions le temps de l'animation. Respecte
 * `prefers-reduced-motion` : version dégradée 500 ms sans particules
 * ni shake ni strobe, le son est conservé (pas dérangeant).
 */
export function ColorTransitionOverlay({
  to,
  playerName,
  onComplete,
  disableShake = false,
}: ColorTransitionOverlayProps) {
  const reducedMotion = useReducedMotion();
  const [visible, setVisible] = useState(true);

  const duration = reducedMotion ? 500 : 2000;
  const isRed = to === "red";

  useEffect(() => {
    // Joue le son d'alerte au début de l'overlay
    playSound(isRed ? "red-alert" : "yellow-warn");
    const t = window.setTimeout(() => setVisible(false), duration);
    return () => window.clearTimeout(t);
  }, [duration, isRed]);

  function handleExitComplete() {
    onComplete();
  }

  // Couleurs (palette projet)
  const gradient = isRed
    ? "linear-gradient(135deg, rgba(230,57,70,0.94) 0%, rgba(192,57,43,0.94) 100%)"
    : "linear-gradient(135deg, rgba(245,197,24,0.88) 0%, rgba(255,178,0,0.88) 100%)";

  const shakeKeyframes =
    reducedMotion || disableShake
      ? undefined
      : isRed
        ? { x: [0, -16, 16, -12, 12, -8, 8, 0] }
        : { x: [0, -8, 8, 0] };

  const particleCount = isRed ? 18 : 12;

  return (
    <AnimatePresence onExitComplete={handleExitComplete}>
      {visible && (
        <motion.div
          className="pointer-events-auto fixed inset-0 z-[100] flex items-center justify-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          transition={{ duration: reducedMotion ? 0.15 : 0.3 }}
          role="alert"
          aria-live="assertive"
        >
          {/* Fond plein écran avec shake */}
          <motion.div
            aria-hidden="true"
            className="absolute inset-0"
            style={{ background: gradient }}
            animate={shakeKeyframes ? shakeKeyframes : undefined}
            transition={{ duration: 0.6, ease: "easeOut" }}
          />

          {/* Bordure pulsante (jaune surtout) */}
          {!reducedMotion && (
            <motion.div
              aria-hidden="true"
              className={cn(
                "absolute inset-2 rounded-3xl border-4",
                isRed ? "border-cream/60" : "border-navy/40",
              )}
              animate={{ opacity: [0.3, 1, 0.3] }}
              transition={{ duration: 0.8, repeat: 2 }}
            />
          )}

          {/* Strobe sur les bords (rouge uniquement, 5 flashs) */}
          {isRed && !reducedMotion && (
            <>
              <motion.div
                aria-hidden="true"
                className="absolute inset-x-0 top-0 h-32 bg-buzz"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0] }}
                transition={{ duration: 1.4, ease: "linear" }}
              />
              <motion.div
                aria-hidden="true"
                className="absolute inset-x-0 bottom-0 h-32 bg-buzz"
                initial={{ opacity: 0 }}
                animate={{ opacity: [0, 1, 0, 1, 0, 1, 0, 1, 0, 1, 0] }}
                transition={{ duration: 1.4, ease: "linear" }}
              />
            </>
          )}

          {/* Sirènes rotatives dans les coins (rouge uniquement) */}
          {isRed && !reducedMotion && (
            <>
              <RotatingSiren className="absolute left-6 top-6" />
              <RotatingSiren
                className="absolute right-6 top-6"
                reverse
              />
              <RotatingSiren className="absolute left-6 bottom-6" reverse />
              <RotatingSiren className="absolute right-6 bottom-6" />
            </>
          )}

          {/* Particules : jaune = pluie depuis le haut, rouge = jaillissent du centre */}
          {!reducedMotion &&
            Array.from({ length: particleCount }).map((_, i) => (
              <ParticleEffect key={i} index={i} total={particleCount} isRed={isRed} />
            ))}

          {/* Contenu central */}
          <motion.div
            className="relative flex flex-col items-center gap-3 px-6 text-center text-cream"
            initial={{ scale: 0.6, opacity: 0 }}
            animate={
              reducedMotion
                ? { scale: 1, opacity: 1 }
                : { scale: [0.6, 1.15, 1], opacity: 1 }
            }
            transition={{
              duration: reducedMotion ? 0.2 : 0.55,
              ease: "easeOut",
            }}
          >
            <motion.div
              animate={
                reducedMotion
                  ? undefined
                  : isRed
                    ? { scale: [1, 1.15, 1], rotate: [0, -8, 8, 0] }
                    : { scale: [1, 1.1, 1], rotate: [0, -6, 6, 0] }
              }
              transition={{ duration: 1.2, repeat: 1 }}
              className={cn(
                "flex h-24 w-24 items-center justify-center rounded-full sm:h-32 sm:w-32",
                isRed
                  ? "bg-cream/15 text-cream shadow-[0_0_120px_rgba(255,255,255,0.5)]"
                  : "bg-navy/20 text-navy shadow-[0_0_80px_rgba(245,197,24,0.7)]",
              )}
            >
              {isRed ? (
                <Siren className="h-12 w-12 sm:h-16 sm:w-16" aria-hidden="true" />
              ) : (
                <AlertTriangle
                  className="h-12 w-12 sm:h-16 sm:w-16"
                  aria-hidden="true"
                />
              )}
            </motion.div>

            <p
              className={cn(
                "font-display text-5xl font-extrabold uppercase tracking-widest sm:text-7xl",
                isRed
                  ? "text-cream drop-shadow-[0_4px_16px_rgba(0,0,0,0.6)]"
                  : "text-navy drop-shadow-[0_2px_8px_rgba(0,0,0,0.2)]",
              )}
            >
              {isRed ? "Rouge" : "Attention"}
            </p>
            <p
              className={cn(
                "font-display text-xl font-bold sm:text-3xl",
                isRed ? "text-cream/95" : "text-navy/85",
              )}
            >
              {playerName}{" "}
              {isRed ? "est en danger !" : "passe au JAUNE"}
            </p>
            {isRed && (
              <p className="text-sm font-semibold uppercase tracking-widest text-cream/85 sm:text-base">
                Préparation du duel…
              </p>
            )}
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

/**
 * Sirène style alerte police : faisceau rouge tournant qui pulse.
 * Cercle central + faisceau conique qui rotate à 360°.
 */
function RotatingSiren({
  className,
  reverse = false,
}: {
  className?: string;
  reverse?: boolean;
}) {
  return (
    <motion.div
      aria-hidden="true"
      className={cn(
        "h-12 w-12 rounded-full bg-buzz shadow-[0_0_32px_rgba(230,57,70,0.9)]",
        className,
      )}
      animate={{
        rotate: reverse ? [0, -360] : [0, 360],
        scale: [0.9, 1.1, 0.9],
      }}
      transition={{ duration: 0.8, repeat: 2, ease: "linear" }}
    >
      {/* Faisceau lumineux (gradient conique simulé via clip-path triangle) */}
      <div
        className="h-full w-full rounded-full"
        style={{
          background:
            "conic-gradient(from 0deg, rgba(255,255,255,0.7) 0deg, transparent 60deg, transparent 360deg)",
        }}
      />
    </motion.div>
  );
}

/**
 * Particule individuelle :
 *  - Jaune : tombe depuis une position aléatoire en haut, rotation
 *    légère. Effet "pluie de confettis or".
 *  - Rouge : jaillit du centre vers une direction radiale, fade out.
 */
function ParticleEffect({
  index,
  total,
  isRed,
}: {
  index: number;
  total: number;
  isRed: boolean;
}) {
  if (isRed) {
    // Jaillit du centre dans une direction radiale
    const angle = (index / total) * Math.PI * 2;
    const distance = 600;
    const tx = Math.cos(angle) * distance;
    const ty = Math.sin(angle) * distance;
    return (
      <motion.span
        aria-hidden="true"
        className="absolute left-1/2 top-1/2 h-2 w-2 rounded-full bg-cream"
        style={{ marginLeft: -4, marginTop: -4 }}
        initial={{ x: 0, y: 0, opacity: 0, scale: 0.5 }}
        animate={{
          x: [0, tx],
          y: [0, ty],
          opacity: [1, 1, 0],
          scale: [0.5, 1.2, 0.8],
        }}
        transition={{ duration: 1.4, ease: "easeOut" }}
      />
    );
  }
  // Jaune : pluie depuis le haut
  const left = (index / total) * 100;
  const delay = (index % 4) * 0.08;
  return (
    <motion.span
      aria-hidden="true"
      className="absolute h-3 w-1.5 rounded-sm bg-navy/70"
      style={{ left: `${left}%`, top: -10 }}
      initial={{ y: 0, opacity: 0, rotate: 0 }}
      animate={{
        y: ["0vh", "110vh"],
        opacity: [0, 1, 1, 0],
        rotate: [0, 180, 360],
      }}
      transition={{ duration: 1.6, delay, ease: "easeIn" }}
    />
  );
}
