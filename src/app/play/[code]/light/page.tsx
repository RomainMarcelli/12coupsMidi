import { notFound } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { PlayLightClient } from "./play-light-client";

export const metadata = { title: "Joue !" };
export const dynamic = "force-dynamic";

export default async function PlayLightPage({
  params,
}: {
  params: Promise<{ code: string }>;
}) {
  const { code } = await params;
  if (!/^\d{4}$/.test(code)) notFound();

  const supabase = await createClient();
  const { data: room } = await supabase
    .from("tv_rooms")
    .select("id, code, status")
    .eq("code", code)
    .neq("status", "ended")
    .maybeSingle();

  if (!room) notFound();

  return <PlayLightClient code={code} roomId={room.id} fullMode={false} />;
}
