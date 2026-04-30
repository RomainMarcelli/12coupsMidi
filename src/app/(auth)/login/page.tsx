import Image from "next/image";
import { getBranding } from "@/lib/branding";
import { LoginForm } from "./login-form";

export const metadata = {
  title: "Connexion",
};

/**
 * K4 — Page publique pré-auth : on ne sait pas encore si l'utilisateur
 * est owner. Affichage du branding générique.
 */
export default function LoginPage() {
  const branding = getBranding(false);
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 p-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="relative">
          <div className="absolute inset-0 -z-10 animate-sun-pulse rounded-full bg-gold/30 blur-3xl" />
          <Image
            src={branding.logoUrl}
            alt=""
            width={160}
            height={160}
            className="h-20 w-20 object-contain drop-shadow-[0_8px_32px_rgba(245,183,0,0.45)]"
            priority
          />
        </div>
        <h1 className="font-display text-3xl font-extrabold text-foreground">
          {branding.prefixWord}{" "}
          <span className="text-gold-warm">{branding.accentWord}</span>{" "}
          {branding.suffixWord}
        </h1>
        <p className="text-sm text-foreground/70">
          Entraîne-toi aux 12 Coups de Midi.
        </p>
      </div>

      <LoginForm />

      <p className="max-w-xs text-center text-xs text-foreground/50">
        En t'inscrivant, tu acceptes que cette app soit purement personnelle —
        pas de données revendues, pas de pub.
      </p>
    </main>
  );
}
