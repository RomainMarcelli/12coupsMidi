"use client";

import { useEffect, useRef } from "react";
import { useSetting } from "@/lib/settings";
import { isTtsSupported, ttsSpeak, ttsStop } from "@/lib/tts";

/**
 * Construit le texte à lire pour une question + ses choix + (optionnel)
 * son explication.
 *
 * Règles :
 *  - Énoncé en premier, suivi d'un point + espace.
 *  - Choix joints par des virgules SAUF entre l'avant-dernier et le
 *    dernier où on met " ou ". Pour 2 choix, juste " ou ".
 *  - Si une explication est fournie, elle vient après les choix séparée
 *    par un point.
 *
 * Exemples :
 *   - 2 choix : "Quel architecte ? Frank Gehry ou Norman Foster"
 *   - 4 choix : "Quel océan ? Atlantique, Pacifique, Indien ou Arctique"
 *   - 7 choix (Jeu 2) : "Trouve l'intrus. A, B, C, D, E, F ou G"
 */
export function buildTTSText(input: {
  enonce: string;
  choices?: ReadonlyArray<string>;
  explanation?: string | null;
}): string {
  const parts: string[] = [];

  const enonce = input.enonce.trim();
  if (enonce) parts.push(enonce);

  if (input.choices && input.choices.length > 0) {
    const cleaned = input.choices.map((c) => c.trim()).filter(Boolean);
    if (cleaned.length === 1) {
      parts.push(cleaned[0]!);
    } else if (cleaned.length === 2) {
      parts.push(`${cleaned[0]} ou ${cleaned[1]}`);
    } else if (cleaned.length > 2) {
      const last = cleaned[cleaned.length - 1];
      const head = cleaned.slice(0, -1).join(", ");
      parts.push(`${head} ou ${last}`);
    }
  }

  if (input.explanation && input.explanation.trim()) {
    parts.push(input.explanation.trim());
  }

  return parts.join(". ");
}

/**
 * Construit le texte à lire pour le **feedback** d'une réponse :
 *  - Bonne : "Bonne réponse. <explication>"
 *  - Mauvaise : "Mauvaise réponse. La bonne réponse était <label>. <explication>"
 *
 * Le label est optionnel — on le saute si générique ou non disponible.
 */
export function buildTTSFeedbackText(input: {
  isCorrect: boolean;
  correctLabel?: string | null;
  explanation?: string | null;
}): string {
  const parts: string[] = [];
  if (input.isCorrect) {
    parts.push("Bonne réponse");
  } else {
    parts.push("Mauvaise réponse");
    if (input.correctLabel && input.correctLabel.trim()) {
      parts.push(`La bonne réponse était ${input.correctLabel.trim()}`);
    }
  }
  if (input.explanation && input.explanation.trim()) {
    parts.push(input.explanation.trim());
  }
  return parts.join(". ");
}

interface UseAutoPlayTTSInput {
  /** Énoncé de la question — clé de déduplication (1 lecture par question). */
  enonce: string;
  /** Choix proposés (lus avec "ou" final). */
  choices?: ReadonlyArray<string>;
  /**
   * Texte du feedback à lire après la réponse. Quand cette valeur change
   * pour devenir non-null/non-vide, une nouvelle lecture est lancée.
   * Quand elle redevient null (passage à la question suivante), la
   * lecture en cours est stoppée pour éviter le chevauchement.
   */
  feedbackText?: string | null;
  /**
   * Désactive complètement le hook (ex: phase non-jeu). Par défaut on
   * s'aligne sur le setting `ttsAutoPlay` (Mode TV).
   */
  enabled?: boolean;
}

/**
 * Hook centralisé pour la lecture auto TTS pendant le jeu.
 *
 * Comportements (cf. Bug #5 du plan post-tests) :
 *  1. Au mount, si `ttsAutoPlay` est ON, lit `énoncé + choix` une fois.
 *  2. Si `enonce` change (nouvelle question) → relit auto.
 *  3. Si `enonce` reste identique mais d'autres props changent → PAS de
 *     relecture.
 *  4. Si `feedbackText` passe d'absent à présent → lit le feedback
 *     (en plus de l'énoncé déjà lu, sans le re-dire).
 *  5. Quand `feedbackText` repasse à null (next question) ou au unmount
 *     → stoppe toute lecture en cours.
 *  6. Si `enabled === false` → aucune lecture.
 *
 * Ce hook **ne contient pas d'UI**. Il agit en arrière-plan. Le composant
 * SpeakerButton reste pour le clic manuel "Écouter".
 */
export function useAutoPlayTTS(input: UseAutoPlayTTSInput): void {
  const ttsAutoSetting = useSetting("ttsAutoPlay");
  const effective = input.enabled ?? ttsAutoSetting;
  const lastEnonceRef = useRef<string | null>(null);
  const lastFeedbackRef = useRef<string | null>(null);

  // Lecture de la question (énoncé + choix) — 1 fois par enonce différent.
  useEffect(() => {
    if (!effective) return;
    if (!isTtsSupported()) return;
    if (!input.enonce) return;
    if (lastEnonceRef.current === input.enonce) return;
    lastEnonceRef.current = input.enonce;
    void ttsSpeak(
      buildTTSText({ enonce: input.enonce, choices: input.choices }),
    );
    // Au unmount du composant qui appelle ce hook, on stop.
    return () => {
      ttsStop();
    };
    // Volontairement on ne réagit pas aux changements de `choices` (la même
    // question avec 4 choix qui re-rendraient ne doit pas relancer de lecture).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [effective, input.enonce]);

  // Lecture du feedback — déclenchée à chaque transition null → texte.
  useEffect(() => {
    if (!effective) return;
    if (!isTtsSupported()) return;
    const fb = input.feedbackText ?? null;
    // Transition feedback absent → présent : on lit
    if (fb && fb !== lastFeedbackRef.current) {
      lastFeedbackRef.current = fb;
      // Petit délai pour laisser le son ding/buzz s'évacuer
      const t = window.setTimeout(() => {
        void ttsSpeak(fb);
      }, 250);
      return () => window.clearTimeout(t);
    }
    // Transition feedback présent → null : on stoppe (la question suivante
    // arrive, on ne veut pas d'overlap audio).
    if (!fb && lastFeedbackRef.current !== null) {
      lastFeedbackRef.current = null;
      ttsStop();
    }
  }, [effective, input.feedbackText]);
}
