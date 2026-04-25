import { describe, expect, it } from "vitest";
import {
  CATEGORY_MASTERY_RATIO,
  CATEGORY_MIN_QUESTIONS,
  STREAK_MAX_DAYS,
  computeMaitreScore,
  estimateMasteryDays,
  weakestCategories,
  type CategoryStat,
  type MaitreInput,
} from "./maitre-de-midi";

function input(overrides: Partial<MaitreInput> = {}): MaitreInput {
  return {
    totalAnswered: 0,
    totalCorrect: 0,
    perCategory: new Map(),
    currentStreak: 0,
    fafPlayed: 0,
    fafWon: 0,
    ...overrides,
  };
}

describe("computeMaitreScore", () => {
  it("retourne 0 quand aucune donnée", () => {
    const out = computeMaitreScore(input());
    expect(out.score).toBe(0);
    expect(out.breakdown.accuracy).toBe(0);
    expect(out.breakdown.coverage).toBe(0);
    expect(out.breakdown.consistency).toBe(0);
    expect(out.breakdown.facePerf).toBe(0);
  });

  it("précision 80 % seule = 24 (30% × 80)", () => {
    const out = computeMaitreScore(
      input({ totalAnswered: 100, totalCorrect: 80 }),
    );
    expect(out.breakdown.accuracy).toBe(80);
    expect(out.score).toBeCloseTo(24);
  });

  it("100 % partout = 100", () => {
    const cats = new Map<string, CategoryStat>([
      ["histoire", { total: 30, correct: 30 }],
      ["geo", { total: 30, correct: 30 }],
    ]);
    const out = computeMaitreScore(
      input({
        totalAnswered: 60,
        totalCorrect: 60,
        perCategory: cats,
        currentStreak: STREAK_MAX_DAYS,
        fafPlayed: 10,
        fafWon: 10,
      }),
    );
    expect(out.score).toBe(100);
  });

  it("ignore les catégories avec moins de 20 questions pour la couverture", () => {
    const cats = new Map<string, CategoryStat>([
      ["histoire", { total: CATEGORY_MIN_QUESTIONS, correct: 20 }], // 100% maîtrisée
      ["sport", { total: 5, correct: 5 }], // ignorée (trop peu de questions)
    ]);
    const out = computeMaitreScore(input({ perCategory: cats }));
    expect(out.breakdown.coverage).toBe(100);
  });

  it("seuil de maîtrise catégorie respecté", () => {
    const cats = new Map<string, CategoryStat>([
      [
        "ok",
        {
          total: 20,
          correct: Math.floor(20 * CATEGORY_MASTERY_RATIO),
        },
      ],
      [
        "ko",
        {
          total: 20,
          correct: Math.floor(20 * CATEGORY_MASTERY_RATIO) - 1,
        },
      ],
    ]);
    const out = computeMaitreScore(input({ perCategory: cats }));
    // 1 sur 2 = 50%
    expect(out.breakdown.coverage).toBe(50);
  });

  it("plafonne le streak à STREAK_MAX_DAYS", () => {
    const big = computeMaitreScore(input({ currentStreak: 999 }));
    const max = computeMaitreScore(input({ currentStreak: STREAK_MAX_DAYS }));
    expect(big.breakdown.consistency).toBe(max.breakdown.consistency);
    expect(big.breakdown.consistency).toBe(100);
  });

  it("score borné [0..100]", () => {
    const out = computeMaitreScore(
      input({
        totalAnswered: 1000,
        totalCorrect: 1000,
        currentStreak: 9999,
      }),
    );
    expect(out.score).toBeLessThanOrEqual(100);
    expect(out.score).toBeGreaterThanOrEqual(0);
  });
});

describe("estimateMasteryDays", () => {
  it("null si pente ≤ 0", () => {
    const flat = [
      { date: "2026-04-01", score: 50 },
      { date: "2026-04-15", score: 50 },
    ];
    expect(estimateMasteryDays(flat)).toBeNull();
    const decreasing = [
      { date: "2026-04-01", score: 60 },
      { date: "2026-04-15", score: 40 },
    ];
    expect(estimateMasteryDays(decreasing)).toBeNull();
  });

  it("null si historique trop court", () => {
    expect(estimateMasteryDays([])).toBeNull();
    expect(estimateMasteryDays([{ date: "2026-04-01", score: 10 }])).toBeNull();
  });

  it("extrapole linéairement et cap à 365", () => {
    // +5 points en 1 jour → reste 95 → ~19 jours
    const fast = [
      { date: "2026-04-01", score: 0 },
      { date: "2026-04-02", score: 5 },
    ];
    expect(estimateMasteryDays(fast)).toBe(19);

    // +1 point sur toute la fenêtre = pente très lente, mais sous 365
    const slow = [
      { date: "2026-04-01", score: 50 },
      { date: "2026-04-15", score: 51 },
    ];
    const days = estimateMasteryDays(slow);
    expect(days).toBeGreaterThan(0);
    expect(days).toBeLessThanOrEqual(365);
  });

  it("0 jours si déjà à 100", () => {
    const there = [
      { date: "2026-04-01", score: 99 },
      { date: "2026-04-02", score: 100 },
    ];
    expect(estimateMasteryDays(there)).toBe(0);
  });
});

describe("weakestCategories", () => {
  it("retourne les N catégories avec le plus faible taux de réussite", () => {
    const cats = new Map<string, CategoryStat>([
      ["histoire", { total: 50, correct: 45 }], // 90%
      ["geo", { total: 30, correct: 12 }], // 40%
      ["sport", { total: 20, correct: 5 }], // 25%
      ["art", { total: 15, correct: 3 }], // 20%
      ["new", { total: 5, correct: 4 }], // ignorée (< 10)
    ]);
    const weak = weakestCategories(cats, 3, 10);
    expect(weak.map((w) => w.key)).toEqual(["art", "sport", "geo"]);
  });

  it("ignore les catégories sous le minQ", () => {
    const cats = new Map<string, CategoryStat>([
      ["a", { total: 5, correct: 0 }], // ignorée
      ["b", { total: 12, correct: 3 }],
    ]);
    const weak = weakestCategories(cats, 5, 10);
    expect(weak.map((w) => w.key)).toEqual(["b"]);
  });
});
