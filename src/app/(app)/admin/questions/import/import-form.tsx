"use client";

import Link from "next/link";
import { useMemo, useState, useTransition } from "react";
import { AlertTriangle, ArrowRight, FileUp, Info, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  questionsBulkSchema,
  type QuestionInput,
} from "@/lib/schemas/question";
import { importQuestionsBulk, type ImportResult } from "../actions";
import {
  extractInconsistentFormatFromRaw,
  extractSuspiciousFromRaw,
  type InconsistentFormatEntry,
  type SuspiciousEntry,
} from "./detect-suspicious";

/**
 * G1.1 — Résultat du parse en 2 niveaux :
 *   - JSON parse error → `kind: "json-error"` (bloque tout)
 *   - JSON valide mais Zod KO → `kind: "zod-error"` (bloque l'import)
 *   - JSON valide + Zod OK → `kind: "ok"` (autorise l'import)
 *
 * Dans tous les cas où le JSON est valide on calcule en plus
 * `suspicious[]` à partir des objets bruts, pour afficher le warning
 * gold même si Zod échoue (cas typique : `categorie_id` au lieu de
 * `category_slug` → l'utilisateur voit aussi que la réponse est dans
 * l'énoncé).
 */
type Parsed =
  | { kind: "empty" }
  | { kind: "json-error"; error: string }
  | {
      kind: "zod-error";
      error: string;
      issues: string[];
      suspicious: SuspiciousEntry[];
      inconsistent: InconsistentFormatEntry[];
    }
  | {
      kind: "ok";
      data: QuestionInput[];
      suspicious: SuspiciousEntry[];
      inconsistent: InconsistentFormatEntry[];
    };

function parseRaw(raw: string): Parsed {
  if (!raw.trim()) return { kind: "empty" };
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (e) {
    return {
      kind: "json-error",
      error: `JSON invalide : ${e instanceof Error ? e.message : "parse error"}`,
    };
  }
  // Suspectes calculées AVANT Zod, pour qu'elles s'affichent même
  // quand la validation échoue.
  const suspicious = extractSuspiciousFromRaw(json);
  // I2.3 — Détection format incohérent (Coup par Coup avec mix de
  // propositions à parenthèses et sans). Affiché en warning gold mais
  // ne bloque pas l'import (informatif).
  const inconsistent = extractInconsistentFormatFromRaw(json);
  const parsed = questionsBulkSchema.safeParse(json);
  if (!parsed.success) {
    return {
      kind: "zod-error",
      error: `Validation échouée (${parsed.error.issues.length} erreur(s)).`,
      issues: parsed.error.issues
        .slice(0, 10)
        .map((i) => `[${i.path.join(".")}] ${i.message}`),
      suspicious,
      inconsistent,
    };
  }
  return { kind: "ok", data: parsed.data, suspicious, inconsistent };
}

export function ImportForm() {
  const [raw, setRaw] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const parsed = useMemo(() => parseRaw(raw), [raw]);

  // G1.1 — Les questions suspectes sont calculées dans parseRaw,
  // disponibles en mode "ok" ET "zod-error" pour qu'on puisse alerter
  // l'utilisateur sur les 2 types d'anomalies en parallèle.
  const suspicious =
    parsed.kind === "ok" || parsed.kind === "zod-error"
      ? parsed.suspicious
      : [];
  // I2.3 — Idem pour les questions à format incohérent (CPC avec mix
  // parenthèses/no-parenthèses). Affichage purement informatif —
  // on n'empêche pas l'import.
  const inconsistent =
    parsed.kind === "ok" || parsed.kind === "zod-error"
      ? parsed.inconsistent
      : [];

  async function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    const text = await file.text();
    setRaw(text);
    setResult(null);
  }

  function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (parsed.kind !== "ok") return;
    setResult(null);
    startTransition(async () => {
      const res = await importQuestionsBulk(parsed.data);
      setResult(res);
      // N (correction) — Plus de redirect automatique : l'admin reste
      // sur la page pour lire le récap (count importé, doublons,
      // warnings). Vide le textarea pour permettre un nouvel import
      // immédiat sans confusion.
      if (res.status === "ok") {
        setRaw("");
        if (typeof window !== "undefined") {
          window.scrollTo({ top: 0, behavior: "smooth" });
        }
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="rounded-xl border border-dashed border-border bg-card/30 p-6 text-center">
        <Upload
          className="mx-auto h-8 w-8 text-gold opacity-60"
          aria-hidden="true"
        />
        <p className="mt-2 text-sm text-foreground/70">Sélectionne un fichier .json</p>
        <input
          type="file"
          accept="application/json,.json"
          onChange={onFileChange}
          className="mt-3 block w-full cursor-pointer text-sm text-foreground file:mr-4 file:rounded-md file:border-0 file:bg-gold file:px-4 file:py-2 file:font-semibold file:text-midnight hover:file:bg-gold/90"
        />
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-semibold uppercase tracking-wider text-foreground/70">
          … ou colle le contenu JSON
        </span>
        <textarea
          value={raw}
          onChange={(e) => {
            setRaw(e.target.value);
            setResult(null);
          }}
          rows={12}
          placeholder='[ { "type": "quizz_2", ... } ]'
          className="w-full rounded-md border border-border bg-card p-3 font-mono text-xs text-foreground focus:border-gold focus:outline-none"
        />
      </label>

      {/* Preview */}
      {parsed.kind === "ok" && (
        <div className="rounded-md border border-life-green/30 bg-life-green/5 p-4">
          <p className="text-sm font-semibold text-life-green">
            Prêt à importer : {parsed.data.length} questions
          </p>
          <ul className="mt-2 flex flex-wrap gap-2 text-xs text-foreground/70">
            {Object.entries(countByType(parsed.data)).map(([t, n]) => (
              <li key={t} className="rounded bg-muted/50 px-2 py-1">
                {t} : {n}
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* G1.1 — Encart gold : questions suspectes (bonne_reponse
          contenue dans enonce). Affiché dès que des suspectes sont
          détectées, même en cas d'erreur Zod. N'empêche pas l'import
          si la validation passe par ailleurs. */}
      {suspicious.length > 0 && (
        <div
          role="alert"
          className="rounded-md border border-gold/50 bg-gold/10 p-4 text-sm text-foreground"
        >
          <p className="inline-flex items-center gap-2 font-bold text-gold-warm">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            {suspicious.length} question
            {suspicious.length > 1 ? "s" : ""} suspecte
            {suspicious.length > 1 ? "s" : ""} — vérifie la réponse
          </p>
          <p className="mt-1 text-xs text-foreground/70">
            La <strong>bonne_reponse</strong> apparaît dans l&apos;énoncé
            (signe possible de copier-coller raté). Tu peux quand même
            importer si c&apos;est volontaire.
          </p>
          <ul className="mt-2 max-h-40 list-disc overflow-y-auto pl-5 text-xs text-foreground/80">
            {suspicious.slice(0, 10).map((s) => (
              <li key={s.idx}>
                <strong>#{s.idx + 1}</strong> [{s.type}]{" "}
                <span className="italic">{s.enonce}</span> →{" "}
                <strong className="text-buzz">{s.bonneReponse}</strong>
              </li>
            ))}
            {suspicious.length > 10 && (
              <li>… et {suspicious.length - 10} autre(s).</li>
            )}
          </ul>
        </div>
      )}
      {/* I2.3 — Encart gold : format incohérent dans des questions CPC
          (mix de propositions avec et sans parenthèses). Informatif,
          ne bloque pas l'import. */}
      {inconsistent.length > 0 && (
        <div
          role="alert"
          className="rounded-md border border-gold/50 bg-gold/10 p-4 text-sm text-foreground"
        >
          <p className="inline-flex items-center gap-2 font-bold text-gold-warm">
            <AlertTriangle className="h-4 w-4" aria-hidden="true" />
            {inconsistent.length} question{inconsistent.length > 1 ? "s" : ""}{" "}
            Coup par Coup au format incohérent
          </p>
          <p className="mt-1 text-xs text-foreground/70">
            Certaines propositions ont des parenthèses (ex.{" "}
            <code>(1972, 3 Oscars)</code>) et d&apos;autres non. L&apos;intrus
            risque d&apos;être trop visible — harmonise (toutes avec ou
            toutes sans).
          </p>
          <ul className="mt-2 max-h-40 list-disc overflow-y-auto pl-5 text-xs text-foreground/80">
            {inconsistent.slice(0, 5).map((s) => (
              <li key={s.idx}>
                <strong>#{s.idx + 1}</strong>{" "}
                <span className="italic">{s.enonce}</span> —{" "}
                {s.withParens.length} avec parenthèses,{" "}
                {s.withoutParens.length} sans (
                <span className="text-buzz">
                  {s.withoutParens.slice(0, 3).join(", ")}
                  {s.withoutParens.length > 3 ? "…" : ""}
                </span>
                )
              </li>
            ))}
            {inconsistent.length > 5 && (
              <li>… et {inconsistent.length - 5} autre(s).</li>
            )}
          </ul>
        </div>
      )}
      {/* G1.1 — Encart rouge : erreurs Zod. Bloque l'import. */}
      {(parsed.kind === "json-error" || parsed.kind === "zod-error") && (
        <div className="rounded-md border border-buzz/40 bg-buzz/10 p-4 text-sm text-buzz">
          <p className="font-semibold">{parsed.error}</p>
          {parsed.kind === "zod-error" && (
            <ul className="mt-2 list-disc pl-5 text-xs">
              {parsed.issues.map((i, idx) => (
                <li key={idx}>{i}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      {/* Résultat du submit */}
      {result && result.status === "ok" && (
        <div
          role="status"
          className="rounded-md border border-life-green/40 bg-life-green/10 p-4 text-sm text-life-green"
        >
          <p className="font-semibold">
            {result.inserted} question{result.inserted > 1 ? "s" : ""} importée
            {result.inserted > 1 ? "s" : ""}.
          </p>
          {result.skipped > 0 && (
            <p className="mt-1">{result.skipped} ignorée(s).</p>
          )}
          {result.duplicates.length > 0 && (
            <p className="mt-1">
              {result.duplicates.length} doublon
              {result.duplicates.length > 1 ? "s" : ""} ignoré
              {result.duplicates.length > 1 ? "s" : ""} (déjà en BDD).
            </p>
          )}
          {result.warnings.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-xs text-foreground/70">
              {result.warnings.slice(0, 5).map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}
          <div className="mt-3 flex flex-wrap gap-2">
            <Link
              href="/admin/questions"
              className="inline-flex items-center gap-1.5 rounded-md border border-life-green/50 bg-life-green/5 px-3 py-1.5 text-xs font-semibold text-life-green transition-colors hover:bg-life-green/10"
            >
              Voir la liste
              <ArrowRight className="h-3 w-3" aria-hidden="true" />
            </Link>
          </div>
        </div>
      )}

      {/* K2.1 — Encart bleu informatif : doublons détectés au submit
          (côté serveur, sur la base existante). N'a PAS bloqué l'import,
          les autres questions ont été insérées. */}
      {result && result.status === "ok" && result.duplicates.length > 0 && (
        <div
          role="status"
          className="rounded-md border border-sky/40 bg-sky/10 p-4 text-sm text-foreground"
        >
          <p className="inline-flex items-center gap-2 font-bold text-sky">
            <Info className="h-4 w-4" aria-hidden="true" />
            {result.duplicates.length} doublon
            {result.duplicates.length > 1 ? "s" : ""} ignoré
            {result.duplicates.length > 1 ? "s" : ""} — existaient déjà en BDD
          </p>
          <p className="mt-1 text-xs text-foreground/70">
            Comparaison sur énoncé + catégorie (et bonne_reponse pour
            face_a_face / etoile / coup_maitre), normalisée sans accents
            ni ponctuation.
          </p>
          <ul className="mt-2 max-h-40 list-disc overflow-y-auto pl-5 text-xs text-foreground/80">
            {result.duplicates.slice(0, 10).map((d) => (
              <li key={d.index}>
                <strong>#{d.index + 1}</strong> [{d.type}/{d.category_slug}]{" "}
                <span className="italic">
                  {d.enonce.length > 60
                    ? `${d.enonce.slice(0, 60)}…`
                    : d.enonce}
                </span>{" "}
                →{" "}
                <Link
                  href={`/admin/questions/${d.existingId}`}
                  className="font-mono text-sky underline hover:text-sky/80"
                >
                  voir l&apos;originale
                </Link>
              </li>
            ))}
            {result.duplicates.length > 10 && (
              <li>… et {result.duplicates.length - 10} autre(s).</li>
            )}
          </ul>
        </div>
      )}
      {result && result.status === "error" && (
        <div
          role="alert"
          className="rounded-md border border-buzz/40 bg-buzz/10 p-4 text-sm text-buzz"
        >
          <p className="font-semibold">{result.message}</p>
          {result.issues && (
            <ul className="mt-2 list-disc pl-5 text-xs">
              {result.issues.map((i, idx) => (
                <li key={idx}>{i}</li>
              ))}
            </ul>
          )}
        </div>
      )}

      <Button
        type="submit"
        variant="gold"
        size="lg"
        disabled={parsed.kind !== "ok" || isPending}
      >
        <FileUp className="h-4 w-4" aria-hidden="true" />
        {isPending
          ? "Import en cours…"
          : parsed.kind === "ok"
            ? `Importer ${parsed.data.length} questions`
            : "Importer"}
      </Button>
    </form>
  );
}

function countByType(data: QuestionInput[]): Record<string, number> {
  const out: Record<string, number> = {};
  for (const q of data) out[q.type] = (out[q.type] ?? 0) + 1;
  return out;
}
