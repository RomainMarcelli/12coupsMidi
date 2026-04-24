/**
 * Sons Midi Master via Web Audio API (pas de fichiers MP3 nécessaires).
 *
 * - Lazy init : AudioContext créé au premier appel utilisateur (auto-play
 *   policy navigateur).
 * - Volume global persisté dans localStorage.
 * - Mute global respecté.
 *
 * Usage :
 *   import { playSound } from "@/lib/sounds";
 *   playSound("ding");
 */

type SoundName = "tick" | "ding" | "buzz" | "win" | "lose" | "tension" | "duel";

let ctx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  if (!ctx) {
    const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
    if (!Ctor) return null;
    ctx = new Ctor();
  }
  if (ctx.state === "suspended") {
    void ctx.resume();
  }
  return ctx;
}

function getVolume(): number {
  if (typeof window === "undefined") return 0.5;
  const stored = localStorage.getItem("mm-volume");
  if (stored === null) return 0.5;
  const v = parseFloat(stored);
  return Number.isFinite(v) ? Math.max(0, Math.min(1, v)) : 0.5;
}

function isMuted(): boolean {
  if (typeof window === "undefined") return false;
  return localStorage.getItem("mm-muted") === "1";
}

export function setVolume(v: number) {
  if (typeof window === "undefined") return;
  localStorage.setItem("mm-volume", String(Math.max(0, Math.min(1, v))));
}

export function setMuted(m: boolean) {
  if (typeof window === "undefined") return;
  localStorage.setItem("mm-muted", m ? "1" : "0");
}

interface ToneSpec {
  freq: number;
  duration: number;
  type?: OscillatorType;
  gain?: number;
  delay?: number;
}

function playTones(tones: ToneSpec[]) {
  if (isMuted()) return;
  const audio = getCtx();
  if (!audio) return;

  const baseGain = getVolume();
  const now = audio.currentTime;

  for (const t of tones) {
    const startAt = now + (t.delay ?? 0);
    const osc = audio.createOscillator();
    const gain = audio.createGain();
    osc.type = t.type ?? "sine";
    osc.frequency.value = t.freq;
    const peakGain = baseGain * (t.gain ?? 0.3);
    gain.gain.setValueAtTime(0, startAt);
    gain.gain.linearRampToValueAtTime(peakGain, startAt + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, startAt + t.duration);
    osc.connect(gain).connect(audio.destination);
    osc.start(startAt);
    osc.stop(startAt + t.duration);
  }
}

const SOUNDS: Record<SoundName, () => void> = {
  tick: () =>
    playTones([{ freq: 1200, duration: 0.05, type: "square", gain: 0.15 }]),
  ding: () =>
    playTones([
      { freq: 880, duration: 0.18, type: "sine", gain: 0.4 },
      { freq: 1320, duration: 0.25, type: "sine", gain: 0.4, delay: 0.08 },
    ]),
  buzz: () =>
    playTones([
      { freq: 180, duration: 0.4, type: "sawtooth", gain: 0.4 },
      { freq: 120, duration: 0.4, type: "sawtooth", gain: 0.3, delay: 0.05 },
    ]),
  win: () =>
    playTones([
      { freq: 523, duration: 0.18, type: "triangle", gain: 0.35 },
      { freq: 659, duration: 0.18, type: "triangle", gain: 0.35, delay: 0.18 },
      { freq: 784, duration: 0.18, type: "triangle", gain: 0.35, delay: 0.36 },
      { freq: 1046, duration: 0.4, type: "triangle", gain: 0.4, delay: 0.54 },
    ]),
  lose: () =>
    playTones([
      { freq: 440, duration: 0.25, type: "triangle", gain: 0.35 },
      { freq: 330, duration: 0.25, type: "triangle", gain: 0.35, delay: 0.25 },
      { freq: 220, duration: 0.5, type: "triangle", gain: 0.35, delay: 0.5 },
    ]),
  // Tension — basse pulsante pour l'annonce du rouge / de l'élimination.
  tension: () =>
    playTones([
      { freq: 110, duration: 0.25, type: "sawtooth", gain: 0.3 },
      { freq: 130, duration: 0.25, type: "sawtooth", gain: 0.3, delay: 0.3 },
      { freq: 110, duration: 0.25, type: "sawtooth", gain: 0.3, delay: 0.6 },
      { freq: 150, duration: 0.4, type: "sawtooth", gain: 0.35, delay: 0.9 },
    ]),
  // Duel — flash dramatique, 2 coups secs + bourdon grave.
  duel: () =>
    playTones([
      { freq: 880, duration: 0.12, type: "square", gain: 0.35 },
      { freq: 440, duration: 0.12, type: "square", gain: 0.35, delay: 0.15 },
      { freq: 110, duration: 0.6, type: "sawtooth", gain: 0.3, delay: 0.3 },
    ]),
};

export function playSound(name: SoundName) {
  SOUNDS[name]();
}
