import { notFound, redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TvHostRoom } from "./tv-host-room";

export const metadata = { title: "Mode TV — Salle d'attente" };
export const dynamic = "force-dynamic";

export default async function TvHostRoomPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect(`/login?next=/tv/host/${code}`);

  const { data: room } = await supabase
    .from("tv_rooms")
    .select("id, code, host_id, status, game_mode, created_at")
    .eq("code", code)
    .neq("status", "ended")
    .maybeSingle();

  if (!room) notFound();
  if (room.host_id !== user.id) {
    // Quelqu'un d'autre a essayé d'ouvrir une room qui n'est pas la sienne
    redirect("/tv/host");
  }

  // Joueurs déjà connectés (charge initial, puis Realtime prend le relais)
  const { data: players } = await supabase
    .from("tv_room_players")
    .select("id, pseudo, avatar_url, is_connected, joined_at, player_token")
    .eq("room_id", room.id)
    .order("joined_at", { ascending: true });

  return (
    <TvHostRoom
      roomId={room.id}
      code={room.code}
      initialPlayers={(players ?? []).map((p) => ({
        id: p.id,
        pseudo: p.pseudo,
        avatarUrl: p.avatar_url,
        isConnected: p.is_connected,
        joinedAt: p.joined_at,
      }))}
      initialStatus={room.status as "waiting" | "playing" | "paused" | "ended"}
    />
  );
}
