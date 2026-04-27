import { Grid3x3 } from "lucide-react";
import Link from "next/link";

export function NoRoundsPlaceholder() {
  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col items-center justify-center gap-6 p-8 text-center">
      <div className="flex h-20 w-20 items-center justify-center rounded-2xl bg-sky/15 text-sky">
        <Grid3x3 className="h-10 w-10" aria-hidden="true" />
      </div>
      <h1 className="font-display text-3xl font-extrabold text-foreground">
        Pas de thèmes disponibles
      </h1>
      <p className="text-foreground/70">
        Il n'y a pas encore de question de type <code>coup_par_coup</code> en
        base. Lance la migration <code>0003_coup_par_coup.sql</code> et{" "}
        <code>npm run seed</code>.
      </p>
      <Link
        href="/"
        className="rounded-md bg-gold px-4 py-2 font-semibold text-on-color shadow-[0_4px_0_0_#e89e00]"
      >
        Retour accueil
      </Link>
    </main>
  );
}
