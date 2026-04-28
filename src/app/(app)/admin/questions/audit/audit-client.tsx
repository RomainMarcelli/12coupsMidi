"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  CheckCircle2,
  Loader2,
  ShieldCheck,
  Trash2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  mergeDuplicateQuestions,
  type AuditDuplicateGroup,
  type MergeResult,
} from "../actions";

interface AuditClientProps {
  groups: AuditDuplicateGroup[];
  totalQuestions: number;
}

/**
 * K2.2 + K2.3 — UI cliente de l'audit doublons :
 *   - Liste des groupes (canonique + doublons listés)
 *   - Bouton "Fusionner" par groupe → confirmation modale → action
 *   - État local : flash de succès / erreur par groupe
 */
export function AuditClient({ groups, totalQuestions }: AuditClientProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmGroup, setConfirmGroup] = useState<AuditDuplicateGroup | null>(
    null,
  );
  const [results, setResults] = useState<Record<string, MergeResult>>({});

  if (groups.length === 0) {
    return (
      <div
        role="status"
        className="rounded-2xl border border-life-green/40 bg-life-green/10 p-6 text-life-green"
      >
        <div className="flex items-center gap-2">
          <ShieldCheck className="h-5 w-5" aria-hidden="true" />
          <p className="font-display text-lg font-bold">
            Aucun doublon détecté.
          </p>
        </div>
        <p className="mt-2 text-sm text-foreground/70">
          La base contient {totalQuestions} questions, toutes uniques selon
          la signature de comparaison.
        </p>
      </div>
    );
  }

  const totalDuplicates = groups.reduce((acc, g) => acc + g.duplicates.length, 0);

  function onMerge(group: AuditDuplicateGroup) {
    setConfirmGroup(null);
    const dupIds = group.duplicates.map((d) => d.id);
    startTransition(async () => {
      const res = await mergeDuplicateQuestions(group.canonical.id, dupIds);
      setResults((r) => ({ ...r, [group.canonical.id]: res }));
      if (res.status === "ok") {
        // Force le re-render avec les nouveaux groupes (un fusionné
        // ne revient plus dans le scan suivant).
        router.refresh();
      }
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-md border border-buzz/40 bg-buzz/10 p-4 text-sm text-foreground">
        <div className="flex items-center gap-2 text-buzz">
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          <p className="font-bold">
            {groups.length} groupe{groups.length > 1 ? "s" : ""} de doublons
            détecté{groups.length > 1 ? "s" : ""}
          </p>
        </div>
        <p className="mt-1 text-xs text-foreground/70">
          {totalDuplicates} question{totalDuplicates > 1 ? "s" : ""} pourrait
          être fusionnée{totalDuplicates > 1 ? "s" : ""} dans
          {groups.length > 1 ? " leurs " : " sa "}canonique
          {groups.length > 1 ? "s" : ""}, sur {totalQuestions} au total.
        </p>
      </div>

      {groups.map((group) => {
        const result = results[group.canonical.id];
        return (
          <article
            key={group.canonical.id}
            className="rounded-xl border border-border bg-card p-4"
          >
            <header className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-buzz/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-buzz">
                  {group.count}× doublon
                </span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-foreground/60">
                  {group.canonical.type}
                </span>
                {group.canonical.category_slug && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-foreground/60">
                    {group.canonical.category_slug}
                  </span>
                )}
              </div>
              {result?.status === "ok" ? (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-life-green">
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  Fusionné — {result.transferred?.deleted ?? 0} question
                  {(result.transferred?.deleted ?? 0) > 1 ? "s" : ""}{" "}
                  supprimée{(result.transferred?.deleted ?? 0) > 1 ? "s" : ""}
                </span>
              ) : result?.status === "error" ? (
                <span className="text-xs text-buzz">{result.message}</span>
              ) : (
                <Button
                  variant="gold"
                  size="sm"
                  onClick={() => setConfirmGroup(group)}
                  disabled={pending}
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  Fusionner ({group.duplicates.length})
                </Button>
              )}
            </header>

            <p className="mt-3 font-display text-base font-bold text-foreground">
              {group.canonical.enonce}
            </p>
            {group.canonical.bonne_reponse && (
              <p className="mt-1 text-sm text-foreground/65">
                Réponse :{" "}
                <strong className="text-life-green">
                  {group.canonical.bonne_reponse}
                </strong>
              </p>
            )}

            <div className="mt-3 grid gap-2 text-xs">
              <p className="font-semibold text-life-green">
                ✓ Canonique (la plus ancienne) —{" "}
                <Link
                  href={`/admin/questions/${group.canonical.id}`}
                  className="font-mono underline hover:text-gold"
                >
                  {group.canonical.id.slice(0, 8)}
                </Link>{" "}
                <span className="text-foreground/50">
                  ({new Date(group.canonical.created_at).toLocaleDateString("fr-FR")})
                </span>
              </p>
              {group.duplicates.map((d) => (
                <p key={d.id} className="text-foreground/70">
                  ✗ Doublon —{" "}
                  <Link
                    href={`/admin/questions/${d.id}`}
                    className="font-mono underline hover:text-gold"
                  >
                    {d.id.slice(0, 8)}
                  </Link>{" "}
                  <span className="text-foreground/50">
                    ({new Date(d.created_at).toLocaleDateString("fr-FR")})
                  </span>
                </p>
              ))}
            </div>
          </article>
        );
      })}

      {/* Modal de confirmation */}
      {confirmGroup && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-foreground/60 p-4"
          onClick={() => setConfirmGroup(null)}
        >
          <div
            className="max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <h2 className="font-display text-xl font-extrabold text-foreground">
              Fusionner {confirmGroup.duplicates.length + 1} question
              {confirmGroup.duplicates.length > 0 ? "s" : ""} en 1 ?
            </h2>
            <p className="mt-2 text-sm text-foreground/70">
              La question canonique ({confirmGroup.canonical.id.slice(0, 8)})
              sera conservée. Les {confirmGroup.duplicates.length}{" "}
              doublon{confirmGroup.duplicates.length > 1 ? "s" : ""} seront
              supprimé{confirmGroup.duplicates.length > 1 ? "s" : ""}, et
              tous les favoris / erreurs / défis qui les référencent seront
              transférés vers la canonique.
            </p>
            <p className="mt-2 text-xs text-buzz">
              <AlertTriangle
                className="mr-1 inline-block h-3 w-3"
                aria-hidden="true"
              />
              Action irréversible.
            </p>
            <div className="mt-4 flex justify-end gap-2">
              <Button
                variant="ghost"
                size="sm"
                onClick={() => setConfirmGroup(null)}
                disabled={pending}
              >
                Annuler
              </Button>
              <Button
                variant="gold"
                size="sm"
                onClick={() => onMerge(confirmGroup)}
                disabled={pending}
              >
                {pending ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                    Fusion en cours…
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    Confirmer la fusion
                  </>
                )}
              </Button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
