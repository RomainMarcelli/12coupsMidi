"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Check } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  QUESTION_TYPES,
  type QuestionInput,
  type QuestionType,
} from "@/lib/schemas/question";
import {
  createQuestion,
  updateQuestion,
  type ActionResult,
} from "./actions";

interface Category {
  id: number;
  nom: string;
  slug: string;
}

interface Subcategory {
  id: number;
  category_id: number | null;
  nom: string;
  slug: string;
}

interface QuestionFormProps {
  categories: Category[];
  subcategories: Subcategory[];
  initial?: QuestionInput & { id?: string };
}

type FormState = {
  type: QuestionType;
  category_slug: string;
  subcategory_slug: string;
  difficulte: number;
  enonce: string;
  reponses: { text: string; correct: boolean }[];
  bonne_reponse: string;
  alias: string;
  indices: string;
  image_url: string;
  explication: string;
};

function emptyState(): FormState {
  return {
    type: "quizz_2",
    category_slug: "",
    subcategory_slug: "",
    difficulte: 2,
    enonce: "",
    reponses: [
      { text: "", correct: true },
      { text: "", correct: false },
    ],
    bonne_reponse: "",
    alias: "",
    indices: "",
    image_url: "",
    explication: "",
  };
}

function initialStateFrom(init: QuestionFormProps["initial"]): FormState {
  if (!init) return emptyState();
  return {
    type: init.type,
    category_slug: init.category_slug,
    subcategory_slug: init.subcategory_slug ?? "",
    difficulte: init.difficulte,
    enonce: init.enonce,
    reponses:
      init.reponses.length > 0
        ? init.reponses
        : defaultReponsesForType(init.type),
    bonne_reponse: init.bonne_reponse ?? "",
    alias: (init.alias ?? []).join(", "),
    indices: (init.indices ?? []).join("\n"),
    image_url: init.image_url ?? "",
    explication: init.explication ?? "",
  };
}

function defaultReponsesForType(
  t: QuestionType,
): { text: string; correct: boolean }[] {
  if (t === "quizz_2") {
    return [
      { text: "", correct: true },
      { text: "", correct: false },
    ];
  }
  if (t === "quizz_4") {
    return [
      { text: "", correct: true },
      { text: "", correct: false },
      { text: "", correct: false },
      { text: "", correct: false },
    ];
  }
  return [];
}

export function QuestionForm({
  categories,
  subcategories,
  initial,
}: QuestionFormProps) {
  const router = useRouter();
  const [state, setState] = useState<FormState>(initialStateFrom(initial));
  const [result, setResult] = useState<ActionResult | null>(null);
  const [isPending, startTransition] = useTransition();

  const availableSubcats = useMemo(() => {
    const cat = categories.find((c) => c.slug === state.category_slug);
    if (!cat) return [];
    return subcategories.filter((s) => s.category_id === cat.id);
  }, [categories, subcategories, state.category_slug]);

  const needsReponses = state.type === "quizz_2" || state.type === "quizz_4";
  const needsBonneReponse =
    state.type === "etoile" ||
    state.type === "face_a_face" ||
    state.type === "coup_maitre";
  const needsIndices =
    state.type === "etoile" || state.type === "coup_maitre";

  function setType(t: QuestionType) {
    setState((s) => ({
      ...s,
      type: t,
      reponses: defaultReponsesForType(t),
    }));
  }

  function onCorrectChange(idx: number) {
    setState((s) => ({
      ...s,
      reponses: s.reponses.map((r, i) => ({ ...r, correct: i === idx })),
    }));
  }

  function onReponseTextChange(idx: number, text: string) {
    setState((s) => ({
      ...s,
      reponses: s.reponses.map((r, i) => (i === idx ? { ...r, text } : r)),
    }));
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setResult(null);

    const payload: QuestionInput = {
      type: state.type,
      category_slug: state.category_slug,
      subcategory_slug:
        state.subcategory_slug.trim() === ""
          ? undefined
          : state.subcategory_slug.trim(),
      difficulte: state.difficulte,
      enonce: state.enonce.trim(),
      reponses: needsReponses ? state.reponses : [],
      bonne_reponse: needsBonneReponse
        ? state.bonne_reponse.trim() || undefined
        : undefined,
      alias: state.alias.trim()
        ? state.alias.split(",").map((a) => a.trim()).filter(Boolean)
        : undefined,
      indices: needsIndices
        ? state.indices
            .split("\n")
            .map((l) => l.trim())
            .filter(Boolean)
        : undefined,
      image_url: state.image_url.trim() || undefined,
      explication: state.explication.trim() || undefined,
    };

    startTransition(async () => {
      const res = initial?.id
        ? await updateQuestion(initial.id, payload)
        : await createQuestion(payload);
      setResult(res);
      if (res.status === "ok" && !initial?.id) {
        // Création réussie → redirige vers la liste
        router.push("/admin/questions");
      }
    });
  }

  return (
    <form onSubmit={onSubmit} className="flex flex-col gap-5">
      {/* Type */}
      <Field label="Type">
        <select
          value={state.type}
          onChange={(e) => setType(e.target.value as QuestionType)}
          className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-navy focus:border-gold focus:outline-none"
        >
          {QUESTION_TYPES.map((t) => (
            <option key={t} value={t} className="bg-cream-deep">
              {t}
            </option>
          ))}
        </select>
      </Field>

      {/* Catégorie + sous-catégorie */}
      <div className="grid gap-4 sm:grid-cols-2">
        <Field label="Catégorie">
          <select
            value={state.category_slug}
            onChange={(e) =>
              setState((s) => ({
                ...s,
                category_slug: e.target.value,
                subcategory_slug: "",
              }))
            }
            required
            className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-navy focus:border-gold focus:outline-none"
          >
            <option value="" className="bg-cream-deep">
              — Choisir —
            </option>
            {categories.map((c) => (
              <option key={c.slug} value={c.slug} className="bg-cream-deep">
                {c.nom}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Sous-catégorie">
          <select
            value={state.subcategory_slug}
            onChange={(e) =>
              setState((s) => ({ ...s, subcategory_slug: e.target.value }))
            }
            disabled={availableSubcats.length === 0}
            className="h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-navy focus:border-gold focus:outline-none disabled:opacity-50"
          >
            <option value="" className="bg-cream-deep">
              — Aucune —
            </option>
            {availableSubcats.map((s) => (
              <option key={s.slug} value={s.slug} className="bg-cream-deep">
                {s.nom}
              </option>
            ))}
          </select>
        </Field>
      </div>

      {/* Difficulté */}
      <Field label={`Difficulté : ${state.difficulte}/5`}>
        <input
          type="range"
          min={1}
          max={5}
          value={state.difficulte}
          onChange={(e) =>
            setState((s) => ({ ...s, difficulte: parseInt(e.target.value, 10) }))
          }
          className="w-full accent-gold"
        />
      </Field>

      {/* Énoncé */}
      <Field label="Énoncé">
        <textarea
          value={state.enonce}
          onChange={(e) => setState((s) => ({ ...s, enonce: e.target.value }))}
          rows={3}
          required
          minLength={3}
          className="w-full rounded-md border border-border bg-card p-3 text-sm text-navy focus:border-gold focus:outline-none"
        />
      </Field>

      {/* Réponses (quizz_2 / quizz_4) */}
      {needsReponses && (
        <Field label="Réponses (clique sur celle qui est correcte)">
          <div className="flex flex-col gap-2">
            {state.reponses.map((r, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => onCorrectChange(idx)}
                  aria-label={r.correct ? "Correcte" : "Marquer correcte"}
                  className={
                    r.correct
                      ? "flex h-9 w-9 shrink-0 items-center justify-center rounded-md bg-life-green text-midnight"
                      : "flex h-9 w-9 shrink-0 items-center justify-center rounded-md border border-border text-navy/40 hover:border-life-green"
                  }
                >
                  {r.correct && (
                    <Check className="h-4 w-4" aria-hidden="true" />
                  )}
                </button>
                <Input
                  value={r.text}
                  onChange={(e) => onReponseTextChange(idx, e.target.value)}
                  placeholder={`Proposition ${idx + 1}`}
                  required
                />
              </div>
            ))}
          </div>
        </Field>
      )}

      {/* Bonne réponse (etoile, face_a_face, coup_maitre) */}
      {needsBonneReponse && (
        <Field label="Bonne réponse (texte à saisir par le joueur)">
          <Input
            value={state.bonne_reponse}
            onChange={(e) =>
              setState((s) => ({ ...s, bonne_reponse: e.target.value }))
            }
            placeholder="Ex: Charles de Gaulle"
            required
          />
        </Field>
      )}

      {/* Alias (face_a_face, etoile, coup_maitre) */}
      {(needsBonneReponse || needsIndices) && (
        <Field
          label="Alias acceptés (séparés par virgules)"
          hint='Ex: "de Gaulle, Général de Gaulle"'
        >
          <Input
            value={state.alias}
            onChange={(e) => setState((s) => ({ ...s, alias: e.target.value }))}
            placeholder="alias1, alias2"
          />
        </Field>
      )}

      {/* Indices (etoile, coup_maitre) */}
      {needsIndices && (
        <Field
          label="Indices (un par ligne — 5 pour Étoile, 3 pour Coup de Maître)"
        >
          <textarea
            value={state.indices}
            onChange={(e) =>
              setState((s) => ({ ...s, indices: e.target.value }))
            }
            rows={6}
            className="w-full rounded-md border border-border bg-card p-3 font-mono text-sm text-navy focus:border-gold focus:outline-none"
          />
        </Field>
      )}

      {/* URL image */}
      <Field label="Image (URL, optionnel)">
        <Input
          type="url"
          value={state.image_url}
          onChange={(e) =>
            setState((s) => ({ ...s, image_url: e.target.value }))
          }
          placeholder="https://…"
        />
      </Field>

      {/* Explication */}
      <Field label="Explication (affichée en révision, optionnel)">
        <textarea
          value={state.explication}
          onChange={(e) =>
            setState((s) => ({ ...s, explication: e.target.value }))
          }
          rows={2}
          className="w-full rounded-md border border-border bg-card p-3 text-sm text-navy focus:border-gold focus:outline-none"
        />
      </Field>

      {/* Result + submit */}
      {result && (
        <div
          role={result.status === "ok" ? "status" : "alert"}
          className={
            result.status === "ok"
              ? "rounded-md border border-life-green/40 bg-life-green/10 p-3 text-sm text-life-green"
              : "rounded-md border border-buzz/40 bg-buzz/10 p-3 text-sm text-buzz"
          }
        >
          {result.message}
        </div>
      )}

      <div className="flex items-center gap-2">
        <Button
          type="submit"
          variant="gold"
          size="lg"
          disabled={isPending}
        >
          {isPending
            ? "Enregistrement…"
            : initial?.id
              ? "Mettre à jour"
              : "Créer la question"}
        </Button>
        <Button
          type="button"
          variant="ghost-gold"
          size="lg"
          onClick={() => router.push("/admin/questions")}
        >
          Annuler
        </Button>
      </div>
    </form>
  );
}

// --------------------------------------------------------------------------

function Field({
  label,
  hint,
  children,
}: {
  label: string;
  hint?: string;
  children: React.ReactNode;
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-semibold uppercase tracking-wider text-navy/70">
        {label}
      </span>
      {children}
      {hint && <span className="text-xs text-navy/50">{hint}</span>}
    </label>
  );
}

