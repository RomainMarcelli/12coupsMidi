"use client";

import { motion, type HTMLMotionProps } from "framer-motion";
import { forwardRef } from "react";
import { cn } from "@/lib/utils";

export type AnswerState = "idle" | "correct" | "wrong";

interface AnswerButtonProps extends HTMLMotionProps<"button"> {
  state?: AnswerState;
  /** Clavier — affiche une pastille (ex: "A", "B", "←"). */
  keyHint?: string;
  children: React.ReactNode;
}

const STATE_CLASSES: Record<AnswerState, string> = {
  idle:
    "border-border bg-card text-navy hover:border-gold hover:bg-gold/10 hover:scale-[1.01] shadow-[0_2px_0_0_rgba(11,31,77,0.08)]",
  correct:
    "border-life-green bg-life-green/15 text-life-green shadow-[0_0_24px_rgba(46,204,113,0.45),inset_0_0_0_1px_rgba(46,204,113,0.4)]",
  wrong:
    "border-buzz bg-buzz/15 text-buzz shadow-[0_0_24px_rgba(230,57,70,0.4)]",
};

/**
 * Bouton de réponse (Quizz 1/2, Quizz 1/4, Étoile mode simple).
 * 3 états visuels via prop `state`.
 * - idle   : prêt à cliquer, hover or
 * - correct: vert glow
 * - wrong  : rouge + shake (animation)
 */
export const AnswerButton = forwardRef<HTMLButtonElement, AnswerButtonProps>(
  function AnswerButton(
    { state = "idle", keyHint, className, children, disabled, ...props },
    ref,
  ) {
    return (
      <motion.button
        ref={ref}
        type="button"
        disabled={disabled}
        animate={state === "wrong" ? { x: [0, -8, 8, -4, 4, 0] } : { x: 0 }}
        transition={{ duration: 0.35, ease: "easeInOut" }}
        className={cn(
          "group/answer relative flex min-h-[72px] w-full items-center justify-center rounded-xl border-2 px-5 py-4 text-left text-lg font-semibold transition-all outline-none focus-visible:ring-2 focus-visible:ring-gold disabled:cursor-not-allowed disabled:opacity-60",
          STATE_CLASSES[state],
          className,
        )}
        {...props}
      >
        {keyHint && (
          <kbd
            className={cn(
              "absolute left-3 top-1/2 -translate-y-1/2 flex h-8 w-8 items-center justify-center rounded-md border border-border bg-cream-deep/80 font-mono text-sm text-navy transition-colors",
              state === "idle" && "group-hover/answer:border-gold group-hover/answer:bg-gold/20",
            )}
            aria-hidden="true"
          >
            {keyHint}
          </kbd>
        )}
        <span className={cn("flex-1 text-center", keyHint && "pl-8")}>
          {children}
        </span>
      </motion.button>
    );
  },
);
