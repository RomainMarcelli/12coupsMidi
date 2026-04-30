import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchSavedPlayers } from "@/lib/saved-players/actions";
import { JoueursClient } from "./joueurs-client";

export const metadata = { title: "Mes joueurs sauvegardés" };
export const dynamic = "force-dynamic";

export default async function JoueursPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const players = await fetchSavedPlayers();
  return <JoueursClient initial={players} />;
}
