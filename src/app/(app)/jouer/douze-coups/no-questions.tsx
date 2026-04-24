import { Crown } from "lucide-react";
import Link from "next/link";

export function NoQuestionsScreen({
  counts,
}: {
  counts: { quizz2: number; cpc: number; themes: number; faf: number };
}) {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-gold/15 text-gold-warm">
        <Crown className="h-10 w-10" aria-hidden="true" />
      </div>
      <h1 className="font-display text-3xl font-extrabold text-navy">
        Base de questions insuffisante
      </h1>
      <p className="text-navy/70">
        Pour lancer une partie complète des 12 Coups de Midi, il faut :
      </p>
      <ul className="flex flex-col gap-1 text-left text-sm text-navy/80">
        <li>
          Questions <code>quizz_2</code> : <strong>{counts.quizz2}</strong> /
          10 min
        </li>
        <li>
          Manches <code>coup_par_coup</code> :{" "}
          <strong>{counts.cpc}</strong> / 3 min
        </li>
        <li>
          Catégories avec <code>quizz_4</code> :{" "}
          <strong>{counts.themes}</strong> / 2 min
        </li>
        <li>
          Questions <code>face_a_face</code> : <strong>{counts.faf}</strong>{" "}
          / 5 min
        </li>
      </ul>
      <p className="text-sm text-navy/60">
        Lance <code>npm run seed</code> ou ajoute des questions depuis{" "}
        <code>/admin/questions/import</code>.
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
