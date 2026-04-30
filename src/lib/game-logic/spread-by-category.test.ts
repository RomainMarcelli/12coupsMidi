import { describe, expect, it } from "vitest";
import {
  spreadByCategory,
  spreadByCategoryWithGetter,
} from "./spread-by-category";

interface Q {
  id: string;
  category_id: number | null;
}

function q(id: string, cat: number | null): Q {
  return { id, category_id: cat };
}

/** Vérifie qu'aucune catégorie n'apparaît 2 fois dans une fenêtre de `gap`. */
function noRepeatWithin(arr: Q[], gap: number): boolean {
  for (let i = 0; i < arr.length; i++) {
    const cat = arr[i]!.category_id;
    for (let j = i + 1; j < Math.min(arr.length, i + gap); j++) {
      if (arr[j]!.category_id === cat) return false;
    }
  }
  return true;
}

describe("spreadByCategory", () => {
  it("returns empty array for empty input", () => {
    expect(spreadByCategory([])).toEqual([]);
  });

  it("returns identical array if all questions share the same category", () => {
    const input = [q("a", 1), q("b", 1), q("c", 1), q("d", 1)];
    const out = spreadByCategory(input);
    expect(out).toEqual(input);
  });

  it("returns identical array if pool has < 2 distinct categories", () => {
    const input = [q("a", null), q("b", null)];
    expect(spreadByCategory(input)).toEqual(input);
  });

  it("preserves all elements (no dropping/duplication)", () => {
    const input = [
      q("a", 1),
      q("b", 2),
      q("c", 1),
      q("d", 3),
      q("e", 2),
      q("f", 1),
    ];
    const out = spreadByCategory(input, 3);
    const inputIds = new Set(input.map((x) => x.id));
    const outIds = new Set(out.map((x) => x.id));
    expect(out.length).toBe(input.length);
    expect(outIds).toEqual(inputIds);
  });

  it("respects minGap=3 with a balanced pool (5 cats × 2)", () => {
    const input: Q[] = [];
    // 10 questions sur 5 catégories : largement faisable avec gap=3
    for (let cat = 1; cat <= 5; cat++) {
      input.push(q(`q${cat}a`, cat), q(`q${cat}b`, cat));
    }
    const out = spreadByCategory(input, 3);
    expect(noRepeatWithin(out, 3)).toBe(true);
  });

  it("respects minGap=3 with 3 categories and 3 questions (boundary case)", () => {
    const input = [q("a", 1), q("b", 2), q("c", 3)];
    const out = spreadByCategory(input, 3);
    expect(noRepeatWithin(out, 3)).toBe(true);
    expect(out.length).toBe(3);
  });

  it("falls back gracefully when pool too small (greedy minimal damage)", () => {
    // 4 questions, 2 cats : impossible de respecter strictement gap=3.
    // L'algo doit retourner les 4 sans crasher, en faisant au mieux
    // (alternance).
    const input = [q("a", 1), q("b", 1), q("c", 2), q("d", 2)];
    const out = spreadByCategory(input, 3);
    expect(out.length).toBe(4);
    // Vérification minimale : pas 2 même cat consécutives
    expect(out[0]!.category_id).not.toBe(out[1]!.category_id);
    expect(out[2]!.category_id).not.toBe(out[3]!.category_id);
  });

  it("handles minGap=1 (only no-immediate-repeat)", () => {
    const input = [
      q("a", 1),
      q("b", 1),
      q("c", 2),
      q("d", 2),
      q("e", 3),
      q("f", 3),
    ];
    const out = spreadByCategory(input, 1);
    // minGap=1 ne bloque rien (gap>=1 toujours vrai dès la 2e position),
    // mais l'algo doit quand même alterner pour minimiser la concentration.
    expect(out.length).toBe(6);
  });

  it("handles all distinct categories (trivial spread)", () => {
    const input = [
      q("a", 1),
      q("b", 2),
      q("c", 3),
      q("d", 4),
      q("e", 5),
    ];
    const out = spreadByCategory(input, 3);
    expect(out.length).toBe(5);
    // Toutes les catégories sont uniques → aucune fenêtre ne peut violer.
    expect(noRepeatWithin(out, 3)).toBe(true);
  });

  it("treats null category_id as a distinct category from numbered ones", () => {
    const input = [
      q("a", null),
      q("b", 1),
      q("c", null),
      q("d", 2),
      q("e", null),
      q("f", 1),
    ];
    const out = spreadByCategory(input, 3);
    expect(out.length).toBe(6);
    // Pas 2 nulls consécutifs (au moins gap=3 si possible)
    expect(out[0]!.category_id).not.toBe(out[1]!.category_id);
  });

  it("does not mutate the input array", () => {
    const input = [q("a", 1), q("b", 2), q("c", 1), q("d", 3)];
    const snapshot = JSON.stringify(input);
    spreadByCategory(input, 3);
    expect(JSON.stringify(input)).toBe(snapshot);
  });
});

describe("spreadByCategoryWithGetter", () => {
  it("works with nested category accessor", () => {
    interface Nested {
      id: string;
      category: { id: number } | null;
    }
    const input: Nested[] = [
      { id: "a", category: { id: 1 } },
      { id: "b", category: { id: 1 } },
      { id: "c", category: { id: 2 } },
      { id: "d", category: { id: 3 } },
      { id: "e", category: { id: 2 } },
      { id: "f", category: null },
    ];
    const out = spreadByCategoryWithGetter(
      input,
      (q) => q.category?.id ?? null,
      3,
    );
    expect(out.length).toBe(input.length);
    // Pas 2 même catégorie dans une fenêtre de 3
    for (let i = 0; i < out.length; i++) {
      const cur = out[i]!.category?.id ?? null;
      for (let j = i + 1; j < Math.min(out.length, i + 3); j++) {
        expect(out[j]!.category?.id ?? null).not.toBe(cur);
      }
    }
  });
});
