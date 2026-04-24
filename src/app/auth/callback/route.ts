import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import type { EmailOtpType } from "@supabase/supabase-js";

/**
 * Callback du magic link Supabase.
 *
 * Supporte deux formats :
 *  - `?code=...&next=/` (OAuth / PKCE code flow)
 *  - `?token_hash=...&type=magiclink&next=/` (email OTP)
 *
 * Le format dépend du template d'email configuré dans le dashboard Supabase
 * (Auth → Email templates → "Magic Link"). Par défaut Supabase utilise
 * `{{ .ConfirmationURL }}` qui est un OTP ; certains projets personnalisent
 * pour utiliser un code PKCE. On gère les deux.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url);
  const code = searchParams.get("code");
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type") as EmailOtpType | null;
  const next = searchParams.get("next") ?? "/";

  const supabase = await createClient();

  if (code) {
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`,
    );
  }

  if (tokenHash && type) {
    const { error } = await supabase.auth.verifyOtp({
      token_hash: tokenHash,
      type,
    });
    if (!error) {
      return NextResponse.redirect(`${origin}${next}`);
    }
    return NextResponse.redirect(
      `${origin}/login?error=${encodeURIComponent(error.message)}`,
    );
  }

  return NextResponse.redirect(
    `${origin}/login?error=${encodeURIComponent("Lien invalide ou expiré.")}`,
  );
}
