"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { CpcRoundResult } from "@/lib/game-logic/coup-par-coup";

export type SaveCpcResult =
  | { status: "ok"; sessionId: string; xpGained: number; newXpTotal: number }
  | { status: "error"; message: string };

interface SaveCpcInput {
  rounds: CpcRoundResult[];
  wrongCount: number;
  xpGained: number;
  durationSeconds: number;
  gameOver: boolean;
}

/**
 * Persiste une partie de Le Coup par Coup :
 *  - INSERT game_sessions (mode='coup_par_coup', score = xp, …)
 *  - INSERT answers_log (1 ligne par round joué, is_correct = round parfait)
 *  - UPSERT wrong_answers pour chaque round raté (catch-intrus)
 *  - UPDATE profiles.xp + niveau
 */
export async function saveCoupParCoupSession(
  input: SaveCpcInput,
): Promise<SaveCpcResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const correctRounds = input.rounds.filter((r) => r.status === "perfect").length;

  // 1. game_sessions
  const { data: session, error: sessionError } = await supabase
    .from("game_sessions")
    .insert({
      user_id: user.id,
      mode: "coup_par_coup",
      score: input.xpGained,
      correct_count: correctRounds,
      total_count: input.rounds.length,
      duration_seconds: input.durationSeconds,
      xp_gained: input.xpGained,
    })
    .select("id")
    .single();

  if (sessionError || !session) {
    return {
      status: "error",
      message: `Erreur session : ${sessionError?.message ?? "?"}`,
    };
  }

  // 2. answers_log (1 par round joué)
  if (input.rounds.length > 0) {
    const rows = input.rounds.map((r) => ({
      session_id: session.id,
      user_id: user.id,
      question_id: r.questionId,
      is_correct: r.status === "perfect",
      time_taken_ms: null,
    }));
    const { error: ansErr } = await supabase.from("answers_log").insert(rows);
    if (ansErr) {
      return {
        status: "error",
        message: `Erreur log réponses : ${ansErr.message}`,
      };
    }
  }

  // 3. wrong_answers pour les rounds où le joueur a cliqué l'intrus
  const caughtIntrusIds = input.rounds
    .filter((r) => r.hitIntrus)
    .map((r) => r.questionId);

  if (caughtIntrusIds.length > 0) {
    const { data: existing } = await supabase
      .from("wrong_answers")
      .select("id, question_id, fail_count")
      .eq("user_id", user.id)
      .in("question_id", caughtIntrusIds);

    const existingByQ = new Map((existing ?? []).map((r) => [r.question_id, r]));
    for (const qid of caughtIntrusIds) {
      const prev = existingByQ.get(qid);
      if (prev) {
        await supabase
          .from("wrong_answers")
          .update({
            fail_count: prev.fail_count + 1,
            success_streak: 0,
            last_seen_at: new Date().toISOString(),
          })
          .eq("id", prev.id);
      } else {
        await supabase.from("wrong_answers").insert({
          user_id: user.id,
          question_id: qid,
          fail_count: 1,
          success_streak: 0,
        });
      }
    }
  }

  // 4. XP + niveau
  const { data: profile } = await supabase
    .from("profiles")
    .select("xp")
    .eq("id", user.id)
    .single();
  const currentXp = profile?.xp ?? 0;
  const newXpTotal = currentXp + input.xpGained;
  await supabase
    .from("profiles")
    .update({
      xp: newXpTotal,
      niveau: Math.max(1, Math.floor(newXpTotal / 1000) + 1),
    })
    .eq("id", user.id);

  return {
    status: "ok",
    sessionId: session.id,
    xpGained: input.xpGained,
    newXpTotal,
  };
}
