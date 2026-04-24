import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { ImportForm } from "./import-form";

export const metadata = {
  title: "Admin — Import JSON",
};

export default async function ImportQuestionsPage() {
  await requireAdmin();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <Link
        href="/admin/questions"
        className="flex items-center gap-1 self-start text-sm text-navy/70 transition-colors hover:text-gold"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Retour à la liste
      </Link>

      <header className="flex flex-col gap-2">
        <h1 className="font-display text-3xl font-extrabold text-navy">
          Importer un fichier JSON
        </h1>
        <p className="text-sm text-navy/70">
          Dépose un fichier .json (tableau de questions) ou colle le contenu
          dans la zone. Le schéma est validé avant l'insertion, tu vois un
          aperçu.
        </p>
      </header>

      <ImportForm />

      <details className="rounded-xl border border-border bg-card/50 p-4 text-sm text-navy/80">
        <summary className="cursor-pointer font-semibold text-gold">
          Format attendu
        </summary>
        <pre className="mt-3 overflow-x-auto rounded-md bg-cream-deep p-3 text-xs">
{`[
  {
    "type": "quizz_2",
    "category_slug": "histoire",
    "subcategory_slug": "xxe",
    "difficulte": 2,
    "enonce": "En quelle année a eu lieu le débarquement ?",
    "reponses": [
      { "text": "1944", "correct": true },
      { "text": "1945", "correct": false }
    ],
    "explication": "Le 6 juin 1944."
  },
  {
    "type": "etoile",
    "category_slug": "art",
    "difficulte": 3,
    "enonce": "Qui suis-je ?",
    "bonne_reponse": "Picasso",
    "alias": ["Pablo Picasso"],
    "indices": ["Peintre espagnol", "Cubisme", "Guernica"],
    "reponses": []
  }
]`}
        </pre>
      </details>
    </main>
  );
}
