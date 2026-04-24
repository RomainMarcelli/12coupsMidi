import Image from "next/image";
import { LoginForm } from "./login-form";

export const metadata = {
  title: "Connexion",
};

export default function LoginPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 p-6">
      <div className="flex flex-col items-center gap-3 text-center">
        <div className="relative">
          <div className="absolute inset-0 -z-10 animate-sun-pulse rounded-full bg-gold/30 blur-3xl" />
          <Image
            src="/logo.svg"
            alt=""
            width={80}
            height={80}
            className="h-20 w-20"
            priority
          />
        </div>
        <h1 className="font-display text-3xl font-extrabold text-navy">
          Midi <span className="text-gold-warm">Master</span>
        </h1>
        <p className="text-sm text-navy/70">
          Entraîne-toi aux 12 Coups de Midi.
        </p>
      </div>

      <LoginForm />

      <p className="max-w-xs text-center text-xs text-navy/50">
        En t'inscrivant, tu acceptes que cette app soit purement personnelle —
        pas de données revendues, pas de pub.
      </p>
    </main>
  );
}
