import { WifiOff } from "lucide-react";
import Link from "next/link";

export const metadata = { title: "Hors ligne" };

/**
 * L+ — Page de fallback pour le mode hors-ligne (PWA).
 *
 * Servie par le Service Worker Serwist quand une page non cachée est
 * demandée sans réseau. Volontairement minimale : pas de fetch, pas
 * d'image distante, charge même sans connexion.
 */
export default function OfflinePage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-foreground/10">
        <WifiOff
          className="h-10 w-10 text-foreground/60"
          aria-hidden="true"
        />
      </div>
      <div className="flex flex-col gap-2">
        <h1 className="font-display text-3xl font-extrabold text-foreground sm:text-4xl">
          Pas de connexion
        </h1>
        <p className="max-w-md text-foreground/70">
          Tu es hors ligne. Vérifie ta connexion puis réessaye. Les
          pages déjà visitées restent accessibles depuis le cache.
        </p>
      </div>
      <Link
        href="/"
        className="rounded-lg bg-gold px-5 py-3 font-bold text-on-color shadow-[0_4px_0_0_#e89e00] transition-all hover:-translate-y-px hover:shadow-[0_6px_20px_rgba(245,183,0,0.55)]"
      >
        Retour à l&apos;accueil
      </Link>
    </main>
  );
}
