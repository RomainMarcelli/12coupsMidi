"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export type SaveEtoileResult =
  | { status: "ok"; sessionId: string; xpGained: number; newXpTotal: number }
  | { status: "error"; message: string };

interface SaveEtoileInput {
  questionId: string;
  found: boolean;
  indicesRevealed: number;
  xpGained: number;
  durationSeconds: number;
  attempts: number;
}

/**
 * Persiste une partie d'Étoile Mystérieuse (bonus Midi Master) :
 *  - INSERT game_sessions (mode='etoile')
 *  - INSERT answers_log
 *  - UPSERT wrong_answers si raté
 *  - UPDATE profiles.xp + niveau
 */
export async function saveEtoileSession(
  input: SaveEtoileInput,
): Promise<SaveEtoileResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: session, error: sessionError } = await supabase
    .from("game_sessions")
    .insert({
      user_id: user.id,
      mode: "etoile",
      score: input.found ? input.xpGained : 0,
      correct_count: input.found ? 1 : 0,
      total_count: 1,
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

  await supabase.from("answers_log").insert({
    session_id: session.id,
    user_id: user.id,
    question_id: input.questionId,
    is_correct: input.found,
    time_taken_ms: input.durationSeconds * 1000,
  });

  if (!input.found) {
    const { data: existing } = await supabase
      .from("wrong_answers")
      .select("id, fail_count")
      .eq("user_id", user.id)
      .eq("question_id", input.questionId)
      .maybeSingle();

    if (existing) {
      await supabase
        .from("wrong_answers")
        .update({
          fail_count: existing.fail_count + 1,
          success_streak: 0,
          last_seen_at: new Date().toISOString(),
        })
        .eq("id", existing.id);
    } else {
      await supabase.from("wrong_answers").insert({
        user_id: user.id,
        question_id: input.questionId,
        fail_count: 1,
        success_streak: 0,
      });
    }
  }

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
