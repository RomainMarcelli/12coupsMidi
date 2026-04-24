"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { FileUp, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  questionsBulkSchema,
  type QuestionInput,
} from "@/lib/schemas/question";
import { importQuestionsBulk, type ImportResult } from "../actions";

type Parsed =
  | { kind: "empty" }
  | { kind: "invalid"; error: string; issues?: string[] }
  | { kind: "ok"; data: QuestionInput[] };

function parseRaw(raw: string): Parsed {
  if (!raw.trim()) return { kind: "empty" };
  let json: unknown;
  try {
    json = JSON.parse(raw);
  } catch (e) {
    return {
      kind: "invalid",
      error: `JSON invalide : ${e instanceof Error ? e.message : "parse error"}`,
    };
  }
  const parsed = questionsBulkSchema.safeParse(json);
  if (!parsed.success) {
    return {
      kind: "invalid",
      error: `Validation échouée (${parsed.error.issues.length} erreur(s)).`,
      issues: parsed.error.issues
        .slice(0, 10)
        .map((i) => `[${i.path.join(".")}] ${i.message}`),
    };
  }
  return { kind: "ok", data: parsed.data };
}

export function ImportForm() {
  const router = useRouter();
  const [raw, setRaw] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const parsed = useMemo(() => parseRaw(raw), [raw]);

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
      if (res.status === "ok") {
        // Laisse le temps de lire le récap puis retour à la liste
        setTimeout(() => router.push("/admin/questions"), 1500);
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-4">
      <div className="rounded-xl border border-dashed border-white/20 bg-card/30 p-6 text-center">
        <Upload
          className="mx-auto h-8 w-8 text-gold opacity-60"
          aria-hidden="true"
        />
        <p className="mt-2 text-sm text-cream/70">Sélectionne un fichier .json</p>
        <input
          type="file"
          accept="application/json,.json"
          onChange={onFileChange}
          className="mt-3 block w-full cursor-pointer text-sm text-cream file:mr-4 file:rounded-md file:border-0 file:bg-gold file:px-4 file:py-2 file:font-semibold file:text-midnight hover:file:bg-gold/90"
        />
      </div>

      <label className="flex flex-col gap-1">
        <span className="text-xs font-semibold uppercase tracking-wider text-cream/70">
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
          className="w-full rounded-md border border-white/15 bg-card p-3 font-mono text-xs text-cream focus:border-gold focus:outline-none"
        />
      </label>

      {/* Preview */}
      {parsed.kind === "ok" && (
        <div className="rounded-md border border-life-green/30 bg-life-green/5 p-4">
          <p className="text-sm font-semibold text-life-green">
            Prêt à importer : {parsed.data.length} questions
          </p>
          <ul className="mt-2 flex flex-wrap gap-2 text-xs text-cream/70">
            {Object.entries(countByType(parsed.data)).map(([t, n]) => (
              <li key={t} className="rounded bg-white/5 px-2 py-1">
                {t} : {n}
              </li>
            ))}
          </ul>
        </div>
      )}
      {parsed.kind === "invalid" && (
        <div className="rounded-md border border-buzz/40 bg-buzz/10 p-4 text-sm text-buzz">
          <p className="font-semibold">{parsed.error}</p>
          {parsed.issues && (
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
          {result.warnings.length > 0 && (
            <ul className="mt-2 list-disc pl-5 text-xs text-cream/70">
              {result.warnings.slice(0, 5).map((w, i) => (
                <li key={i}>{w}</li>
              ))}
            </ul>
          )}
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
