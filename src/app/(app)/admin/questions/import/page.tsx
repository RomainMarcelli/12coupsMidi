import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { ImportForm } from "./import-form";
import { ImportFormatGuide } from "./_components/ImportFormatGuide";

export const metadata = {
  title: "Admin — Import JSON",
};

export default async function ImportQuestionsPage() {
  await requireAdmin();

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <Link
        href="/admin/questions"
        className="flex items-center gap-1 self-start text-sm text-foreground/70 transition-colors hover:text-gold"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Retour à la liste
      </Link>

      <header className="flex flex-col gap-2">
        <h1 className="font-display text-3xl font-extrabold text-foreground">
          Importer un fichier JSON
        </h1>
        <p className="text-sm text-foreground/70">
          Dépose un fichier .json (tableau de questions) ou colle le contenu
          dans la zone. Le schéma est validé avant l&apos;insertion, tu vois un
          aperçu.
        </p>
      </header>

      {/* M5.1 — Guide collapsible avec exemple JSON par type +
          bouton "Tester cet exemple" qui valide via Zod côté client. */}
      <ImportFormatGuide />

      <ImportForm />
    </main>
  );
}
