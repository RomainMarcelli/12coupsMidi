"use client";

import { useEffect, useState, useTransition } from "react";
import { Keyboard, RotateCcw, Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  fetchShortcuts,
  resetShortcuts,
  saveShortcuts,
} from "@/lib/shortcuts/actions";
import {
  mergeWithDefaults,
  SHORTCUT_CONTEXTS,
  type ShortcutContext,
  type ShortcutDefaultEntry,
  type ShortcutsMap,
} from "@/lib/shortcuts/defaults";
import {
  ALL_CONTEXTS,
  findConflict,
  formatKeyLabel,
} from "@/lib/shortcuts/use-shortcuts";
import { cn } from "@/lib/utils";

/**
 * UI Paramètres → onglet « Raccourcis » (E4.1).
 *
 * Affiche tous les contextes + actions avec touche personnalisable.
 * - Clic sur une touche : passe en mode capture, "Appuie sur la nouvelle
 *   touche…", la prochaine touche pressée devient la nouvelle valeur.
 * - Validation : empêche les doublons dans le MÊME contexte (avertit).
 * - Boutons : "Réinitialiser" (revient aux defaults globaux),
 *   "Enregistrer" (envoie en BDD).
 */
export function ShortcutsPanel() {
  // `effective` = defaults mergés avec custom — c'est ce qu'on affiche.
  // `custom` = ce que l'user a explicitement personnalisé, à sauvegarder.
  const [custom, setCustom] = useState<ShortcutsMap>({});
  const [effective, setEffective] = useState<ShortcutsMap>(() =>
    mergeWithDefaults({}),
  );
  const [loading, setLoading] = useState(true);
  const [dirty, setDirty] = useState(false);
  const [editing, setEditing] = useState<{
    ctx: ShortcutContext;
    actionId: string;
  } | null>(null);
  const [conflict, setConflict] = useState<string | null>(null);
  const [savedFlash, setSavedFlash] = useState(false);
  const [, startTransition] = useTransition();

  useEffect(() => {
    let alive = true;
    void fetchShortcuts().then((c) => {
      if (!alive) return;
      setCustom(c);
      setEffective(mergeWithDefaults(c));
      setLoading(false);
    });
    return () => {
      alive = false;
    };
  }, []);

  // Capture la prochaine touche pressée quand `editing` est actif
  useEffect(() => {
    if (!editing) return;
    function onKey(e: KeyboardEvent) {
      // On ignore les modifs (Ctrl/Alt/Shift seuls)
      if (
        e.key === "Control" ||
        e.key === "Alt" ||
        e.key === "Shift" ||
        e.key === "Meta"
      )
        return;
      e.preventDefault();
      e.stopPropagation();
      const newKey = e.key;
      // Détecte conflit
      const targetCtx = editing!.ctx;
      const targetId = editing!.actionId;
      const candidateMap: ShortcutsMap = {
        ...effective,
        [targetCtx]: { ...effective[targetCtx], [targetId]: newKey },
      };
      const conflictId = findConflict(candidateMap, targetCtx, targetId, newKey);
      if (conflictId) {
        setConflict(conflictId);
        setEditing(null);
        return;
      }
      setConflict(null);
      // Met à jour custom + effective
      setCustom((prev) => ({
        ...prev,
        [targetCtx]: { ...prev[targetCtx], [targetId]: newKey },
      }));
      setEffective(candidateMap);
      setDirty(true);
      setEditing(null);
    }
    window.addEventListener("keydown", onKey, { capture: true });
    return () =>
      window.removeEventListener("keydown", onKey, { capture: true });
  }, [editing, effective]);

  function handleResetAction(ctx: ShortcutContext, entry: ShortcutDefaultEntry) {
    setCustom((prev) => {
      const ctxMap = { ...(prev[ctx] ?? {}) };
      delete ctxMap[entry.id];
      const next: ShortcutsMap = { ...prev };
      if (Object.keys(ctxMap).length === 0) {
        delete next[ctx];
      } else {
        next[ctx] = ctxMap;
      }
      return next;
    });
    setEffective((prev) => ({
      ...prev,
      [ctx]: { ...prev[ctx], [entry.id]: entry.defaultKey },
    }));
    setDirty(true);
  }

  function handleResetAll() {
    setCustom({});
    setEffective(mergeWithDefaults({}));
    setDirty(true);
    startTransition(async () => {
      await resetShortcuts();
      setDirty(false);
      setSavedFlash(true);
      window.setTimeout(() => setSavedFlash(false), 2000);
    });
  }

  function handleSave() {
    startTransition(async () => {
      const res = await saveShortcuts(custom);
      if (res.status === "ok") {
        setDirty(false);
        setSavedFlash(true);
        window.setTimeout(() => setSavedFlash(false), 2000);
      }
    });
  }

  if (loading) {
    return (
      <div className="rounded-xl border border-border bg-card p-6 text-sm text-foreground/60">
        Chargement…
      </div>
    );
  }

  return (
    <section className="flex flex-col gap-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <div className="inline-flex items-center gap-2 rounded-full bg-sky/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-sky">
            <Keyboard className="h-3.5 w-3.5" aria-hidden="true" />
            Raccourcis clavier
          </div>
          <h2 className="mt-2 font-display text-xl font-extrabold text-foreground">
            Personnalise tes touches
          </h2>
          <p className="mt-1 text-sm text-foreground/70">
            Clique sur une touche pour la modifier. Les conflits sont
            détectés à l&apos;intérieur d&apos;un même contexte.
          </p>
        </div>
        <div className="flex flex-col items-end gap-2">
          {savedFlash && (
            <span className="inline-flex items-center gap-1.5 rounded-full bg-life-green/15 px-3 py-1 text-xs font-bold text-life-green">
              <Save className="h-3.5 w-3.5" aria-hidden="true" />
              Enregistré
            </span>
          )}
          <div className="flex gap-2">
            <button
              type="button"
              onClick={handleResetAll}
              className="inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-xs font-bold text-foreground/70 hover:border-buzz/40 hover:text-buzz"
            >
              <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
              Tout réinit.
            </button>
            <Button
              variant="gold"
              size="sm"
              onClick={handleSave}
              disabled={!dirty}
            >
              <Save className="h-4 w-4" aria-hidden="true" />
              Enregistrer
            </Button>
          </div>
        </div>
      </header>

      {conflict && (
        <p
          role="alert"
          className="rounded-md border border-buzz/40 bg-buzz/10 px-3 py-2 text-sm text-buzz"
        >
          Cette touche est déjà utilisée par&nbsp;: <strong>{conflict}</strong>.
          Choisis une autre touche.
        </p>
      )}

      {ALL_CONTEXTS.map((ctxKey) => {
        const ctx = SHORTCUT_CONTEXTS[ctxKey];
        return (
          <article
            key={ctxKey}
            className="rounded-xl border border-border bg-card p-4"
          >
            <header className="mb-3">
              <h3 className="font-display text-base font-extrabold text-foreground">
                {ctx.label}
              </h3>
              <p className="text-xs text-foreground/60">{ctx.description}</p>
            </header>
            <ul className="flex flex-col gap-1.5">
              {ctx.entries.map((entry) => {
                const currentKey =
                  effective[ctxKey]?.[entry.id] ?? entry.defaultKey;
                const customKey = custom[ctxKey]?.[entry.id];
                const isCustomized = customKey !== undefined;
                const isEditing =
                  editing?.ctx === ctxKey && editing.actionId === entry.id;
                return (
                  <li
                    key={entry.id}
                    className="flex items-center justify-between gap-3 rounded-md px-2 py-1.5 hover:bg-foreground/5"
                  >
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-foreground">
                        {entry.label}
                      </span>
                      {isCustomized && (
                        <span className="text-[10px] uppercase tracking-wider text-gold-warm">
                          personnalisé
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => {
                          setConflict(null);
                          setEditing({ ctx: ctxKey, actionId: entry.id });
                        }}
                        className={cn(
                          "min-w-[5rem] rounded-md border-2 px-3 py-1.5 font-mono text-xs font-bold transition-all",
                          isEditing
                            ? "animate-pulse border-gold bg-gold/15 text-gold-warm"
                            : "border-border bg-card text-foreground hover:border-gold/50",
                        )}
                      >
                        {isEditing ? "Appuie…" : formatKeyLabel(currentKey)}
                      </button>
                      {isCustomized && (
                        <button
                          type="button"
                          onClick={() => handleResetAction(ctxKey, entry)}
                          aria-label={`Réinitialiser ${entry.label}`}
                          className="rounded-md p-1.5 text-foreground/50 hover:text-buzz"
                        >
                          <RotateCcw className="h-3.5 w-3.5" aria-hidden="true" />
                        </button>
                      )}
                    </div>
                  </li>
                );
              })}
            </ul>
          </article>
        );
      })}
    </section>
  );
}
