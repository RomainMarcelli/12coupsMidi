import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { fetchDailyChallenge, fetchDailyStats } from "./actions";
import { DefiClient } from "./defi-client";

export const metadata = { title: "Défi du jour" };
export const dynamic = "force-dynamic";

/**
 * H3 — Page dédiée au Défi du jour.
 *
 * Charge en parallèle :
 *   - Le défi du jour (questions + résultat existant éventuel)
 *   - Les stats agrégées de l'utilisateur
 *
 * Toute l'interactivité (lancer le défi, naviguer dans le calendrier,
 * voir ses réponses) est déléguée à `DefiClient`.
 */
export default async function DefiPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  // I3.1 — Récupère la date de création du compte pour borner le
  // calcul des "jours ratés en rouge" (on ne marque pas en rouge des
  // jours antérieurs à l'inscription du user — ce serait punitif).
  const { data: profile } = await supabase
    .from("profiles")
    .select("created_at")
    .eq("id", user.id)
    .maybeSingle();

  const [today, stats] = await Promise.all([
    fetchDailyChallenge(),
    fetchDailyStats(),
  ]);

  return (
    <DefiClient
      todayChallenge={today}
      stats={stats.status === "ok" ? stats.stats : null}
      accountCreatedAtIso={
        profile?.created_at
          ? new Date(profile.created_at).toISOString().slice(0, 10)
          : null
      }
    />
  );
}
