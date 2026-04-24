"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { DcPlayer } from "@/lib/game-logic/douze-coups";

export type SaveDcResult =
  | {
      status: "ok";
      sessionId: string;
      xpGained: number;
      newXpTotal: number;
      winnerCagnotte: number;
    }
  | { status: "error"; message: string };

interface SaveDcInput {
  players: DcPlayer[];
  durationSeconds: number;
  userPlayerId: string;
}

/**
 * Persiste une partie des 12 Coups de Midi.
 *  - 1 game_sessions (mode='douze_coups') au nom du user authentifié.
 *  - `score` = cagnotte finale du user (0 s'il est éliminé).
 *  - `correct_count` / `total_count` = stats du user.
 *  - XP = cagnotte / 100 plafonnée à 2000 (pour éviter l'inflation).
 *  - Pas de colonne cagnotte persistée sur profiles (reset à chaque partie,
 *    confirmé par l'user).
 */
export async function saveDouzeCoupsSession(
  input: SaveDcInput,
): Promise<SaveDcResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const userPlayer = input.players.find((p) => p.id === input.userPlayerId);
  const userCagnotte = userPlayer?.cagnotte ?? 0;
  const userCorrect = userPlayer?.correctCount ?? 0;
  const userWrong = userPlayer?.wrongCount ?? 0;
  const xpGained = Math.min(2000, Math.floor(userCagnotte / 100));
  const winner = [...input.players].sort((a, b) => {
    if (a.isEliminated !== b.isEliminated) return a.isEliminated ? 1 : -1;
    return b.cagnotte - a.cagnotte;
  })[0];

  const { data: session, error: sessionError } = await supabase
    .from("game_sessions")
    .insert({
      user_id: user.id,
      mode: "douze_coups",
      score: userCagnotte,
      correct_count: userCorrect,
      total_count: userCorrect + userWrong,
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

  // Update XP
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
    winnerCagnotte: winner?.cagnotte ?? 0,
  };
}
