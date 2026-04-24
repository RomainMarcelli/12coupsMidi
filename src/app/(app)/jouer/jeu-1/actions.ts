"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import {
  computeJeu1Xp,
  JEU1_TOTAL_QUESTIONS,
  type Jeu1AnswerLog,
} from "@/lib/game-logic/jeu1";

export type SaveJeu1Result =
  | {
      status: "ok";
      sessionId: string;
      xpGained: number;
      newXpTotal: number;
    }
  | { status: "error"; message: string };

interface SaveJeu1Input {
  answers: Jeu1AnswerLog[];
  wrongCount: number;
  durationSeconds: number;
}

/**
 * Persiste une partie de Jeu 1 en BDD :
 *  1. INSERT game_sessions (mode='jeu1', score, correct_count, …, xp_gained)
 *  2. INSERT answers_log (1 ligne par réponse) — batch
 *  3. UPSERT wrong_answers pour chaque mauvaise réponse (fail_count++)
 *  4. UPDATE profiles.xp = xp + xpGained
 *
 * Toutes les écritures passent par le client SSR (RLS du user) — les
 * policies du 0001_init.sql autorisent ces inserts à la condition
 * user_id = auth.uid().
 */
export async function saveJeu1Session(
  input: SaveJeu1Input,
): Promise<SaveJeu1Result> {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const correctCount = input.answers.filter((a) => a.isCorrect).length;
  const totalCount = input.answers.length;
  const xpGained = computeJeu1Xp(correctCount, JEU1_TOTAL_QUESTIONS);

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

  // 2. answers_log (batch)
  if (input.answers.length > 0) {
    const rows = input.answers.map((a) => ({
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

  // 3. wrong_answers : pour chaque mauvaise réponse, incrément ou création.
  //    On itère car on a besoin de upsert per-row avec un increment.
  const wrongQuestionIds = input.answers
    .filter((a) => !a.isCorrect)
    .map((a) => a.questionId);

  if (wrongQuestionIds.length > 0) {
    // Charger les lignes existantes pour décider insert vs update.
    const { data: existing } = await supabase
      .from("wrong_answers")
      .select("id, question_id, fail_count")
      .eq("user_id", user.id)
      .in("question_id", wrongQuestionIds);

    const existingByQuestion = new Map(
      (existing ?? []).map((r) => [r.question_id, r]),
    );

    for (const qid of wrongQuestionIds) {
      const existingRow = existingByQuestion.get(qid);
      if (existingRow) {
        await supabase
          .from("wrong_answers")
          .update({
            fail_count: existingRow.fail_count + 1,
            success_streak: 0,
            last_seen_at: new Date().toISOString(),
          })
          .eq("id", existingRow.id);
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

  // 4. update profiles.xp
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
