import { type NextRequest } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Next.js 16 : "middleware" a été renommé "proxy".
 * Fichier attendu à src/proxy.ts, au même niveau que src/app.
 * Cf. node_modules/next/dist/docs/01-app/01-getting-started/16-proxy.md
 */
export async function proxy(request: NextRequest) {
  return await updateSession(request);
}

export const config = {
  matcher: [
    /*
     * Match toutes les routes sauf :
     * - _next/static (assets)
     * - _next/image (optimisation images)
     * - favicon, icônes PWA, manifest
     * - fichiers statiques (images, sons)
     * - sw.js (service worker Serwist)
     */
    "/((?!_next/static|_next/image|favicon.ico|manifest.json|sw.js|icons/|sounds/|.*\\.(?:svg|png|jpg|jpeg|gif|webp|mp3|wav|ogg)$).*)",
  ],
};
