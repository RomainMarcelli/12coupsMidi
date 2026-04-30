"use client";

/**
 * Synthèse vocale (audition) — lit les énoncés de questions à voix haute.
 *
 * - Basée sur Web Speech API (SpeechSynthesis), aucun MP3 nécessaire.
 * - Singleton : on ne peut lire qu'un énoncé à la fois.
 * - Respect du mute global (`mm-muted` localStorage) et du store settings :
 *   `ttsVoiceUri`, `ttsRate`, `ttsPitch`, `volume`.
 * - `loadVoices()` gère le cas Chrome où `getVoices()` retourne `[]` au
 *   premier appel jusqu'à `voiceschanged`.
 */

import { useSettingsStore } from "./settings";

type TtsState = "idle" | "speaking" | "paused";

type Listener = (state: TtsState) => void;

const listeners = new Set<Listener>();
let currentState: TtsState = "idle";
let currentUtterance: SpeechSynthesisUtterance | null = null;

function notify(state: TtsState) {
  currentState = state;
  for (const fn of listeners) fn(state);
}

export function isTtsSupported(): boolean {
  return typeof window !== "undefined" && "speechSynthesis" in window;
}

/**
 * Récupère la liste des voix de manière fiable, même quand Chrome livre []
 * au premier appel (résolu dès `voiceschanged` ou après timeout 2 s).
 */
export function loadVoices(): Promise<SpeechSynthesisVoice[]> {
  if (!isTtsSupported()) return Promise.resolve([]);
  const synth = window.speechSynthesis;
  return new Promise((resolve) => {
    const initial = synth.getVoices();
    if (initial.length > 0) {
      resolve(initial);
      return;
    }
    const handler = () => {
      synth.removeEventListener("voiceschanged", handler);
      resolve(synth.getVoices());
    };
    synth.addEventListener("voiceschanged", handler);
    // Garde-fou : si l'event ne se déclenche pas, on retente à 2 s.
    window.setTimeout(() => {
      synth.removeEventListener("voiceschanged", handler);
      resolve(synth.getVoices());
    }, 2000);
  });
}

/** Filtre les voix françaises (lang commence par `fr`). */
export function frenchVoices(
  voices: SpeechSynthesisVoice[],
): SpeechSynthesisVoice[] {
  return voices.filter((v) => v.lang.toLowerCase().startsWith("fr"));
}

/** Cherche une voix par voiceURI parmi celles disponibles. */
function pickVoice(
  voices: SpeechSynthesisVoice[],
  voiceUri: string | null,
): SpeechSynthesisVoice | null {
  if (voiceUri) {
    const exact = voices.find((v) => v.voiceURI === voiceUri);
    if (exact) return exact;
  }
  const fr = frenchVoices(voices);
  return (
    fr.find((v) => v.lang === "fr-FR") ?? fr[0] ?? voices[0] ?? null
  );
}

export function ttsGetState(): TtsState {
  return currentState;
}

export function ttsSubscribe(fn: Listener): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function isMuted(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("mm-muted") === "1";
}

interface SpeakOptions {
  /** Override la voix (sinon lit du store settings). */
  voiceUri?: string | null;
  /** Override la vitesse (sinon lit du store settings). */
  rate?: number;
  /** Override la hauteur (sinon lit du store settings). */
  pitch?: number;
  /** Override le volume 0..1 (sinon lit du store settings). */
  volume?: number;
}

/**
 * Lit un texte à voix haute en français. Stoppe toute lecture en cours.
 * Si TTS n'est pas supporté ou si le son est mute, ne fait rien.
 *
 * Les paramètres voix/rate/pitch/volume sont lus depuis le store settings
 * sauf si overridés dans `opts` (utile pour le bouton "Tester" en live).
 */
export async function ttsSpeak(
  text: string,
  opts: SpeakOptions = {},
): Promise<void> {
  if (!isTtsSupported() || isMuted()) return;
  const synth = window.speechSynthesis;
  synth.cancel();
  currentUtterance = null;
  notify("idle");

  const cleaned = text.replace(/\s+/g, " ").trim();
  if (!cleaned) return;

  const settings = useSettingsStore.getState().settings;
  const voiceUri = opts.voiceUri !== undefined ? opts.voiceUri : settings.ttsVoiceUri;
  const rate = opts.rate ?? settings.ttsRate;
  const pitch = opts.pitch ?? settings.ttsPitch;
  const volume = opts.volume ?? settings.volume;

  const voices = await loadVoices();
  const voice = pickVoice(voices, voiceUri);

  const utterance = new SpeechSynthesisUtterance(cleaned);
  utterance.lang = voice?.lang ?? "fr-FR";
  if (voice) utterance.voice = voice;
  utterance.rate = rate;
  utterance.pitch = pitch;
  utterance.volume = volume;
  utterance.onstart = () => notify("speaking");
  utterance.onend = () => notify("idle");
  utterance.onerror = () => notify("idle");

  currentUtterance = utterance;
  synth.speak(utterance);
}

/** Met la lecture en cours en pause (si elle est en cours). */
export function ttsPause(): void {
  if (!isTtsSupported()) return;
  if (currentState !== "speaking") return;
  window.speechSynthesis.pause();
  notify("paused");
}

/** Reprend la lecture mise en pause. */
export function ttsResume(): void {
  if (!isTtsSupported()) return;
  if (currentState !== "paused") return;
  window.speechSynthesis.resume();
  notify("speaking");
}

/** Stoppe complètement la lecture. */
export function ttsStop(): void {
  if (!isTtsSupported()) return;
  window.speechSynthesis.cancel();
  currentUtterance = null;
  notify("idle");
}
