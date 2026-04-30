import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { DailyReminder } from "@/components/layout/DailyReminder";
import { Navbar } from "@/components/layout/Navbar";
import { OwnerSplash } from "@/components/layout/OwnerSplash";
import { SettingsHydrator } from "@/components/layout/SettingsHydrator";
import { ThemeApplier } from "@/components/layout/ThemeApplier";
import { getBranding } from "@/lib/branding";
import type { UserSettings } from "@/lib/settings";

/**
 * Layout (app) — Garde d'authentification + hydrate settings/thème depuis BDD.
 *
 * K4 — Charge aussi `is_owner` pour résoudre le branding conditionnel
 * Mahylan / générique. Le résultat est poussé en prop à `Navbar`.
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
    .select("pseudo, role, theme, settings, avatar_url, is_owner")
    .eq("id", user.id)
    .single();

  const pseudo = profile?.pseudo ?? user.email ?? "joueur";
  const role = profile?.role ?? "user";
  const theme = profile?.theme ?? "system";
  const avatarUrl = profile?.avatar_url ?? null;
  const isOwner = profile?.is_owner === true;
  const branding = getBranding(isOwner);
  const serverSettings: Partial<UserSettings> =
    profile?.settings && typeof profile.settings === "object"
      ? (profile.settings as Partial<UserSettings>)
      : {};

  return (
    <div className="flex min-h-full flex-col">
      <ThemeApplier theme={theme} />
      <SettingsHydrator serverSettings={serverSettings} />
      <DailyReminder />
      {/* L2.2 — Splash one-shot pour le owner. Internement gère
          localStorage et ne render rien si déjà vu / non-owner. */}
      <OwnerSplash branding={branding} />
      <Navbar
        pseudo={pseudo}
        role={role}
        avatarUrl={avatarUrl}
        branding={branding}
      />
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}
