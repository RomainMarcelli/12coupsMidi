import Link from "next/link";
import { ChevronLeft } from "lucide-react";
import { requireAdmin } from "@/lib/auth/admin-guard";
import { auditDuplicateQuestions } from "../actions";
import { AuditClient } from "./audit-client";

export const metadata = {
  title: "Admin — Audit doublons",
};

export const dynamic = "force-dynamic";

/**
 * K2.2 — Page d'audit manuel des doublons. Lance le scan complet
 * de la base questions au chargement et affiche les groupes
 * détectés. Bouton "Fusionner" pour chaque groupe.
 */
export default async function AuditPage() {
  await requireAdmin();
  const result = await auditDuplicateQuestions();

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-6 p-4 sm:p-6 lg:p-8">
      <Link
        href="/admin/questions"
        className="flex items-center gap-1 self-start text-sm text-foreground/70 transition-colors hover:text-gold"
      >
        <ChevronLeft className="h-4 w-4" aria-hidden="true" />
        Retour à la liste
      </Link>

      <header className="flex flex-col gap-2">
        <h1 className="font-display text-3xl font-extrabold text-foreground">
          Audit des doublons
        </h1>
        <p className="text-sm text-foreground/70">
          Détecte les questions qui partagent la même signature
          (énoncé + catégorie [+ bonne_reponse pour face_a_face /
          etoile / coup_maitre]), normalisée sans accents ni
          ponctuation. La <strong>canonique</strong> est la plus
          ancienne ; la fusion transfère favoris, erreurs et défis
          vers elle, puis supprime les doublons.
        </p>
      </header>

      {result.status === "error" ? (
        <div
          role="alert"
          className="rounded-md border border-buzz/40 bg-buzz/10 p-4 text-sm text-buzz"
        >
          Erreur : {result.message}
        </div>
      ) : (
        <AuditClient
          groups={result.groups}
          totalQuestions={result.totalQuestions}
        />
      )}
    </main>
  );
}
