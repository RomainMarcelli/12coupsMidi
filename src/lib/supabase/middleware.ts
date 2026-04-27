import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import type { Database } from "@/types/database";

const PUBLIC_PATHS = new Set<string>(["/login"]);

function isPublicPath(pathname: string) {
  if (PUBLIC_PATHS.has(pathname)) return true;
  if (pathname.startsWith("/auth/")) return true;
  // Mode TV Soirée : les téléphones invités rejoignent une room sans
  // login. Les routes /play/* sont donc publiques (la sécurité est
  // assurée par le code à 4 chiffres + le player_token).
  if (pathname.startsWith("/play/") || pathname === "/play") return true;
  return false;
}

/**
 * Rafraîchit la session Supabase à chaque requête et redirige vers /login
 * si l'utilisateur n'est pas authentifié sur une route protégée.
 *
 * Appelé depuis src/proxy.ts (Next.js 16 : "middleware" a été renommé "proxy").
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value),
          );
          response = NextResponse.next({ request });
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options),
          );
        },
      },
    },
  );

  // IMPORTANT : entre createServerClient et cette ligne, aucun code ne doit
  // s'exécuter — cela interférerait avec le rafraîchissement du token.
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user && !isPublicPath(request.nextUrl.pathname)) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    url.searchParams.set("next", request.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  return response;
}
