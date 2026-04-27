"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Volume2 } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSetting } from "@/lib/settings";
import {
  isTtsSupported,
  ttsGetState,
  ttsPause,
  ttsResume,
  ttsSpeak,
  ttsStop,
  ttsSubscribe,
} from "@/lib/tts";

interface SpeakerButtonProps {
  /** Texte principal à lire (l'énoncé). */
  text: string;
  /**
   * Choix de réponses optionnels — lus à la suite de la question avec
   * un séparateur " ou " entre chaque (formats quizz_2 typiquement).
   * Si non fourni, seul `text` est lu.
   */
  choices?: string[];
  /**
   * Explication optionnelle à lire en plus (mode "feedback" après réponse).
   * Par défaut, pas lue. Quand fournie, elle vient s'ajouter à la fin.
   */
  explanation?: string | null;
  /**
   * Force l'activation/désactivation. Si non fourni, on s'aligne sur le
   * setting global "Mode TV" (ttsAutoPlay) pour l'autoPlay, mais le bouton
   * reste cliquable tant que TTS est supporté.
   */
  enabled?: boolean;
  /**
   * Lit auto le `text` au montage / quand le texte change.
   * Si non fourni, on s'aligne sur le setting global `ttsAutoPlay`.
   *
   * Dédup intégrée : un même contenu n'est lu auto qu'UNE fois par
   * cycle de vie du composant. Si la question reste affichée et que
   * d'autres états changent (feedback, etc.), pas de relecture.
   */
  autoPlay?: boolean;
  className?: string;
}

/** Construit le texte complet à lire en concaténant question + choix + explication. */
function buildSpeechText(
  text: string,
  choices?: string[],
  explanation?: string | null,
): string {
  const parts: string[] = [text];
  if (choices && choices.length > 0) {
    // Filtre les labels vides puis joint avec " ou " (séparateur naturel
    // pour les formats binaires "L'un ou l'autre"). Pour les quizz_4 ça
    // reste lisible aussi : "Paris ou Lyon ou Marseille ou Nantes".
    const cleaned = choices.map((c) => c.trim()).filter(Boolean);
    if (cleaned.length > 0) {
      parts.push(cleaned.join(" ou "));
    }
  }
  if (explanation && explanation.trim()) {
    parts.push(explanation.trim());
  }
  return parts.join(". ");
}

/**
 * Bouton haut-parleur : lit / pause / reprend la lecture.
 *
 * Lit dans l'ordre : énoncé → choix joints par " ou " → explication.
 * Le bouton reste cliquable pour relire à la demande même quand l'auto-play
 * a déjà eu lieu, mais ne re-déclenche PAS automatiquement une lecture si
 * le contenu n'a pas changé (anti-spam quand le composant re-render).
 */
export function SpeakerButton({
  text,
  choices,
  explanation,
  enabled,
  autoPlay,
  className,
}: SpeakerButtonProps) {
  const ttsAutoSetting = useSetting("ttsAutoPlay");
  const [state, setState] = useState(ttsGetState());

  const effectiveEnabled = enabled ?? true;
  const effectiveAutoPlay = autoPlay ?? ttsAutoSetting;

  const fullText = buildSpeechText(text, choices, explanation);
  // On dédupe l'auto-play sur la base du texte de la question seule : un
  // changement de feedback (qui ajoute l'explication) ne doit PAS relancer
  // une lecture auto. C'est volontaire — c'est à l'user de cliquer pour
  // entendre l'explication s'il le souhaite.
  const autoplayKey = text;
  const lastAutoPlayedRef = useRef<string | null>(null);

  useEffect(() => {
    return ttsSubscribe(setState);
  }, []);

  useEffect(() => {
    if (!effectiveEnabled || !effectiveAutoPlay) return;
    if (!autoplayKey) return;
    // Dédup : pas de relecture pour la même question.
    if (lastAutoPlayedRef.current === autoplayKey) return;
    lastAutoPlayedRef.current = autoplayKey;
    // Pour l'auto-play, on lit énoncé + choix (mais PAS l'explication —
    // elle n'a pas encore de raison d'être révélée à l'auto-play initial).
    ttsSpeak(buildSpeechText(text, choices, null));
    return () => {
      ttsStop();
    };
  }, [effectiveEnabled, effectiveAutoPlay, autoplayKey, text, choices]);

  if (!effectiveEnabled || !isTtsSupported()) return null;

  function onClick() {
    if (state === "speaking") {
      ttsPause();
    } else if (state === "paused") {
      ttsResume();
    } else {
      // Au clic manuel, on lit TOUT le contenu disponible (énoncé +
      // choix + explication si présente). C'est l'utilisateur qui choisit
      // d'entendre l'explication en re-cliquant.
      ttsSpeak(fullText);
    }
  }

  const label =
    state === "speaking"
      ? "Mettre en pause"
      : state === "paused"
        ? "Reprendre"
        : "Écouter";

  return (
    <button
      type="button"
      onClick={onClick}
      title={label}
      aria-label={label}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors",
        state === "speaking"
          ? "border-buzz/40 bg-buzz/10 text-buzz"
          : "border-sky/40 bg-sky/10 text-sky hover:border-sky hover:bg-sky/20",
        className,
      )}
    >
      {state === "speaking" ? (
        <Pause className="h-3.5 w-3.5" aria-hidden="true" />
      ) : (
        <Volume2 className="h-3.5 w-3.5" aria-hidden="true" />
      )}
      {state === "speaking"
        ? "Pause"
        : state === "paused"
          ? "Reprendre"
          : "Écouter"}
    </button>
  );
}
