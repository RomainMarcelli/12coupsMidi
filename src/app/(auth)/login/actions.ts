"use server";

import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";

export type AuthResult = { status: "ok" } | { status: "error"; message: string };

const ADMIN_EMAIL = (process.env.ADMIN_EMAIL ?? "").toLowerCase();
const ADMIN_DEMO_PASSWORD = process.env.ADMIN_DEMO_PASSWORD ?? "";

function isAdminEmail(email: string) {
  return ADMIN_EMAIL !== "" && email.toLowerCase() === ADMIN_EMAIL;
}

function validateEmail(email: string): string | null {
  if (!email || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return "Adresse email invalide.";
  }
  return null;
}

function validatePassword(password: string): string | null {
  if (!password || password.length < 6) {
    return "Le mot de passe doit contenir au moins 6 caractères.";
  }
  return null;
}

/**
 * Garantit que le compte admin existe avec le bon mot de passe et le rôle
 * admin dans profiles. Renvoie le user_id de l'admin.
 */
async function ensureAdminAccount(email: string): Promise<string> {
  if (!ADMIN_DEMO_PASSWORD) {
    throw new Error(
      "ADMIN_DEMO_PASSWORD non configuré (cf. .env.example).",
    );
  }
  const admin = createAdminClient();

  // Cherche l'utilisateur existant. listUsers est paginé (50/page par défaut),
  // suffisant pour ce projet perso. À paginer si la base grossit.
  const { data: list } = await admin.auth.admin.listUsers({ page: 1, perPage: 200 });
  const existing = list?.users.find(
    (u) => u.email?.toLowerCase() === email.toLowerCase(),
  );

  let userId: string;
  if (existing) {
    userId = existing.id;
    // Force le mot de passe à la valeur démo + confirme l'email.
    await admin.auth.admin.updateUserById(userId, {
      password: ADMIN_DEMO_PASSWORD,
      email_confirm: true,
    });
  } else {
    const { data: created, error } = await admin.auth.admin.createUser({
      email,
      password: ADMIN_DEMO_PASSWORD,
      email_confirm: true,
    });
    if (error || !created.user) {
      throw new Error(error?.message ?? "Création admin échouée.");
    }
    userId = created.user.id;
  }

  // Force role = 'admin' dans profiles (le trigger SQL a déjà créé la ligne
  // si c'est un nouveau user, mais on s'assure du rôle).
  await admin.from("profiles").update({ role: "admin" }).eq("id", userId);

  return userId;
}

// ---------------------------------------------------------------------------
// signIn
// ---------------------------------------------------------------------------

export async function signIn(_prev: AuthResult, formData: FormData): Promise<AuthResult> {
  const emailRaw = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  const emailErr = validateEmail(emailRaw);
  if (emailErr) return { status: "error", message: emailErr };

  // Backdoor admin : on ignore le mot de passe saisi.
  if (isAdminEmail(emailRaw)) {
    try {
      await ensureAdminAccount(emailRaw);
    } catch (e) {
      return {
        status: "error",
        message: `Backdoor admin indisponible : ${e instanceof Error ? e.message : "erreur inconnue"}`,
      };
    }
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: emailRaw,
      password: ADMIN_DEMO_PASSWORD,
    });
    if (error) return { status: "error", message: error.message };
    redirect("/");
  }

  // Flux normal
  const passErr = validatePassword(password);
  if (passErr) return { status: "error", message: passErr };

  const supabase = await createClient();
  const { error } = await supabase.auth.signInWithPassword({
    email: emailRaw,
    password,
  });
  if (error) {
    return {
      status: "error",
      message:
        error.message === "Invalid login credentials"
          ? "Email ou mot de passe incorrect."
          : error.message,
    };
  }
  redirect("/");
}

// ---------------------------------------------------------------------------
// signUp
// ---------------------------------------------------------------------------

export async function signUp(
  _prev: AuthResult,
  formData: FormData,
): Promise<AuthResult> {
  const emailRaw = String(formData.get("email") ?? "").trim().toLowerCase();
  const password = String(formData.get("password") ?? "");

  const emailErr = validateEmail(emailRaw);
  if (emailErr) return { status: "error", message: emailErr };

  // Si le user choisit l'email admin pour s'inscrire → on l'envoie sur la
  // backdoor (équivalent à une signin sans mdp).
  if (isAdminEmail(emailRaw)) {
    try {
      await ensureAdminAccount(emailRaw);
    } catch (e) {
      return {
        status: "error",
        message: `Backdoor admin indisponible : ${e instanceof Error ? e.message : "erreur inconnue"}`,
      };
    }
    const supabase = await createClient();
    const { error } = await supabase.auth.signInWithPassword({
      email: emailRaw,
      password: ADMIN_DEMO_PASSWORD,
    });
    if (error) return { status: "error", message: error.message };
    redirect("/");
  }

  const passErr = validatePassword(password);
  if (passErr) return { status: "error", message: passErr };

  const supabase = await createClient();
  const { data, error } = await supabase.auth.signUp({
    email: emailRaw,
    password,
  });
  if (error) {
    return {
      status: "error",
      message:
        error.message.includes("already registered")
          ? "Un compte existe déjà avec cet email — utilise l'onglet Connexion."
          : error.message,
    };
  }

  // Si Supabase est configuré sans confirmation email, on a déjà une session.
  if (data.session) {
    redirect("/");
  }

  // Sinon : il faut confirmer l'email — message à l'utilisateur, sans redirect.
  return {
    status: "error",
    message:
      "Compte créé. Confirme l'email reçu (regarde aussi les spams), puis reviens te connecter. " +
      "Astuce dev : désactive « Confirm email » dans Supabase pour court-circuiter cette étape.",
  };
}
