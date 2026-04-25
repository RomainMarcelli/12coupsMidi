"use client";

import { useEffect, useState } from "react";
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
  /** Texte à lire. */
  text: string;
  /**
   * Force l'activation/désactivation. Si non fourni, on s'aligne sur le
   * setting global "Mode TV" (ttsAutoPlay) pour l'autoPlay, mais le bouton
   * reste cliquable tant que TTS est supporté.
   */
  enabled?: boolean;
  /**
   * Lit auto le `text` au montage / quand le texte change.
   * Si non fourni, on s'aligne sur le setting global `ttsAutoPlay`.
   */
  autoPlay?: boolean;
  className?: string;
}

/**
 * Bouton haut-parleur : lit / pause / reprend la lecture du texte.
 * Le bouton reste affiché même si le Mode TV est off — l'utilisateur peut
 * toujours cliquer pour entendre la question. Caché uniquement si le
 * navigateur ne supporte pas Web Speech API ou si `enabled === false`.
 */
export function SpeakerButton({
  text,
  enabled,
  autoPlay,
  className,
}: SpeakerButtonProps) {
  const ttsAutoSetting = useSetting("ttsAutoPlay");
  const [state, setState] = useState(ttsGetState());

  const effectiveEnabled = enabled ?? true;
  const effectiveAutoPlay = autoPlay ?? ttsAutoSetting;

  useEffect(() => {
    return ttsSubscribe(setState);
  }, []);

  // Auto-play à chaque changement de texte (Mode TV)
  useEffect(() => {
    if (!effectiveEnabled || !effectiveAutoPlay) return;
    if (!text) return;
    ttsSpeak(text);
    return () => {
      ttsStop();
    };
  }, [effectiveEnabled, effectiveAutoPlay, text]);

  if (!effectiveEnabled || !isTtsSupported()) return null;

  function onClick() {
    if (state === "speaking") {
      ttsPause();
    } else if (state === "paused") {
      ttsResume();
    } else {
      ttsSpeak(text);
    }
  }

  const label =
    state === "speaking"
      ? "Mettre en pause"
      : state === "paused"
        ? "Reprendre"
        : "Écouter la question";

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
