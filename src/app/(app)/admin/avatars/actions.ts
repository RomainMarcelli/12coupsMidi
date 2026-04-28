"use server";

import { revalidatePath } from "next/cache";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { createClient } from "@/lib/supabase/server";

/**
 * H4.3 — Server actions pour la gestion des avatars custom (admin).
 */

export interface CustomAvatarRow {
  id: string;
  url: string;
  tags: string[];
  uploadedBy: string | null;
  createdAt: string;
}

export async function listCustomAvatars(): Promise<
  | { status: "ok"; avatars: CustomAvatarRow[] }
  | { status: "error"; message: string }
> {
  await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("custom_avatars")
    .select("id, url, tags, uploaded_by, created_at")
    .order("created_at", { ascending: false });
  if (error) return { status: "error", message: error.message };
  return {
    status: "ok",
    avatars: (data ?? []).map((r) => ({
      id: r.id,
      url: r.url,
      tags: r.tags ?? [],
      uploadedBy: r.uploaded_by,
      createdAt: r.created_at,
    })),
  };
}

export async function createCustomAvatar(input: {
  url: string;
  tags: string[];
}): Promise<
  { status: "ok"; id: string } | { status: "error"; message: string }
> {
  const { user } = await requireAdmin();
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("custom_avatars")
    .insert({ url: input.url, tags: input.tags, uploaded_by: user.id })
    .select("id")
    .single();
  if (error) return { status: "error", message: error.message };
  revalidatePath("/admin/avatars");
  return { status: "ok", id: data.id };
}

export async function deleteCustomAvatar(
  id: string,
): Promise<{ status: "ok" } | { status: "error"; message: string }> {
  await requireAdmin();
  const supabase = await createClient();
  const { error } = await supabase.from("custom_avatars").delete().eq("id", id);
  if (error) return { status: "error", message: error.message };
  revalidatePath("/admin/avatars");
  return { status: "ok" };
}
