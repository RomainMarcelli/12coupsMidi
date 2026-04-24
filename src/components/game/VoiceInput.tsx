"use client";

import { useEffect, useState } from "react";
import { Mic, MicOff, Send } from "lucide-react";
import { cn } from "@/lib/utils";
import { useSpeechRecognition } from "@/lib/voice/speech-recognition";

interface VoiceInputProps {
  onSubmit: (value: string) => void;
  placeholder?: string;
  disabled?: boolean;
  /** Si true, on vide le champ après chaque submit (pour rejouer). */
  clearOnSubmit?: boolean;
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
}: VoiceInputProps) {
  const { transcript, listening, supported, error, start, stop, reset } =
    useSpeechRecognition();
  const [text, setText] = useState("");

  // Quand la reco vocale livre un résultat, on recopie dans le champ texte
  // pour que l'utilisateur puisse le corriger avant de valider.
  useEffect(() => {
    if (transcript) setText(transcript);
  }, [transcript]);

  function submit() {
    const value = text.trim();
    if (!value || disabled) return;
    onSubmit(value);
    if (clearOnSubmit) {
      setText("");
      reset();
    }
  }

  function toggleMic() {
    if (!supported || disabled) return;
    if (listening) stop();
    else start();
  }

  function onKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      submit();
    }
  }

  return (
    <div className="flex w-full flex-col gap-3">
      {/* Bouton micro + transcript live */}
      <div className="flex flex-col items-center gap-2">
        <button
          type="button"
          onClick={toggleMic}
          disabled={disabled || !supported}
          title={
            supported
              ? listening
                ? "Stop"
                : "Parler"
              : "Reconnaissance vocale non supportée"
          }
          className={cn(
            "relative flex h-20 w-20 items-center justify-center rounded-full border-2 transition-all",
            listening
              ? "border-buzz bg-buzz/10 text-buzz animate-pulse"
              : "border-gold bg-white text-gold-warm hover:bg-gold/10 hover:scale-105",
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

        {listening && (
          <p className="text-sm text-navy/60">
            {transcript || "Parle clairement en français…"}
          </p>
        )}
        {!supported && (
          <p className="text-xs text-navy/50">
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

      {/* Input texte + bouton Valider */}
      <div className="flex items-stretch gap-2">
        <input
          type="text"
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={onKeyDown}
          placeholder={placeholder}
          disabled={disabled}
          autoComplete="off"
          autoCapitalize="off"
          spellCheck={false}
          className="h-11 flex-1 rounded-md border border-border bg-white px-3 text-base text-navy placeholder-navy/40 focus:border-gold focus:outline-none disabled:opacity-50"
        />
        <button
          type="button"
          onClick={submit}
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
