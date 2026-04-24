import { LoginForm } from "./login-form";
import { Trophy } from "lucide-react";

export const metadata = {
  title: "Connexion",
};

export default function LoginPage() {
  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-8 bg-[#0B1F4D] p-6 text-[#F1FAEE]">
      <div className="flex flex-col items-center gap-3 text-center">
        <Trophy className="h-12 w-12 text-[#F5C518]" aria-hidden="true" />
        <h1 className="text-3xl font-bold text-[#F5C518]">Midi Master</h1>
        <p className="text-sm opacity-70">
          Connecte-toi avec un lien magique envoyé par email.
        </p>
      </div>

      <LoginForm />

      <p className="max-w-xs text-center text-xs opacity-50">
        Pas de mot de passe. On t&apos;envoie un lien à usage unique sur ton
        email. Clique dessus depuis le même navigateur.
      </p>
    </main>
  );
}
