import { describe, expect, it } from "vitest";
import {
  JEU1_MAX_PER_CATEGORY,
  JEU1_TOTAL_QUESTIONS,
  JEU1_XP_PER_CORRECT,
  JEU1_XP_PERFECT_BONUS,
  computeJeu1Xp,
  computeLifeState,
  pickJeu1Questions,
  shouldTriggerFaceAFace,
} from "./jeu1";
import { SAMPLE_CATEGORIES, makeQuestion } from "./_test-fixtures";

function q(id: string, categoryId: number | null) {
  return makeQuestion({
    id,
    type: "quizz_2",
    category_id: categoryId,
    enonce: `Q ${id} ?`,
    reponses: [
      { text: "A", correct: true },
      { text: "B", correct: false },
    ],
  });
}

describe("computeLifeState", () => {
  it("0 erreur → green", () => {
    expect(computeLifeState(0)).toBe("green");
  });
  it("1 erreur → yellow", () => {
    expect(computeLifeState(1)).toBe("yellow");
  });
  it("2 erreurs → red", () => {
    expect(computeLifeState(2)).toBe("red");
  });
  it("3 erreurs ou plus → red (game over)", () => {
    expect(computeLifeState(3)).toBe("red");
    expect(computeLifeState(99)).toBe("red");
  });
  it("valeurs négatives → green (robustesse)", () => {
    expect(computeLifeState(-1)).toBe("green");
  });
});

describe("shouldTriggerFaceAFace", () => {
  it("true seulement à partir de 3 erreurs", () => {
    expect(shouldTriggerFaceAFace(2)).toBe(false);
    expect(shouldTriggerFaceAFace(3)).toBe(true);
    expect(shouldTriggerFaceAFace(4)).toBe(true);
  });
});

describe("computeJeu1Xp", () => {
  it("100 XP par bonne réponse", () => {
    expect(computeJeu1Xp(5, 10)).toBe(500);
  });

  it("bonus 500 XP si partie parfaite", () => {
    const expected =
      JEU1_TOTAL_QUESTIONS * JEU1_XP_PER_CORRECT + JEU1_XP_PERFECT_BONUS;
    expect(computeJeu1Xp(JEU1_TOTAL_QUESTIONS, JEU1_TOTAL_QUESTIONS)).toBe(
      expected,
    );
  });

  it("pas de bonus si une seule erreur", () => {
    expect(computeJeu1Xp(9, 10)).toBe(900);
  });

  it("0 correct → 0 XP", () => {
    expect(computeJeu1Xp(0, 10)).toBe(0);
  });
});

describe("pickJeu1Questions", () => {
  it("retourne exactement `count` questions si le pool est suffisant", () => {
    const pool = Array.from({ length: 30 }, (_, i) => q(`q${i}`, (i % 4) + 1));
    const picked = pickJeu1Questions(pool, SAMPLE_CATEGORIES, 10);
    expect(picked).toHaveLength(10);
  });

  it("respecte la contrainte max par catégorie quand le pool le permet", () => {
    // 4 catégories × max 2 = 8 questions exactement — pas de fallback
    const pool = Array.from({ length: 40 }, (_, i) => q(`q${i}`, (i % 4) + 1));
    const picked = pickJeu1Questions(
      pool,
      SAMPLE_CATEGORIES,
      4 * JEU1_MAX_PER_CATEGORY,
      JEU1_MAX_PER_CATEGORY,
    );
    expect(picked).toHaveLength(4 * JEU1_MAX_PER_CATEGORY);
    const counts = new Map<string | undefined, number>();
    for (const p of picked) {
      const k = p.category?.nom;
      counts.set(k, (counts.get(k) ?? 0) + 1);
    }
    for (const c of counts.values()) {
      expect(c).toBeLessThanOrEqual(JEU1_MAX_PER_CATEGORY);
    }
  });

  it("complète sans respecter la contrainte si le pool est trop contraint", () => {
    // 10 questions toutes dans la cat 1 → max 2 par cat est violé pour compléter
    const pool = Array.from({ length: 10 }, (_, i) => q(`q${i}`, 1));
    const picked = pickJeu1Questions(pool, SAMPLE_CATEGORIES, 10, 2);
    expect(picked).toHaveLength(10);
  });

  it("retourne tableau vide pour pool vide", () => {
    expect(pickJeu1Questions([], SAMPLE_CATEGORIES, 10)).toEqual([]);
  });

  it("joint les infos de catégorie", () => {
    const pool = [q("q1", 1), q("q2", 2)];
    const picked = pickJeu1Questions(pool, SAMPLE_CATEGORIES, 2, 99);
    const cats = picked.map((p) => p.category?.nom).sort();
    expect(cats).toEqual(["Géographie", "Histoire"]);
  });

  it("normalise les réponses en array de 2 éléments", () => {
    const pool = [q("q1", 1)];
    const picked = pickJeu1Questions(pool, SAMPLE_CATEGORIES, 1);
    expect(picked[0]!.reponses).toHaveLength(2);
    expect(
      picked[0]!.reponses.filter((r) => r.correct).length,
    ).toBe(1);
  });
});
