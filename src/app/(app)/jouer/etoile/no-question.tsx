import { Star } from "lucide-react";
import Link from "next/link";

export function NoQuestionPlaceholder() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-sky/15 text-sky">
        <Star className="h-10 w-10" aria-hidden="true" />
      </div>
      <h1 className="font-display text-3xl font-extrabold text-navy">
        Aucune étoile disponible
      </h1>
      <p className="text-navy/70">
        Il n'y a pas encore de question de type <code>etoile</code> en base.
        Ajoute-en via l'admin ou lance le seed.
      </p>
      <Link
        href="/"
        className="rounded-md bg-gold px-4 py-2 font-semibold text-navy shadow-[0_4px_0_0_#e89e00]"
      >
        Retour accueil
      </Link>
    </main>
  );
}
