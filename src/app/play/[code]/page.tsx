import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PlayJoinClient } from "./play-join-client";

export const metadata = { title: "Rejoindre la partie" };
export const dynamic = "force-dynamic";

/**
 * Page d'entrée pour les téléphones invités. Pas d'auth requise.
 *
 * - Vérifie que le code existe et que la room est active.
 * - Affiche le formulaire de jonction (pseudo + photo optionnelle).
 * - Si la room est "playing"/"paused" et qu'on a déjà un token en localStorage,
 *   le client tente une reconnexion automatique (cf. play-join-client.tsx).
 */
export default async function PlayCodePage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  // Format attendu : 4 chiffres
  if (!/^\d{4}$/.test(code)) notFound();

  const supabase = await createClient();
  const { data: room } = await supabase
    .from("tv_rooms")
    .select("id, code, status")
    .eq("code", code)
    .neq("status", "ended")
    .maybeSingle();

  return (
    <PlayJoinClient
      code={code}
      roomFound={!!room}
      initialStatus={
        (room?.status as "waiting" | "playing" | "paused" | undefined) ?? null
      }
    />
  );
}
