"use server";

import { headers } from "next/headers";
import { createClient } from "@/lib/supabase/server";

export type LoginState = {
  status: "idle" | "sent" | "error";
  message: string;
};

export async function sendMagicLink(
  _prev: LoginState,
  formData: FormData,
): Promise<LoginState> {
  const email = String(formData.get("email") ?? "")
    .trim()
    .toLowerCase();

  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return { status: "error", message: "Adresse email invalide." };
  }

  const supabase = await createClient();
  const headersList = await headers();

  const appUrl =
    process.env.NEXT_PUBLIC_APP_URL ??
    `https://${headersList.get("host") ?? "localhost:3000"}`;

  const { error } = await supabase.auth.signInWithOtp({
    email,
    options: {
      emailRedirectTo: `${appUrl}/auth/callback`,
      shouldCreateUser: true,
    },
  });

  if (error) {
    return { status: "error", message: error.message };
  }

  return {
    status: "sent",
    message: `Lien envoyé à ${email}. Vérifie ta boîte mail (et les spams).`,
  };
}
