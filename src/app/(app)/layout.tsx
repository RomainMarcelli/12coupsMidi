import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DailyReminder } from "@/components/layout/DailyReminder";
import { Navbar } from "@/components/layout/Navbar";
import { SettingsHydrator } from "@/components/layout/SettingsHydrator";
import { ThemeApplier } from "@/components/layout/ThemeApplier";
import type { UserSettings } from "@/lib/settings";

/**
 * Layout (app) — Garde d'authentification + hydrate settings/thème depuis BDD.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const supabase = await createClient();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data: profile } = await supabase
    .from("profiles")
    .select("pseudo, role, theme, settings, avatar_url")
    .eq("id", user.id)
    .single();

  const pseudo = profile?.pseudo ?? user.email ?? "joueur";
  const role = profile?.role ?? "user";
  const theme = profile?.theme ?? "system";
  const avatarUrl = profile?.avatar_url ?? null;
  const serverSettings: Partial<UserSettings> =
    profile?.settings && typeof profile.settings === "object"
      ? (profile.settings as Partial<UserSettings>)
      : {};

  return (
    <div className="flex min-h-full flex-col">
      <ThemeApplier theme={theme} />
      <SettingsHydrator serverSettings={serverSettings} />
      <DailyReminder />
      <Navbar pseudo={pseudo} role={role} avatarUrl={avatarUrl} />
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}
