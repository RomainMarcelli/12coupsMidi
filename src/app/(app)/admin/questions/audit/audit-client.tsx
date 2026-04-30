"use client";

import { useState, useTransition } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  EyeOff,
  Loader2,
  ShieldCheck,
  Trash2,
  X,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";
import {
  mergeDuplicateQuestions,
  type AuditDuplicateGroup,
  type AuditDuplicateRow,
  type MergeResult,
} from "../actions";

interface AuditClientProps {
  groups: AuditDuplicateGroup[];
  totalQuestions: number;
}

/**
 * K2.2 + K2.3 + L2.1 — UI cliente de l'audit doublons.
 *
 * L2.1 — Pour chaque groupe, on affiche maintenant l'énoncé + les
 * réponses + la catégorie de CHAQUE question (canonique + doublons),
 * pour que l'admin puisse comparer visuellement avant de fusionner.
 * Bouton "Ignorer" qui retire le groupe de la session courante (pas
 * de persistance — juste utile pour cleanup visuel).
 */
export function AuditClient({ groups, totalQuestions }: AuditClientProps) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [confirmGroup, setConfirmGroup] = useState<AuditDuplicateGroup | null>(
    null,
  );
  const [results, setResults] = useState<Record<string, MergeResult>>({});
  // L2.1 — IDs de groupes "ignorés" pour la session.
  const [ignored, setIgnored] = useState<Set<string>>(new Set());

  const visibleGroups = groups.filter((g) => !ignored.has(g.canonical.id));

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

  const totalDuplicates = visibleGroups.reduce(
    (acc, g) => acc + g.duplicates.length,
    0,
  );

  function onMerge(group: AuditDuplicateGroup) {
    setConfirmGroup(null);
    const dupIds = group.duplicates.map((d) => d.id);
    startTransition(async () => {
      const res = await mergeDuplicateQuestions(group.canonical.id, dupIds);
      setResults((r) => ({ ...r, [group.canonical.id]: res }));
      if (res.status === "ok") {
        router.refresh();
      }
    });
  }

  function onIgnore(group: AuditDuplicateGroup) {
    setIgnored((s) => new Set(s).add(group.canonical.id));
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-md border border-buzz/40 bg-buzz/10 p-4 text-sm text-foreground">
        <div className="flex items-center gap-2 text-buzz">
          <AlertTriangle className="h-4 w-4" aria-hidden="true" />
          <p className="font-bold">
            {visibleGroups.length} groupe
            {visibleGroups.length > 1 ? "s" : ""} de doublons restant
            {visibleGroups.length > 1 ? "s" : ""}
            {ignored.size > 0 && (
              <span className="ml-2 text-xs font-normal text-foreground/60">
                ({ignored.size} ignoré{ignored.size > 1 ? "s" : ""} pour cette
                session)
              </span>
            )}
          </p>
        </div>
        <p className="mt-1 text-xs text-foreground/70">
          {totalDuplicates} question{totalDuplicates > 1 ? "s" : ""} pourrait
          être fusionnée{totalDuplicates > 1 ? "s" : ""} dans
          {visibleGroups.length > 1 ? " leurs " : " sa "}canonique
          {visibleGroups.length > 1 ? "s" : ""}, sur {totalQuestions} au total.
        </p>
      </div>

      {visibleGroups.map((group) => {
        const result = results[group.canonical.id];
        return (
          <article
            key={group.canonical.id}
            className="rounded-xl border border-border bg-card p-4"
          >
            <header className="mb-3 flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="rounded-full bg-buzz/15 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-buzz">
                  {group.count}× doublon
                </span>
                <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-foreground/60">
                  {group.canonical.type}
                </span>
                {group.canonical.category_nom && (
                  <span className="rounded-full bg-muted px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider text-foreground/60">
                    {group.canonical.category_nom}
                  </span>
                )}
              </div>
              {result?.status === "ok" ? (
                <span className="inline-flex items-center gap-1 text-xs font-bold text-life-green">
                  <CheckCircle2 className="h-4 w-4" aria-hidden="true" />
                  Fusionné — {result.transferred?.deleted ?? 0} suppression
                  {(result.transferred?.deleted ?? 0) > 1 ? "s" : ""}
                </span>
              ) : result?.status === "error" ? (
                <span className="text-xs text-buzz">{result.message}</span>
              ) : (
                <div className="flex items-center gap-2">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => onIgnore(group)}
                    disabled={pending}
                  >
                    <EyeOff className="h-4 w-4" aria-hidden="true" />
                    Ignorer
                  </Button>
                  <Button
                    variant="gold"
                    size="sm"
                    onClick={() => setConfirmGroup(group)}
                    disabled={pending}
                  >
                    <Trash2 className="h-4 w-4" aria-hidden="true" />
                    Fusionner ({group.duplicates.length})
                  </Button>
                </div>
              )}
            </header>

            {/* L2.1 — Card canonique en encart vert */}
            <QuestionDetail
              row={group.canonical}
              role="canonical"
            />

            {/* L2.1 — Cards doublons en encart rouge */}
            <div className="mt-3 flex flex-col gap-3">
              {group.duplicates.map((d) => (
                <QuestionDetail key={d.id} row={d} role="duplicate" />
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

/**
 * L2.1 — Card détaillée d'une question (canonique ou doublon) :
 * énoncé + réponses + bonne_reponse + alias + indices selon le type.
 */
function QuestionDetail({
  row,
  role,
}: {
  row: AuditDuplicateRow;
  role: "canonical" | "duplicate";
}) {
  const isCanonical = role === "canonical";
  return (
    <div
      className={cn(
        "rounded-lg border p-3 text-sm",
        isCanonical
          ? "border-life-green/40 bg-life-green/5"
          : "border-buzz/40 bg-buzz/5",
      )}
    >
      <div className="mb-2 flex flex-wrap items-center gap-2 text-[11px] font-bold uppercase tracking-wider">
        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5",
            isCanonical
              ? "bg-life-green/15 text-life-green"
              : "bg-buzz/15 text-buzz",
          )}
        >
          {isCanonical ? "✓ Canonique" : "✗ Doublon"}
        </span>
        <Link
          href={`/admin/questions/${row.id}`}
          target="_blank"
          rel="noreferrer"
          className="font-mono text-xs text-foreground/70 underline hover:text-gold"
        >
          {row.id.slice(0, 8)}
        </Link>
        <span className="text-foreground/50">
          {new Date(row.created_at).toLocaleString("fr-FR", {
            dateStyle: "short",
            timeStyle: "short",
          })}
        </span>
      </div>

      <p className="font-display text-base font-bold text-foreground">
        {row.enonce}
      </p>

      {/* Réponses selon le type */}
      <div className="mt-2">
        {(row.type === "quizz_2" ||
          row.type === "quizz_4" ||
          row.type === "coup_par_coup") &&
          row.reponses.length > 0 && (
            <ul className="flex flex-col gap-1 text-xs text-foreground/80">
              {row.reponses.map((r, i) => (
                <li key={i} className="flex items-start gap-2">
                  {r.correct ? (
                    <Check
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 text-life-green"
                      aria-hidden="true"
                    />
                  ) : (
                    <X
                      className="mt-0.5 h-3.5 w-3.5 shrink-0 text-buzz"
                      aria-hidden="true"
                    />
                  )}
                  <span className={r.correct ? "text-life-green" : ""}>
                    {r.text}
                  </span>
                </li>
              ))}
            </ul>
          )}

        {(row.type === "face_a_face" ||
          row.type === "etoile" ||
          row.type === "coup_maitre") &&
          row.bonne_reponse && (
            <div className="text-xs">
              <p>
                <span className="text-foreground/60">Bonne réponse : </span>
                <strong className="text-life-green">{row.bonne_reponse}</strong>
              </p>
              {row.alias.length > 0 && (
                <p className="mt-1 text-foreground/60">
                  Alias :{" "}
                  <span className="text-foreground/80">
                    {row.alias.join(", ")}
                  </span>
                </p>
              )}
              {(row.type === "etoile" || row.type === "coup_maitre") && (
                <p className="mt-1 text-foreground/60">
                  {row.indices_count} indice
                  {row.indices_count > 1 ? "s" : ""}
                </p>
              )}
            </div>
          )}
      </div>
    </div>
  );
}
