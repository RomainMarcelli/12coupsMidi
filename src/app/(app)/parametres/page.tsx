import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import type { UserSettings } from "@/lib/settings";
import { ParametresClient, type ParametresInitial } from "./parametres-client";

export const metadata = { title: "Paramètres" };
export const dynamic = "force-dynamic";

export default async function ParametresPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile } = await supabase
    .from("profiles")
    .select("pseudo, avatar_url, theme, settings, xp, niveau, role")
    .eq("id", user.id)
    .single();

  const settings: Partial<UserSettings> =
    profile?.settings && typeof profile.settings === "object"
      ? (profile.settings as Partial<UserSettings>)
      : {};

  const initial: ParametresInitial = {
    email: user.email ?? "",
    pseudo: profile?.pseudo ?? "",
    avatarUrl: profile?.avatar_url ?? null,
    theme: profile?.theme ?? "system",
    xp: profile?.xp ?? 0,
    niveau: profile?.niveau ?? 1,
    role: profile?.role ?? "user",
    settings,
  };

  return <ParametresClient initial={initial} />;
}
