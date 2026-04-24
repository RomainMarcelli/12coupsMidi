import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

/**
 * Garde server-side pour les pages admin.
 * Redirige vers / si l'utilisateur n'est pas admin.
 * Retourne le profil si tout va bien.
 */
export async function requireAdmin() {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("id, pseudo, role")
    .eq("id", user.id)
    .single();

  if (!profile || profile.role !== "admin") {
    redirect("/");
  }

  return { user, profile };
}
