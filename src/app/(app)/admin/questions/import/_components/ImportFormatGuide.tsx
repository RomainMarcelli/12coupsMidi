"use client";

import { Check, ChevronDown, Copy, FileWarning, FileCheck } from "lucide-react";
import { useMemo, useState } from "react";
import { questionsBulkSchema } from "@/lib/schemas/question";
import { cn } from "@/lib/utils";
import { FORMATS, type FieldDoc, type FormatExample } from "./import-format-examples";

/**
 * M5.1 — Guide collapsible documentant le format JSON attendu pour
 * chaque type de question, affiché en haut de
 * `/admin/questions/import`.
 *
 * Pour chaque type, on documente :
 *   - quand il est utilisé (mode de jeu)
 *   - les champs requis et optionnels
 *   - les règles spécifiques (nombre de réponses, etc.)
 *   - un exemple JSON copiable
 *   - un bouton "Tester cet exemple" qui valide via
 *     `questionsBulkSchema.safeParse([example])` côté client
 *
 * Les exemples ont été vérifiés contre le schéma Zod : tous passent
 * `parseQuestionsBulk(example)` avec `success === true`. Si le schéma
 * évolue (`src/lib/schemas/question.ts`), il faut mettre à jour les
 * exemples ici ET dans `docs/IMPORT_FORMAT.md`.
 */

const GENERAL_FORMAT = `[
  { /* question 1 */ },
  { /* question 2 */ },
  ...
]`;

export function ImportFormatGuide() {
  const [open, setOpen] = useState(false);

  return (
    <details
      className="rounded-xl border border-border bg-card/60 text-sm text-foreground/85"
      open={open}
      onToggle={(e) => setOpen((e.target as HTMLDetailsElement).open)}
    >
      <summary className="flex cursor-pointer list-none items-center justify-between gap-2 px-4 py-3 font-semibold text-gold-warm">
        <span className="flex items-center gap-2">
          <FileCheck className="h-4 w-4" aria-hidden="true" />
          Voir le format attendu
        </span>
        <ChevronDown
          className={cn(
            "h-4 w-4 transition-transform",
            open && "rotate-180",
          )}
          aria-hidden="true"
        />
      </summary>

      <div className="flex flex-col gap-6 border-t border-border px-4 py-5">
        {/* Format général */}
        <section>
          <h3 className="font-display text-base font-bold text-foreground">
            Format général
          </h3>
          <p className="mt-1 text-foreground/70">
            Le fichier doit contenir un <strong>tableau JSON</strong> dont
            chaque élément est une question. Les <code>category_slug</code> /{" "}
            <code>subcategory_slug</code> sont résolus côté serveur en
            <code> category_id</code> avant l&apos;INSERT.
          </p>
          <pre className="mt-2 overflow-x-auto rounded-md bg-muted p-3 text-xs text-foreground/90">
            {GENERAL_FORMAT}
          </pre>
        </section>

        {FORMATS.map((f, i) => (
          <FormatBlock key={f.type} format={f} index={i + 1} />
        ))}
      </div>
    </details>
  );
}

function FormatBlock({ format, index }: { format: FormatExample; index: number }) {
  const [copied, setCopied] = useState(false);
  const [tested, setTested] = useState<
    | { kind: "ok" }
    | { kind: "err"; messages: string[] }
    | null
  >(null);

  const exampleJson = useMemo(
    () => JSON.stringify([format.example], null, 2),
    [format.example],
  );

  async function onCopy() {
    try {
      await navigator.clipboard.writeText(exampleJson);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      // Ignore : navigateurs sans clipboard API
    }
  }

  function onTest() {
    const parsed = questionsBulkSchema.safeParse([format.example]);
    if (parsed.success) {
      setTested({ kind: "ok" });
    } else {
      const messages = parsed.error.issues.map(
        (iss) => `${iss.path.join(".")}: ${iss.message}`,
      );
      setTested({ kind: "err", messages });
    }
    setTimeout(() => setTested(null), 4000);
  }

  return (
    <section className="border-t border-border/50 pt-5 first:border-t-0 first:pt-0">
      <h3 className="font-display text-base font-bold text-foreground">
        {index}. {format.label}
      </h3>
      <p className="mt-0.5 text-foreground/70">{format.description}</p>

      <p className="mt-3 text-xs uppercase tracking-wider text-foreground/50">
        Modes utilisant ce type
      </p>
      <p className="text-foreground/80">{format.modes.join(" · ")}</p>

      <div className="mt-3 grid gap-4 sm:grid-cols-2">
        <FieldList
          title="Champs requis"
          fields={format.requiredFields}
          accent="gold"
        />
        <FieldList
          title="Champs optionnels"
          fields={format.optionalFields}
          accent="muted"
        />
      </div>

      {format.particularities.length > 0 && (
        <div className="mt-3 rounded-md border border-buzz/30 bg-buzz/5 p-3">
          <p className="flex items-center gap-1.5 text-xs font-bold uppercase tracking-wider text-buzz">
            <FileWarning className="h-3 w-3" aria-hidden="true" />
            Particularités
          </p>
          <ul className="mt-1 list-disc space-y-0.5 pl-5 text-xs text-foreground/80">
            {format.particularities.map((p, i) => (
              <li key={i}>{p}</li>
            ))}
          </ul>
        </div>
      )}

      <div className="mt-3 flex items-center justify-between gap-2">
        <p className="text-xs uppercase tracking-wider text-foreground/50">
          Exemple
        </p>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={onTest}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-semibold text-foreground/80 transition-colors hover:border-life-green/50 hover:bg-life-green/10 hover:text-foreground"
          >
            <FileCheck className="h-3 w-3" aria-hidden="true" />
            Tester cet exemple
          </button>
          <button
            type="button"
            onClick={onCopy}
            className="inline-flex items-center gap-1 rounded-md border border-border bg-card px-2.5 py-1 text-xs font-semibold text-foreground/80 transition-colors hover:border-gold/50 hover:bg-gold/10 hover:text-foreground"
          >
            {copied ? (
              <>
                <Check className="h-3 w-3 text-life-green" aria-hidden="true" />
                Copié
              </>
            ) : (
              <>
                <Copy className="h-3 w-3" aria-hidden="true" />
                Copier
              </>
            )}
          </button>
        </div>
      </div>
      <pre className="mt-2 overflow-x-auto rounded-md bg-muted p-3 text-xs text-foreground/90">
        {exampleJson}
      </pre>

      {tested?.kind === "ok" && (
        <p className="mt-2 inline-flex items-center gap-1.5 rounded-md bg-life-green/15 px-3 py-1 text-xs font-semibold text-life-green">
          <Check className="h-3 w-3" aria-hidden="true" />
          Format valide
        </p>
      )}
      {tested?.kind === "err" && (
        <div className="mt-2 rounded-md border border-buzz/40 bg-buzz/10 p-2 text-xs">
          <p className="font-bold text-buzz">Erreurs de validation :</p>
          <ul className="mt-1 list-disc space-y-0.5 pl-4 text-foreground/80">
            {tested.messages.map((m, i) => (
              <li key={i}>{m}</li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function FieldList({
  title,
  fields,
  accent,
}: {
  title: string;
  fields: FieldDoc[];
  accent: "gold" | "muted";
}) {
  return (
    <div>
      <p
        className={cn(
          "text-xs uppercase tracking-wider",
          accent === "gold" ? "font-bold text-gold-warm" : "text-foreground/50",
        )}
      >
        {title}
      </p>
      <ul className="mt-1 space-y-1 text-xs">
        {fields.map((f) => (
          <li key={f.name} className="text-foreground/80">
            <code className="font-mono text-foreground">{f.name}</code>
            <span className="text-foreground/50">: {f.type}</span>
            {f.description && (
              <span className="text-foreground/50"> — {f.description}</span>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}
