"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

/**
 * Joueurs locaux mémorisés par un compte (mode local 12 Coups).
 *
 * Les actions sont des Server Actions standard. Elles s'appuient sur la
 * RLS Supabase (`auth.uid() = owner_id`) pour l'isolation : on n'a pas
 * besoin de re-vérifier l'ownership côté serveur, le moteur RLS le fait.
 *
 * Convention de matching pseudo : insensible à la casse (l'index
 * `saved_players_owner_pseudo_lower_idx` garantit l'unicité). Pour
 * autocomplete on charge la liste complète (volume négligeable —
 * un compte aura rarement > 50 joueurs sauvegardés).
 */

export interface SavedPlayer {
  id: string;
  pseudo: string;
  avatarUrl: string | null;
  gamesPlayed: number;
  gamesWon: number;
  lastPlayedAt: string;
  createdAt: string;
}

export interface UpsertSavedPlayerInput {
  pseudo: string;
  avatarUrl?: string | null;
}

/** Liste les joueurs sauvegardés du compte connecté, triés du plus récent au plus ancien. */
export async function fetchSavedPlayers(): Promise<SavedPlayer[]> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from("saved_players")
    .select(
      "id, pseudo, avatar_url, games_played, games_won, last_played_at, created_at",
    )
    .eq("owner_id", user.id)
    .order("last_played_at", { ascending: false });

  if (error || !data) return [];

  return data.map((row) => ({
    id: row.id as string,
    pseudo: row.pseudo as string,
    avatarUrl: (row.avatar_url as string | null) ?? null,
    gamesPlayed: (row.games_played as number) ?? 0,
    gamesWon: (row.games_won as number) ?? 0,
    lastPlayedAt: row.last_played_at as string,
    createdAt: row.created_at as string,
  }));
}

/**
 * Crée ou met à jour un joueur sauvegardé.
 * Match insensible à la casse sur `pseudo` : si un joueur du même nom
 * existe déjà, on met à jour son avatar et on bump `last_played_at`.
 *
 * Retourne l'id du joueur upserté ou null en cas d'erreur silencieuse
 * (ex: pas connecté). On ne lève pas d'erreur pour ne jamais bloquer
 * le démarrage d'une partie : la persistance est best-effort.
 */
export async function upsertSavedPlayer(
  input: UpsertSavedPlayerInput,
): Promise<string | null> {
  const pseudo = input.pseudo.trim();
  if (!pseudo) return null;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;

  // Cherche d'abord un match insensible à la casse via ilike (l'index
  // sur lower(pseudo) garantit la perf).
  const { data: existing } = await supabase
    .from("saved_players")
    .select("id, avatar_url")
    .eq("owner_id", user.id)
    .ilike("pseudo", pseudo)
    .maybeSingle();

  if (existing?.id) {
    const id = existing.id as string;
    const updateFields: {
      last_played_at: string;
      avatar_url?: string | null;
    } = { last_played_at: new Date().toISOString() };
    // Ne remplace l'avatar que si on en a un nouveau (sinon on garde l'existant).
    if (input.avatarUrl) updateFields.avatar_url = input.avatarUrl;
    await supabase
      .from("saved_players")
      .update(updateFields)
      .eq("id", id)
      .eq("owner_id", user.id);
    return id;
  }

  const { data: inserted } = await supabase
    .from("saved_players")
    .insert({
      owner_id: user.id,
      pseudo,
      avatar_url: input.avatarUrl ?? null,
    })
    .select("id")
    .single();

  return (inserted?.id as string | undefined) ?? null;
}

/**
 * Bump les compteurs de fin de partie : `games_played + 1`, `games_won + 1`
 * si vainqueur. Best-effort — on ne lève rien.
 */
export async function recordGamePlayed(input: {
  pseudo: string;
  won: boolean;
}): Promise<void> {
  const pseudo = input.pseudo.trim();
  if (!pseudo) return;

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const { data: row } = await supabase
    .from("saved_players")
    .select("id, games_played, games_won")
    .eq("owner_id", user.id)
    .ilike("pseudo", pseudo)
    .maybeSingle();

  if (!row?.id) return;

  await supabase
    .from("saved_players")
    .update({
      games_played: ((row.games_played as number) ?? 0) + 1,
      games_won: ((row.games_won as number) ?? 0) + (input.won ? 1 : 0),
      last_played_at: new Date().toISOString(),
    })
    .eq("id", row.id as string)
    .eq("owner_id", user.id);
}

export async function deleteSavedPlayer(id: string): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  await supabase
    .from("saved_players")
    .delete()
    .eq("id", id)
    .eq("owner_id", user.id);

  revalidatePath("/parametres/joueurs");
}

export async function updateSavedPlayer(
  id: string,
  patch: { pseudo?: string; avatarUrl?: string | null },
): Promise<void> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const fields: { pseudo?: string; avatar_url?: string | null } = {};
  if (patch.pseudo !== undefined) {
    const trimmed = patch.pseudo.trim();
    if (trimmed) fields.pseudo = trimmed;
  }
  if (patch.avatarUrl !== undefined) fields.avatar_url = patch.avatarUrl;
  if (Object.keys(fields).length === 0) return;

  await supabase
    .from("saved_players")
    .update(fields)
    .eq("id", id)
    .eq("owner_id", user.id);

  revalidatePath("/parametres/joueurs");
}
