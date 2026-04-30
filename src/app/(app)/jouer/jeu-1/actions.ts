"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  computeCeXp,
  type CeAnswerLog,
} from "@/lib/game-logic/coup-d-envoi";

export type SaveCeResult =
  | {
      status: "ok";
      sessionId: string;
      xpGained: number;
      newXpTotal: number;
    }
  | { status: "error"; message: string };

interface SaveCeInput {
  answers: CeAnswerLog[];
  durationSeconds: number;
  rougePlayerId: string | null;
}

/**
 * Persiste une partie de Coup d'Envoi (multijoueur) en BDD.
 *  - 1 game_sessions (mode='jeu1') au nom du user authentifié
 *  - answers_log uniquement pour les réponses données par le user
 *    (on ignore les bots et les autres humains locaux — seul le user
 *    authentifié est tracé pour ses stats)
 *  - wrong_answers upsertés pour les ratés du user
 *  - profiles.xp mis à jour (+50 XP par bonne réponse du user)
 */
export async function saveCeSession(
  input: SaveCeInput,
): Promise<SaveCeResult> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const userAnswers = input.answers.filter((a) => a.byUser);
  const correctCount = userAnswers.filter((a) => a.isCorrect).length;
  const totalCount = userAnswers.length;
  const xpGained = computeCeXp(correctCount);

  // 1. game_sessions
  const { data: session, error: sessionError } = await supabase
    .from("game_sessions")
    .insert({
      user_id: user.id,
      mode: "jeu1",
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

  // 2. answers_log (user seulement)
  if (userAnswers.length > 0) {
    const rows = userAnswers.map((a) => ({
      session_id: session.id,
      user_id: user.id,
      question_id: a.questionId,
      is_correct: a.isCorrect,
      time_taken_ms: a.timeMs,
    }));
    const { error: ansError } = await supabase
      .from("answers_log")
      .insert(rows);
    if (ansError) {
      return {
        status: "error",
        message: `Erreur log réponses : ${ansError.message}`,
      };
    }
  }

  // 3. wrong_answers upsert
  const wrongIds = userAnswers
    .filter((a) => !a.isCorrect)
    .map((a) => a.questionId);

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
