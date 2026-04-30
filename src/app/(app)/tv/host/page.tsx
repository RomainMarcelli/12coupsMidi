import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { TvHostLanding } from "./host-landing";

export const metadata = { title: "Mode TV Soirée — Créer une partie" };
export const dynamic = "force-dynamic";

/**
 * Landing du Mode TV (page d'accueil hôte).
 * Le user connecté clique "Créer une partie" → server action createTvRoom
 * → redirect vers /tv/host/[code] (salle d'attente).
 */
export default async function TvHostLandingPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login?next=/tv/host");
  return <TvHostLanding />;
}
