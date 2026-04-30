import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PlayRemoteClient } from "./play-remote-client";

export const metadata = { title: "Mode télécommande" };
export const dynamic = "force-dynamic";

/**
 * P4.1 — Page client "régie" : un seul téléphone gère plusieurs joueurs
 * locaux. Pas d'auth, pas de QR à scanner par joueur. Le téléphone stocke
 * les `player_token` de chaque joueur en localStorage et envoie les
 * `answer:submit` avec le bon token selon le tour courant.
 */
export default async function PlayRemotePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  if (!/^\d{4}$/.test(code)) notFound();

  const supabase = await createClient();
  const { data: room } = await supabase
    .from("tv_rooms")
    .select("id, code, status, mode")
    .eq("code", code)
    .neq("status", "ended")
    .maybeSingle();

  if (!room) notFound();
  if (room.mode !== "remote") {
    // Si quelqu'un atteint /remote sur une room "scan", on le renvoie
    // au client normal côté composant (notFound() casserait le UX).
    return (
      <PlayRemoteClient
        code={code}
        roomId={room.id}
        wrongMode
        initialStatus={
          room.status as "waiting" | "playing" | "paused" | "ended"
        }
      />
    );
  }

  return (
    <PlayRemoteClient
      code={code}
      roomId={room.id}
      wrongMode={false}
      initialStatus={room.status as "waiting" | "playing" | "paused" | "ended"}
    />
  );
}
