import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { Navbar } from "@/components/layout/Navbar";

/**
 * Layout (app) — Garde d'authentification.
 * Toute route placée sous le groupe (app)/ nécessite une session valide.
 * Le proxy (src/proxy.ts) pré-filtre déjà, mais on re-vérifie ici côté serveur
 * pour récupérer le pseudo et pour la défense en profondeur.
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
    .select("pseudo, role")
    .eq("id", user.id)
    .single();

  const pseudo = profile?.pseudo ?? user.email ?? "joueur";
  const role = profile?.role ?? "user";

  return (
    <div className="flex min-h-full flex-col bg-midnight">
      <Navbar pseudo={pseudo} role={role} />
      <div className="flex flex-1 flex-col">{children}</div>
    </div>
  );
}
