"use server";

import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";

interface SaveSettingsInput {
  ttsAutoPlay?: boolean;
  voiceRecognition?: boolean;
  volume?: number;
  muted?: boolean;
  dailyNotif?: boolean;
}

interface SaveProfileInput {
  pseudo?: string;
  avatarUrl?: string | null;
  theme?: "light" | "dark" | "system";
}

export type SaveResult =
  | { status: "ok" }
  | { status: "error"; message: string };

/**
 * Met à jour le bloc `settings` JSONB du profil de l'utilisateur connecté.
 * Merge non-destructif : on lit puis on écrit la version fusionnée.
 */
export async function saveUserSettings(
  patch: SaveSettingsInput,
): Promise<SaveResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const { data: profile, error: readErr } = await supabase
    .from("profiles")
    .select("settings")
    .eq("id", user.id)
    .single();
  if (readErr) {
    return { status: "error", message: readErr.message };
  }

  const current =
    profile?.settings && typeof profile.settings === "object"
      ? (profile.settings as Record<string, unknown>)
      : {};

  const merged = { ...current, ...patch };

  const { error } = await supabase
    .from("profiles")
    .update({ settings: merged })
    .eq("id", user.id);

  if (error) {
    return { status: "error", message: error.message };
  }
  return { status: "ok" };
}

/**
 * Met à jour le profil (pseudo / avatar / thème).
 * Pseudo unique : si conflit, retourne une erreur.
 */
export async function saveProfile(
  patch: SaveProfileInput,
): Promise<SaveResult> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const update: {
    pseudo?: string;
    avatar_url?: string | null;
    theme?: "light" | "dark" | "system";
  } = {};
  if (typeof patch.pseudo === "string") {
    const trimmed = patch.pseudo.trim();
    if (trimmed.length < 2) {
      return { status: "error", message: "Pseudo trop court (2 min)." };
    }
    if (trimmed.length > 24) {
      return { status: "error", message: "Pseudo trop long (24 max)." };
    }
    update.pseudo = trimmed;
  }
  if (patch.avatarUrl !== undefined) {
    update.avatar_url = patch.avatarUrl;
  }
  if (patch.theme) {
    update.theme = patch.theme;
  }

  if (Object.keys(update).length === 0) {
    return { status: "ok" };
  }

  const { error } = await supabase
    .from("profiles")
    .update(update)
    .eq("id", user.id);

  if (error) {
    if (error.code === "23505") {
      return { status: "error", message: "Ce pseudo est déjà pris." };
    }
    return { status: "error", message: error.message };
  }

  revalidatePath("/parametres");
  return { status: "ok" };
}

/**
 * Note : l'upload de l'avatar se fait désormais côté client (voir
 * `lib/avatar-upload.ts`) pour contourner la limite 1 MB des Server Actions
 * et compresser l'image dans le navigateur. Le client appelle ensuite
 * `saveProfile({ avatarUrl })` avec l'URL publique renvoyée par Supabase.
 */
