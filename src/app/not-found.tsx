import { Home } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { getBranding } from "@/lib/branding";

export const metadata = {
  title: "Page introuvable",
};

/**
 * 404 globale — affichée pour toute route qui n'a pas de page.tsx.
 * Pas de navbar ici (elle dépend du layout (app)) : on reconstruit un layout
 * minimal sur fond cream.
 *
 * K4 — Branding générique (404 peut s'afficher avant l'auth).
 */
export default function NotFound() {
  const branding = getBranding(false);
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="relative">
        <div className="absolute inset-0 -z-10 animate-sun-pulse rounded-full bg-gold/30 blur-3xl" />
        <Image
          src={branding.logoUrl}
          alt={branding.appName}
          width={224}
          height={224}
          className="h-28 w-28 object-contain drop-shadow-[0_8px_32px_rgba(245,183,0,0.45)]"
          priority
        />
      </div>

      <div className="flex flex-col gap-2">
        <p className="font-display text-7xl font-extrabold text-gold-warm">
          404
        </p>
        <h1 className="font-display text-2xl font-bold text-foreground sm:text-3xl">
          Page introuvable
        </h1>
        <p className="max-w-md text-foreground/70">
          Cette section n'existe pas encore, ou tu t'es aventuré sur une URL
          inconnue. Retour à l'accueil.
        </p>
      </div>

      <Link
        href="/"
        className="flex items-center gap-2 rounded-lg bg-gold px-5 py-3 font-bold text-on-color shadow-[0_4px_0_0_#e89e00] transition-all hover:-translate-y-px hover:shadow-[0_6px_20px_rgba(245,183,0,0.55)] active:translate-y-px active:shadow-[0_2px_0_0_#e89e00]"
      >
        <Home className="h-4 w-4" aria-hidden="true" />
        Accueil
      </Link>
    </main>
  );
}
