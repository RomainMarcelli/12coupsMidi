"use client";

import { createClient } from "@/lib/supabase/client";

/**
 * Actions client (téléphone) pour rejoindre/quitter une room TV.
 * Pas de Server Actions ici : les téléphones ne sont PAS authentifiés,
 * donc tout passe par le client supabase-js avec les RLS publiques de
 * `tv_rooms` / `tv_room_players`.
 *
 * Le `player_token` est généré côté client (UUID v4 via `crypto.randomUUID`)
 * et stocké en localStorage pour la reconnexion.
 */

const TOKEN_KEY_PREFIX = "mahylan-tv-token:";

/** Génère un token UUID v4 pour identifier ce téléphone côté serveur. */
export function generatePlayerToken(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  // Fallback déterministe-only-en-dernier-recours
  return `tk_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 12)}`;
}

export function readStoredToken(roomCode: string): string | null {
  if (typeof window === "undefined") return null;
  return window.localStorage.getItem(TOKEN_KEY_PREFIX + roomCode);
}

export function storeToken(roomCode: string, token: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.setItem(TOKEN_KEY_PREFIX + roomCode, token);
}

export function clearStoredToken(roomCode: string): void {
  if (typeof window === "undefined") return;
  window.localStorage.removeItem(TOKEN_KEY_PREFIX + roomCode);
}

export interface JoinedRoom {
  roomId: string;
  playerId: string;
  playerToken: string;
}

export interface JoinError {
  ok: false;
  message: string;
}

/**
 * Vérifie l'existence d'une room par son code (status != ended).
 * Retourne `null` si introuvable.
 */
export async function findActiveRoomByCode(code: string): Promise<{
  id: string;
  status: "waiting" | "playing" | "paused" | "ended";
} | null> {
  const supabase = createClient();
  const { data } = await supabase
    .from("tv_rooms")
    .select("id, status")
    .eq("code", code)
    .neq("status", "ended")
    .maybeSingle();
  if (!data) return null;
  return {
    id: data.id as string,
    status: data.status as "waiting" | "playing" | "paused" | "ended",
  };
}

/**
 * Rejoint une room en tant que joueur (téléphone). Génère et stocke un
 * `player_token` UUID. À la reconnexion, on appelle `rejoinRoomByToken`
 * plutôt que `joinRoom` pour réutiliser la même ligne.
 */
export async function joinRoom(input: {
  code: string;
  pseudo: string;
  avatarUrl?: string | null;
}): Promise<{ ok: true; data: JoinedRoom } | JoinError> {
  const room = await findActiveRoomByCode(input.code);
  if (!room) {
    return { ok: false, message: "Code invalide ou partie terminée." };
  }

  const supabase = createClient();
  const token = generatePlayerToken();
  const { data, error } = await supabase
    .from("tv_room_players")
    .insert({
      room_id: room.id,
      player_token: token,
      pseudo: input.pseudo.trim(),
      avatar_url: input.avatarUrl ?? null,
      is_connected: true,
      last_seen_at: new Date().toISOString(),
    })
    .select("id")
    .single();

  if (error || !data) {
    return {
      ok: false,
      message: error?.message ?? "Impossible de rejoindre la partie.",
    };
  }

  storeToken(input.code, token);
  return {
    ok: true,
    data: { roomId: room.id, playerId: data.id as string, playerToken: token },
  };
}

/**
 * Reconnexion : retrouve la ligne tv_room_players via le token stocké.
 * Met à jour `is_connected = true` et `last_seen_at`. Retourne `null`
 * si le token n'existe plus (room terminée ou ligne supprimée).
 */
export async function rejoinRoomByToken(input: {
  code: string;
  token: string;
}): Promise<{ ok: true; data: JoinedRoom } | JoinError> {
  const room = await findActiveRoomByCode(input.code);
  if (!room) return { ok: false, message: "Partie terminée." };
  const supabase = createClient();
  const { data: existing } = await supabase
    .from("tv_room_players")
    .select("id")
    .eq("room_id", room.id)
    .eq("player_token", input.token)
    .maybeSingle();
  if (!existing?.id) {
    return { ok: false, message: "Reconnexion impossible — rejoins manuellement." };
  }
  await supabase
    .from("tv_room_players")
    .update({ is_connected: true, last_seen_at: new Date().toISOString() })
    .eq("id", existing.id as string)
    .eq("player_token", input.token);
  return {
    ok: true,
    data: {
      roomId: room.id,
      playerId: existing.id as string,
      playerToken: input.token,
    },
  };
}

/** Heartbeat : bump `last_seen_at` pour signaler qu'on est toujours là. */
export async function sendHeartbeat(input: {
  playerId: string;
  token: string;
}): Promise<void> {
  const supabase = createClient();
  await supabase
    .from("tv_room_players")
    .update({ last_seen_at: new Date().toISOString(), is_connected: true })
    .eq("id", input.playerId)
    .eq("player_token", input.token);
}

/** Marque le joueur déconnecté (au unload de la page). */
export async function markDisconnected(input: {
  playerId: string;
  token: string;
}): Promise<void> {
  const supabase = createClient();
  await supabase
    .from("tv_room_players")
    .update({ is_connected: false })
    .eq("id", input.playerId)
    .eq("player_token", input.token);
}
