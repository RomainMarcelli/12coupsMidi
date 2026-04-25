"use client";

/**
 * Réglages utilisateur — store Zustand global.
 *
 * Source de vérité : la BDD (profiles.settings JSONB) côté serveur.
 * Stratégie :
 *  1. Au montage, on hydrate depuis localStorage (UX instantanée).
 *  2. Le RootLayout passe le snapshot BDD initial via `hydrateFromServer`.
 *  3. Toute mise à jour : optimiste en RAM + localStorage immédiat,
 *     puis push BDD via server action (debounce léger).
 *
 * NB : le thème (light/dark/system) est géré par next-themes (séparé).
 */

import { create } from "zustand";

export interface UserSettings {
  /** Mode TV : lecture automatique de l'énoncé à chaque question. */
  ttsAutoPlay: boolean;
  /** Active la reconnaissance vocale (sinon clavier-only). */
  voiceRecognition: boolean;
  /** Volume des sons synthétisés (0..1). */
  volume: number;
  /** Mute global (sons + TTS). */
  muted: boolean;
  /** Rappel notification quotidien si l'utilisateur n'a pas joué. */
  dailyNotif: boolean;
  /**
   * Identifiant de la voix TTS (SpeechSynthesisVoice.voiceURI).
   * `null` = laisser le navigateur choisir la voix française par défaut.
   */
  ttsVoiceUri: string | null;
  /** Vitesse de lecture TTS (0.5 → 2). 1 = normal. */
  ttsRate: number;
  /** Hauteur (pitch) TTS (0.5 → 2). 1 = normal. */
  ttsPitch: number;
}

export const DEFAULT_SETTINGS: UserSettings = {
  ttsAutoPlay: false,
  voiceRecognition: true,
  volume: 0.5,
  muted: false,
  dailyNotif: false,
  ttsVoiceUri: null,
  ttsRate: 1.0,
  ttsPitch: 1.0,
};

const LS_KEY = "mm-settings-v1";

interface SettingsState {
  settings: UserSettings;
  hydratedFromServer: boolean;
  /** Charge un snapshot venu de la BDD (RootLayout). */
  hydrateFromServer: (s: Partial<UserSettings>) => void;
  /** Mise à jour partielle (optimiste). Côté composant : déclencher saveToServer après. */
  update: (patch: Partial<UserSettings>) => void;
  reset: () => void;
}

function readLocal(): Partial<UserSettings> {
  if (typeof window === "undefined") return {};
  try {
    const raw = localStorage.getItem(LS_KEY);
    if (!raw) return {};
    const obj = JSON.parse(raw);
    return obj && typeof obj === "object" ? (obj as Partial<UserSettings>) : {};
  } catch {
    return {};
  }
}

function writeLocal(s: UserSettings) {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(LS_KEY, JSON.stringify(s));
    // Sync avec les anciens flags utilisés par sounds.ts pour éviter les divergences.
    localStorage.setItem("mm-volume", String(s.volume));
    localStorage.setItem("mm-muted", s.muted ? "1" : "0");
  } catch {
    // ignore
  }
}

export const useSettingsStore = create<SettingsState>((set, get) => ({
  settings: { ...DEFAULT_SETTINGS, ...readLocal() },
  hydratedFromServer: false,
  hydrateFromServer: (s) => {
    const merged = { ...get().settings, ...sanitize(s) };
    writeLocal(merged);
    set({ settings: merged, hydratedFromServer: true });
  },
  update: (patch) => {
    const merged = { ...get().settings, ...sanitize(patch) };
    writeLocal(merged);
    set({ settings: merged });
  },
  reset: () => {
    writeLocal(DEFAULT_SETTINGS);
    set({ settings: DEFAULT_SETTINGS });
  },
}));

function sanitize(s: Partial<UserSettings>): Partial<UserSettings> {
  const out: Partial<UserSettings> = {};
  if (typeof s.ttsAutoPlay === "boolean") out.ttsAutoPlay = s.ttsAutoPlay;
  if (typeof s.voiceRecognition === "boolean")
    out.voiceRecognition = s.voiceRecognition;
  if (typeof s.volume === "number" && Number.isFinite(s.volume)) {
    out.volume = Math.max(0, Math.min(1, s.volume));
  }
  if (typeof s.muted === "boolean") out.muted = s.muted;
  if (typeof s.dailyNotif === "boolean") out.dailyNotif = s.dailyNotif;
  if (s.ttsVoiceUri === null || typeof s.ttsVoiceUri === "string") {
    out.ttsVoiceUri = s.ttsVoiceUri;
  }
  if (typeof s.ttsRate === "number" && Number.isFinite(s.ttsRate)) {
    out.ttsRate = Math.max(0.5, Math.min(2, s.ttsRate));
  }
  if (typeof s.ttsPitch === "number" && Number.isFinite(s.ttsPitch)) {
    out.ttsPitch = Math.max(0.5, Math.min(2, s.ttsPitch));
  }
  return out;
}

/** Hook simple pour piocher un setting et déclencher un re-render à son changement. */
export function useSetting<K extends keyof UserSettings>(key: K): UserSettings[K] {
  return useSettingsStore((s) => s.settings[key]);
}
