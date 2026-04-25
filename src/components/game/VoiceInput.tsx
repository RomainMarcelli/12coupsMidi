"use client";

import { useEffect, useRef, useState } from "react";
import { Check, Mic, MicOff, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSetting } from "@/lib/settings";
import { useSpeechRecognition } from "@/lib/voice/speech-recognition";

interface VoiceInputProps {
  onSubmit: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Si true, on vide le champ après chaque submit (pour rejouer). */
  clearOnSubmit?: boolean;
  /** Cache le bouton micro (mode clavier only). */
  hideVoice?: boolean;
  /** Focus l'input texte dès le montage et quand cette clé change. */
  focusKey?: string | number;
  /**
   * Délai (ms) d'inactivité vocale avant auto-submit. Défaut 800 ms : on
   * arrête dès que l'utilisateur fait une vraie pause. Mettre plus haut
   * en mode "réflexion" (e.g. 1500).
   */
  silenceMs?: number;
}

/**
 * Input hybride voix + clavier.
 * - Gros bouton micro avec pulse quand il écoute
 * - Affichage du transcript en cours
 * - Input texte fallback (toujours visible)
 * - Valider via bouton ou Entrée
 * - Si la reco vocale n'est pas supportée, le bouton mic est affiché avec
 *   un badge "non supporté".
 */
export function VoiceInput({
  onSubmit,
  placeholder = "Ta réponse…",
  disabled,
  clearOnSubmit = true,
  hideVoice = false,
  focusKey,
  silenceMs = 800,
}: VoiceInputProps) {
  const { transcript, listening, supported, error, start, stop, reset } =
    useSpeechRecognition();
  const voiceEnabledSetting = useSetting("voiceRecognition");
  const [text, setText] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);
  const onSubmitRef = useRef(onSubmit);
  onSubmitRef.current = onSubmit;

  // Quand la reco vocale livre un résultat, on recopie dans le champ texte
  // pour que l'utilisateur puisse le corriger avant de valider.
  useEffect(() => {
    if (transcript) setText(transcript);
  }, [transcript]);

  // Focus auto de l'input texte
  useEffect(() => {
    if (disabled) return;
    const el = inputRef.current;
    if (!el) return;
    const id = window.setTimeout(() => el.focus(), 50);
    return () => window.clearTimeout(id);
  }, [focusKey, disabled]);

  function submit(forced?: string) {
    const value = (forced ?? text).trim();
    if (!value || disabled) return;
    onSubmitRef.current(value);
    if (clearOnSubmit) {
      setText("");
      reset();
    }
  }

  function startListening() {
    if (!supported || disabled) return;
    setText("");
    start({
      silenceMs,
      onAutoStop: (finalTranscript) => {
        const cleaned = finalTranscript.trim();
        if (!cleaned) return;
        // Soumet directement le transcript final dès que la voix est stable —
        // évite d'attendre l'arrêt natif (~3 s) du moteur vocal Chrome.
        onSubmitRef.current(cleaned);
        if (clearOnSubmit) {
          setText("");
          reset();
        }
      },
    });
  }

  function toggleMic() {
    if (!supported || disabled) return;
    if (listening) {
      // L'utilisateur clique stop → on prend ce qu'on a et on soumet
      stop();
      submit();
    } else {
      startListening();
    }
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
    }
  }

  const showVoice = !hideVoice && voiceEnabledSetting !== false;

  return (
    <div className="flex w-full flex-col gap-3">
      {/* Bouton micro + transcript live */}
      {showVoice && (
        <div className="flex flex-col items-center gap-2">
          <button
            type="button"
            onClick={toggleMic}
            disabled={disabled || !supported}
            title={
              supported
                ? listening
                  ? "Stop & valider"
                  : "Parler"
                : "Reconnaissance vocale non supportée"
            }
            className={cn(
              "relative flex h-20 w-20 items-center justify-center rounded-full border-2 transition-all",
              listening
                ? "border-buzz bg-buzz/10 text-buzz animate-pulse"
                : "border-gold bg-card text-gold-warm hover:bg-gold/10 hover:scale-105",
              (!supported || disabled) && "cursor-not-allowed opacity-50",
            )}
          >
            {listening ? (
              <MicOff className="h-9 w-9" aria-hidden="true" />
            ) : (
              <Mic className="h-9 w-9" aria-hidden="true" />
            )}
            {listening && (
              <span className="absolute inset-0 rounded-full border-2 border-buzz/40 animate-ping" />
            )}
          </button>

          {/* Bouton "Valider maintenant" très visible pendant l'écoute */}
          {listening && (
            <button
              type="button"
              onClick={() => {
                stop();
                submit();
              }}
              className="inline-flex items-center gap-1.5 rounded-full bg-life-green px-4 py-2 text-sm font-bold text-white shadow-[0_4px_0_0_#27ae60] hover:-translate-y-px hover:shadow-[0_6px_16px_rgba(46,204,113,0.45)]"
            >
              <Check className="h-4 w-4" aria-hidden="true" />
              Valider maintenant
            </button>
          )}

          {listening && (
            <p className="min-h-[1.25rem] text-sm text-foreground/70">
              {transcript || "Parle clairement en français…"}
            </p>
          )}
          {!supported && (
            <p className="text-xs text-foreground/50">
              Micro non supporté par ce navigateur — tape ta réponse.
            </p>
          )}
          {error && !listening && (
            <p className="text-xs text-buzz" role="alert">
              {error === "not-allowed"
                ? "Autorise l'accès au micro dans ton navigateur."
                : `Erreur micro : ${error}`}
            </p>
          )}
        </div>
      )}

      {/* Input texte + bouton Valider */}
      <div className="flex items-stretch gap-2">
        <input
          ref={inputRef}
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          className="h-11 flex-1 rounded-md border border-border bg-card px-3 text-base text-foreground placeholder-foreground/40 focus:border-gold focus:outline-none disabled:opacity-50"
        />
        <button
          type="button"
          onClick={() => submit()}
          disabled={disabled || text.trim() === ""}
          className="flex h-11 items-center gap-1.5 rounded-md bg-gold px-4 font-bold text-navy shadow-[0_4px_0_0_#e89e00] transition-all hover:-translate-y-px hover:shadow-[0_6px_16px_rgba(245,183,0,0.45)] active:translate-y-px active:shadow-[0_2px_0_0_#e89e00] disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Send className="h-4 w-4" aria-hidden="true" />
          Valider
        </button>
      </div>
    </div>
  );
}
