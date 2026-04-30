"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import type { ShortcutsMap } from "./defaults";

/**
 * Server actions pour la persistance des raccourcis personnalisés (E4.1).
 * Stockés dans `profiles.keyboard_shortcuts` (JSONB).
 */

export async function fetchShortcuts(): Promise<ShortcutsMap> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return {};

  const { data } = await supabase
    .from("profiles")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .select("keyboard_shortcuts" as any)
    .eq("id", user.id)
    .maybeSingle();

  if (!data) return {};
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const raw = (data as any).keyboard_shortcuts;
  if (!raw || typeof raw !== "object") return {};
  return raw as ShortcutsMap;
}

export async function saveShortcuts(
  shortcuts: ShortcutsMap,
): Promise<{ status: "ok" } | { status: "error"; message: string }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  if (!user) return { status: "error", message: "Non connecté." };

  const { error } = await supabase
    .from("profiles")
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    .update({ keyboard_shortcuts: shortcuts } as any)
    .eq("id", user.id);

  if (error) return { status: "error", message: error.message };

  revalidatePath("/parametres");
  return { status: "ok" };
}

export async function resetShortcuts(): Promise<
  { status: "ok" } | { status: "error"; message: string }
> {
  return saveShortcuts({});
}
