"use client";

import { useCallback, useEffect, useRef, useState } from "react";

// -----------------------------------------------------------------------------
// Types minimaux pour Web Speech API (non inclus dans lib.dom par défaut)
// -----------------------------------------------------------------------------

interface SpeechRecognitionAlternative {
  transcript: string;
  confidence: number;
}
interface SpeechRecognitionResult {
  readonly isFinal: boolean;
  readonly length: number;
  [index: number]: SpeechRecognitionAlternative;
  item(index: number): SpeechRecognitionAlternative;
}
interface SpeechRecognitionResultList {
  readonly length: number;
  [index: number]: SpeechRecognitionResult;
  item(index: number): SpeechRecognitionResult;
}
interface SpeechRecognitionEvent extends Event {
  readonly resultIndex: number;
  readonly results: SpeechRecognitionResultList;
}
interface SpeechRecognitionErrorEvent extends Event {
  readonly error: string;
  readonly message: string;
}
interface SpeechRecognitionInstance extends EventTarget {
  lang: string;
  continuous: boolean;
  interimResults: boolean;
  maxAlternatives: number;
  onresult: ((e: SpeechRecognitionEvent) => void) | null;
  onerror: ((e: SpeechRecognitionErrorEvent) => void) | null;
  onend: ((e: Event) => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}
interface SpeechRecognitionCtor {
  new (): SpeechRecognitionInstance;
}

declare global {
  interface Window {
    SpeechRecognition?: SpeechRecognitionCtor;
    webkitSpeechRecognition?: SpeechRecognitionCtor;
  }
}

// -----------------------------------------------------------------------------
// Hook
// -----------------------------------------------------------------------------

export interface UseSpeechRecognitionReturn {
  transcript: string;
  listening: boolean;
  supported: boolean;
  error: string | null;
  /**
   * Démarre l'écoute. Optionnellement :
   *  - `silenceMs` : durée d'inactivité avant arrêt auto (défaut 800 ms).
   *  - `onAutoStop(transcript)` : callback déclenché à l'arrêt auto avec
   *    le dernier transcript stabilisé. Utile pour soumettre la réponse
   *    immédiatement sans attendre l'arrêt natif (~3 s) de Chrome.
   */
  start: (opts?: {
    silenceMs?: number;
    onAutoStop?: (finalTranscript: string) => void;
  }) => void;
  stop: () => void;
  reset: () => void;
}

/**
 * Reconnaissance vocale FR via Web Speech API.
 * - Continuous = false : s'arrête après un court silence.
 * - Interim = true : affiche le texte en cours de reconnaissance.
 * - Fallback gracieux : `supported=false` si le navigateur ne supporte pas
 *   (Firefox desktop < 135, Safari < 14.1).
 */
export function useSpeechRecognition(): UseSpeechRecognitionReturn {
  const [transcript, setTranscript] = useState("");
  const [listening, setListening] = useState(false);
  const [supported, setSupported] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const transcriptRef = useRef("");
  const silenceTimerRef = useRef<number | null>(null);
  const silenceMsRef = useRef<number>(800);
  const autoStopFiredRef = useRef(false);
  const onAutoStopRef = useRef<((t: string) => void) | null>(null);

  function clearSilenceTimer() {
    if (silenceTimerRef.current !== null) {
      window.clearTimeout(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
  }

  function scheduleSilenceTimer() {
    clearSilenceTimer();
    silenceTimerRef.current = window.setTimeout(() => {
      const cb = onAutoStopRef.current;
      const rec = recognitionRef.current;
      if (autoStopFiredRef.current) return;
      autoStopFiredRef.current = true;
      try {
        rec?.stop();
      } catch {
        // ignore
      }
      setListening(false);
      if (cb) cb(transcriptRef.current);
    }, silenceMsRef.current);
  }

  useEffect(() => {
    if (typeof window === "undefined") return;
    const Ctor = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    if (!Ctor) {
      setSupported(false);
      return;
    }
    setSupported(true);

    const rec = new Ctor();
    rec.lang = "fr-FR";
    rec.continuous = false;
    rec.interimResults = true;
    rec.maxAlternatives = 1;

    rec.onresult = (event) => {
      let text = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        const alternative = result?.[0];
        if (alternative) text += alternative.transcript;
      }
      const next = text.trim();
      transcriptRef.current = next;
      setTranscript(next);
      // Reset le timer de silence à chaque update
      if (next.length > 0) scheduleSilenceTimer();
    };
    rec.onerror = (e) => {
      setError(e.error);
      setListening(false);
      clearSilenceTimer();
    };
    rec.onend = () => {
      setListening(false);
      clearSilenceTimer();
      // Si pas déjà déclenché par silence, fire autoStop quand même (utile en
      // cas d'arrêt par le navigateur après ~3 s sans rien)
      if (!autoStopFiredRef.current && onAutoStopRef.current) {
        autoStopFiredRef.current = true;
        onAutoStopRef.current(transcriptRef.current);
      }
    };

    recognitionRef.current = rec;
    return () => {
      clearSilenceTimer();
      try {
        rec.abort();
      } catch {
        // ignore
      }
    };
  }, []);

  const start = useCallback(
    (opts?: {
      silenceMs?: number;
      onAutoStop?: (t: string) => void;
    }) => {
      const rec = recognitionRef.current;
      if (!rec) return;
      setError(null);
      setTranscript("");
      transcriptRef.current = "";
      autoStopFiredRef.current = false;
      silenceMsRef.current = opts?.silenceMs ?? 800;
      onAutoStopRef.current = opts?.onAutoStop ?? null;
      try {
        rec.start();
        setListening(true);
      } catch (e) {
        setError(e instanceof Error ? e.message : "start error");
      }
    },
    [],
  );

  const stop = useCallback(() => {
    const rec = recognitionRef.current;
    clearSilenceTimer();
    if (!rec) return;
    try {
      rec.stop();
    } catch {
      // ignore
    }
    setListening(false);
  }, []);

  const reset = useCallback(() => {
    setTranscript("");
    setError(null);
    transcriptRef.current = "";
  }, []);

  return { transcript, listening, supported, error, start, stop, reset };
}
