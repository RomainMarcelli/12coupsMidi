import { Sword } from "lucide-react";
import Link from "next/link";

export function NoFafQuestions() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-buzz/15 text-buzz">
        <Sword className="h-10 w-10" aria-hidden="true" />
      </div>
      <h1 className="font-display text-3xl font-extrabold text-navy">
        Pas assez de questions
      </h1>
      <p className="text-navy/70">
        Il faut au moins 5 questions de type <code>face_a_face</code> en base
        pour lancer le duel. Importe-les depuis{" "}
        <code>/admin/questions/import</code> ou lance{" "}
        <code>npm run seed</code>.
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
