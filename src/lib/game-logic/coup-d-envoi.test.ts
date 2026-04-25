import { describe, expect, it } from "vitest";
import {
  CE_MAX_ERRORS,
  CE_XP_PER_CORRECT,
  ceIsPlayerOut,
  ceLifeState,
  computeCeXp,
  formatLabel,
  prepareCeQuestion,
  shuffleCePool,
  stripFormatPrefix,
} from "./coup-d-envoi";
import { SAMPLE_CATEGORIES, makeQuestion, makeSeededRng } from "./_test-fixtures";

describe("ceLifeState", () => {
  it("0 → green, 1 → yellow, 2+ → red", () => {
    expect(ceLifeState(0)).toBe("green");
    expect(ceLifeState(1)).toBe("yellow");
    expect(ceLifeState(2)).toBe("red");
    expect(ceLifeState(10)).toBe("red");
  });

  it("valeurs négatives → green (robustesse)", () => {
    expect(ceLifeState(-1)).toBe("green");
  });
});

describe("ceIsPlayerOut", () => {
  it("true à partir de CE_MAX_ERRORS erreurs", () => {
    expect(ceIsPlayerOut(CE_MAX_ERRORS - 1)).toBe(false);
    expect(ceIsPlayerOut(CE_MAX_ERRORS)).toBe(true);
    expect(ceIsPlayerOut(CE_MAX_ERRORS + 1)).toBe(true);
  });
});

describe("computeCeXp", () => {
  it("50 XP par bonne réponse", () => {
    expect(computeCeXp(0)).toBe(0);
    expect(computeCeXp(5)).toBe(5 * CE_XP_PER_CORRECT);
  });
});

describe("formatLabel", () => {
  it("retourne le libellé pour chaque format", () => {
    expect(formatLabel("vrai_faux")).toBe("Vrai ou faux ?");
    expect(formatLabel("ou")).toBe("L'un ou l'autre ?");
    expect(formatLabel("plus_moins")).toBe("Plus ou moins ?");
  });

  it("retourne vide pour null / inconnu", () => {
    expect(formatLabel(null)).toBe("");
  });
});

describe("stripFormatPrefix", () => {
  it("retire 'Vrai ou faux :' au début", () => {
    expect(stripFormatPrefix("Vrai ou faux : Paris est la capitale.")).toBe(
      "Paris est la capitale.",
    );
    expect(stripFormatPrefix("VRAI OU FAUX Paris est la capitale.")).toBe(
      "Paris est la capitale.",
    );
  });

  it("retire 'Plus ou moins :' au début", () => {
    expect(stripFormatPrefix("Plus ou moins : 40 000 km ?")).toBe(
      "40 000 km ?",
    );
  });

  it("retire 'L'un ou l'autre :' au début", () => {
    expect(stripFormatPrefix("L'un ou l'autre : A ou B ?")).toBe("A ou B ?");
    expect(stripFormatPrefix("L’un ou l’autre : A ou B ?")).toBe("A ou B ?");
  });

  it("laisse intact si pas de préfixe", () => {
    expect(stripFormatPrefix("Qui a écrit Les Misérables ?")).toBe(
      "Qui a écrit Les Misérables ?",
    );
  });
});

describe("prepareCeQuestion", () => {
  it("format vrai_faux : position randomisée via rng", () => {
    const raw = makeQuestion({
      id: "q1",
      type: "quizz_2",
      format: "vrai_faux",
      enonce: "Vrai ou faux : test ?",
      reponses: [
        { text: "Vrai", correct: true },
        { text: "Faux", correct: false },
      ],
    });
    // rng < 0.5 → échange
    const swapped = prepareCeQuestion(raw, SAMPLE_CATEGORIES, () => 0);
    expect(swapped.reponses[0]!.text).toBe("Faux");
    expect(swapped.reponses[1]!.text).toBe("Vrai");
    // rng >= 0.5 → pas d'échange
    const same = prepareCeQuestion(raw, SAMPLE_CATEGORIES, () => 0.9);
    expect(same.reponses[0]!.text).toBe("Vrai");
    expect(same.format).toBe("vrai_faux");
  });

  it("format plus_moins : position randomisée via rng", () => {
    const raw = makeQuestion({
      id: "q1",
      type: "quizz_2",
      format: "plus_moins",
      reponses: [
        { text: "Plus", correct: true },
        { text: "Moins", correct: false },
      ],
    });
    const swapped = prepareCeQuestion(raw, SAMPLE_CATEGORIES, () => 0);
    expect(swapped.reponses[0]!.text).toBe("Moins");
    const same = prepareCeQuestion(raw, SAMPLE_CATEGORIES, () => 0.9);
    expect(same.reponses[0]!.text).toBe("Plus");
  });

  it("format 'ou' : shuffle possible", () => {
    const raw = makeQuestion({
      id: "q1",
      type: "quizz_2",
      format: "ou",
      reponses: [
        { text: "Victor Hugo", correct: true },
        { text: "Émile Zola", correct: false },
      ],
    });
    // rng qui renvoie 0 (< 0.5) : la fonction échange A/B
    const swapped = prepareCeQuestion(raw, SAMPLE_CATEGORIES, () => 0);
    expect(swapped.reponses[0]!.text).toBe("Émile Zola");
    // rng qui renvoie 0.9 (>= 0.5) : pas d'échange
    const same = prepareCeQuestion(raw, SAMPLE_CATEGORIES, () => 0.9);
    expect(same.reponses[0]!.text).toBe("Victor Hugo");
  });

  it("format null (quizz_2 legacy) : shuffle possible", () => {
    const raw = makeQuestion({
      id: "q1",
      type: "quizz_2",
      format: null,
      reponses: [
        { text: "A", correct: true },
        { text: "B", correct: false },
      ],
    });
    const prepared = prepareCeQuestion(raw, SAMPLE_CATEGORIES, () => 0.9);
    expect(prepared.format).toBeNull();
    expect(prepared.reponses).toHaveLength(2);
  });

  it("joint la catégorie", () => {
    const raw = makeQuestion({
      id: "q1",
      type: "quizz_2",
      category_id: 2,
      reponses: [
        { text: "A", correct: true },
        { text: "B", correct: false },
      ],
    });
    const prepared = prepareCeQuestion(raw, SAMPLE_CATEGORIES);
    expect(prepared.category?.nom).toBe("Géographie");
  });
});

describe("shuffleCePool", () => {
  it("est déterministe avec un rng seedé", () => {
    const pool = Array.from({ length: 10 }, (_, i) =>
      makeQuestion({ id: `q${i}`, type: "quizz_2" }),
    );
    const a = shuffleCePool(pool, makeSeededRng(42)).map((q) => q.id);
    const b = shuffleCePool(pool, makeSeededRng(42)).map((q) => q.id);
    expect(a).toEqual(b);
  });

  it("conserve tous les éléments", () => {
    const pool = Array.from({ length: 10 }, (_, i) =>
      makeQuestion({ id: `q${i}`, type: "quizz_2" }),
    );
    const out = shuffleCePool(pool, makeSeededRng(1));
    expect(new Set(out.map((q) => q.id))).toEqual(
      new Set(pool.map((q) => q.id)),
    );
  });
});
