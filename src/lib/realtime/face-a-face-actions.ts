"use server";

import { createClient } from "@/lib/supabase/server";
import type {
  FaceAFaceQuestion,
  FaceAFaceState,
} from "./face-a-face-state";

/**
 * P5.1 — Server actions pour le mode face-à-face. L'hôte appelle
 * `prepareFaceAFace` une fois pour charger un pool de questions et
 * démarrer la phase de vote ; les transitions ultérieures sont gérées
 * en mémoire côté client (broadcast Realtime) avec persist optionnelle.
 */

export interface PrepareFaInput {
  roomId: string;
  /** Tokens des 2 finalistes (par exemple les 2 derniers du mode regular,
   *  ou les 2 premiers à se connecter en mode face-à-face direct). */
  finalists: [string, string];
  /** Pseudos pour le state initial (cache local côté client). */
  finalistPseudos: Record<string, string>;
  /** Timer initial en secondes (default 60). */
  timerSeconds?: number;
  /** Nombre de questions à charger (default 30). */
  poolSize?: number;
}

export async function prepareFaceAFace(input: PrepareFaInput): Promise<
  | { ok: true; state: FaceAFaceState }
  | { ok: false; message: string }
> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { ok: false, message: "Non authentifié." };

  const { data: room } = await supabase
    .from("tv_rooms")
    .select("id, host_id")
    .eq("id", input.roomId)
    .maybeSingle();
  if (!room || room.host_id !== user.id) {
    return { ok: false, message: "Room introuvable ou non autorisée." };
  }

  const poolSize = Math.min(Math.max(input.poolSize ?? 30, 10), 60);

  // Pool de questions quizz_2 (format simple, 2 choix). On garde les choix
  // en state pour permettre au présentateur de voir la bonne réponse sur
  // son téléphone (plus tard si on veut).
  const { data: pool } = await supabase
    .from("questions")
    .select("id, enonce, reponses, format")
    .eq("type", "quizz_2")
    .limit(200);

  if (!pool || pool.length < 5) {
    return { ok: false, message: "Pas assez de questions en base." };
  }

  const shuffled = [...pool].sort(() => Math.random() - 0.5).slice(0, poolSize);
  const questions: FaceAFaceQuestion[] = shuffled
    .map((q) => {
      const reponses = (q.reponses as unknown as Array<{
        text: string;
        correct?: boolean;
      }>) ?? [];
      const choices = reponses.map((r, idx) => ({ idx, text: r.text }));
      const correctIdx = reponses.findIndex((r) => r.correct === true);
      return {
        id: q.id as string,
        enonce: q.enonce as string,
        choices,
        correctIdx: Math.max(0, correctIdx),
      };
    })
    .filter((q) => q.choices.length > 0);

  const timerSeconds = Math.max(20, Math.min(120, input.timerSeconds ?? 60));
  const timers: Record<string, number> = {};
  for (const t of input.finalists) timers[t] = timerSeconds;

  const state: FaceAFaceState = {
    phase: "vote",
    finalists: input.finalists,
    finalistPseudos: input.finalistPseudos,
    votes: {},
    presenterToken: null,
    challengerToken: null,
    currentChallengerToken: null,
    timers,
    questions,
    currentQuestionIdx: 0,
    ticking: false,
    winnerToken: null,
  };

  await supabase
    .from("tv_rooms")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({ status: "playing", face_a_face_state: state as any })
    .eq("id", input.roomId)
    .eq("host_id", user.id);

  return { ok: true, state };
}

/** Persiste l'état du face-à-face (best-effort, pour reconnexion). */
export async function saveFaceAFaceState(input: {
  roomId: string;
  state: FaceAFaceState;
  status?: "playing" | "ended";
}): Promise<void> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return;
  await supabase
    .from("tv_rooms")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({
      face_a_face_state: input.state as any,
      ...(input.status ? { status: input.status } : {}),
      ...(input.status === "ended"
        ? { ended_at: new Date().toISOString() }
        : {}),
    })
    .eq("id", input.roomId)
    .eq("host_id", user.id);
}
