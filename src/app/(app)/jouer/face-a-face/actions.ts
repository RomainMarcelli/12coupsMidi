"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  computeFafXp,
  type FafAnswerLog,
  type FafMode,
} from "@/lib/game-logic/faceAFace";

export type SaveFafResult =
  | {
      status: "ok";
      sessionId: string;
      xpGained: number;
      newXpTotal: number;
    }
  | { status: "error"; message: string };

interface SaveFafInput {
  mode: FafMode;
  /** Réponses du user humain authentifié uniquement (pas du bot ni de l'ami). */
  answers: FafAnswerLog[];
  userWon: boolean;
  userTimeLeftMs: number;
  durationSeconds: number;
}

/**
 * Persiste une partie de Face-à-Face en BDD.
 *  - 1 game_sessions (mode='face_a_face') au nom du user authentifié
 *  - answers_log uniquement pour les réponses données par `user` (pas bot/ami)
 *  - wrong_answers upsertés pour les ratés du user
 *  - profiles.xp mis à jour si victoire (XP barème selon temps restant)
 *
 * En vs Ami, si l'ami gagne, le user authentifié ne touche pas d'XP mais
 * la session est quand même enregistrée (useful pour les stats).
 */
export async function saveFafSession(
  input: SaveFafInput,
): Promise<SaveFafResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const userAnswers = input.answers.filter((a) => a.by === "user");
  const correctCount = userAnswers.filter((a) => a.isCorrect).length;
  const totalCount = userAnswers.length;
  const xpGained = computeFafXp({
    won: input.userWon,
    timeLeftMs: input.userTimeLeftMs,
  });

  // 1. game_sessions
  const { data: session, error: sessionError } = await supabase
    .from("game_sessions")
    .insert({
      user_id: user.id,
      mode: "face_a_face",
      score: correctCount,
      correct_count: correctCount,
      total_count: totalCount,
      duration_seconds: input.durationSeconds,
      xp_gained: xpGained,
    })
    .select("id")
    .single();

  if (sessionError || !session) {
    return {
      status: "error",
      message: `Erreur création session : ${sessionError?.message ?? "?"}`,
    };
  }

  // 2. answers_log pour le user
  if (userAnswers.length > 0) {
    const rows = userAnswers.map((a) => ({
      session_id: session.id,
      user_id: user.id,
      question_id: a.questionId,
      is_correct: a.isCorrect,
      time_taken_ms: a.timeMs,
    }));
    const { error: ansError } = await supabase.from("answers_log").insert(rows);
    if (ansError) {
      return {
        status: "error",
        message: `Erreur log réponses : ${ansError.message}`,
      };
    }
  }

  // 3. wrong_answers : upsert pour chaque raté du user
  const wrongIds = userAnswers.filter((a) => !a.isCorrect).map((a) => a.questionId);

  if (wrongIds.length > 0) {
    const { data: existing } = await supabase
      .from("wrong_answers")
      .select("id, question_id, fail_count")
      .eq("user_id", user.id)
      .in("question_id", wrongIds);

    const existingByQuestion = new Map(
      (existing ?? []).map((r) => [r.question_id, r]),
    );

    for (const qid of wrongIds) {
      const row = existingByQuestion.get(qid);
      if (row) {
        await supabase
          .from("wrong_answers")
          .update({
            fail_count: row.fail_count + 1,
            success_streak: 0,
            last_seen_at: new Date().toISOString(),
          })
          .eq("id", row.id);
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

  // 4. profiles.xp
  const { data: profile } = await supabase
    .from("profiles")
    .select("xp")
    .eq("id", user.id)
    .single();

  const currentXp = profile?.xp ?? 0;
  const newXpTotal = currentXp + xpGained;

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
    xpGained,
    newXpTotal,
  };
}
