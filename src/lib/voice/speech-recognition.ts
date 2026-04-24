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
  start: () => void;
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
      setTranscript(text.trim());
    };
    rec.onerror = (e) => {
      setError(e.error);
      setListening(false);
    };
    rec.onend = () => {
      setListening(false);
    };

    recognitionRef.current = rec;
    return () => {
      try {
        rec.abort();
      } catch {
        // ignore
      }
    };
  }, []);

  const start = useCallback(() => {
    const rec = recognitionRef.current;
    if (!rec) return;
    setError(null);
    setTranscript("");
    try {
      rec.start();
      setListening(true);
    } catch (e) {
      // start() peut lever si déjà en cours — on ignore.
      setError(e instanceof Error ? e.message : "start error");
    }
  }, []);

  const stop = useCallback(() => {
    const rec = recognitionRef.current;
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
  }, []);

  return { transcript, listening, supported, error, start, stop, reset };
}
