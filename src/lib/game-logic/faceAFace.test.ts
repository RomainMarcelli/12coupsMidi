import { describe, expect, it } from "vitest";
import {
  BOT_PROFILES,
  FAF_DURATION_MS,
  FAF_POOL_SIZE,
  botAnswersCorrectly,
  botResponseDelayMs,
  computeFafXp,
  nextQuestionIndex,
  pickFaceAFaceQuestions,
} from "./faceAFace";
import {
  SAMPLE_CATEGORIES,
  makeQuestion,
  makeSeededRng,
} from "./_test-fixtures";

function faf(
  id: string,
  overrides: {
    bonne_reponse?: string;
    alias?: string[];
    categoryId?: number | null;
  } = {},
) {
  return makeQuestion({
    id,
    type: "face_a_face",
    category_id: overrides.categoryId ?? 1,
    bonne_reponse: overrides.bonne_reponse ?? "Paris",
    alias: overrides.alias ?? [],
    enonce: `Question ${id} ?`,
  });
}

describe("pickFaceAFaceQuestions", () => {
  it("retourne tableau vide pour pool vide", () => {
    expect(pickFaceAFaceQuestions([], SAMPLE_CATEGORIES)).toEqual([]);
  });

  it("limite à `count` questions même si le pool est plus grand", () => {
    const pool = Array.from({ length: 100 }, (_, i) => faf(`q${i}`));
    const picked = pickFaceAFaceQuestions(pool, SAMPLE_CATEGORIES, 50);
    expect(picked).toHaveLength(50);
  });

  it("retourne tout le pool si plus petit que `count`", () => {
    const pool = Array.from({ length: 5 }, (_, i) => faf(`q${i}`));
    const picked = pickFaceAFaceQuestions(pool, SAMPLE_CATEGORIES, 50);
    expect(picked).toHaveLength(5);
  });

  it("joint les infos de catégorie", () => {
    const pool = [faf("q1", { categoryId: 2 })];
    const picked = pickFaceAFaceQuestions(pool, SAMPLE_CATEGORIES, 1);
    expect(picked[0]!.category?.nom).toBe("Géographie");
  });

  it("défallaulte à '' si bonne_reponse est null", () => {
    const pool = [makeQuestion({ id: "x", type: "face_a_face", bonne_reponse: null })];
    const picked = pickFaceAFaceQuestions(pool, SAMPLE_CATEGORIES, 1);
    expect(picked[0]!.bonne_reponse).toBe("");
  });

  it("conserve les alias comme string[]", () => {
    const pool = [
      faf("q1", { alias: ["Bonaparte", "Napoléon Ier"] }),
      faf("q2", {}),
    ];
    const picked = pickFaceAFaceQuestions(pool, SAMPLE_CATEGORIES, 50);
    const q1 = picked.find((p) => p.id === "q1");
    expect(q1!.alias).toEqual(["Bonaparte", "Napoléon Ier"]);
  });

  it("est déterministe avec un RNG seedé", () => {
    const pool = Array.from({ length: 20 }, (_, i) => faf(`q${i}`));
    const rng1 = makeSeededRng(42);
    const rng2 = makeSeededRng(42);
    const picked1 = pickFaceAFaceQuestions(pool, SAMPLE_CATEGORIES, 10, rng1);
    const picked2 = pickFaceAFaceQuestions(pool, SAMPLE_CATEGORIES, 10, rng2);
    expect(picked1.map((p) => p.id)).toEqual(picked2.map((p) => p.id));
  });
});

describe("nextQuestionIndex", () => {
  it("retourne -1 si poolSize ≤ 0", () => {
    expect(nextQuestionIndex(0, new Set())).toBe(-1);
  });

  it("sélectionne un index non utilisé", () => {
    const used = new Set<number>([0, 1, 2]);
    for (let i = 0; i < 50; i++) {
      const idx = nextQuestionIndex(5, used);
      expect([3, 4]).toContain(idx);
    }
  });

  it("accepte de recycler quand tout est utilisé", () => {
    const used = new Set<number>([0, 1, 2, 3, 4]);
    const idx = nextQuestionIndex(5, used);
    expect(idx).toBeGreaterThanOrEqual(0);
    expect(idx).toBeLessThan(5);
  });

  it("est déterministe avec un RNG seedé", () => {
    const used = new Set<number>();
    const rng1 = makeSeededRng(7);
    const rng2 = makeSeededRng(7);
    expect(nextQuestionIndex(10, used, rng1)).toBe(
      nextQuestionIndex(10, used, rng2),
    );
  });
});

describe("botResponseDelayMs", () => {
  it("reste dans l'intervalle du profil sans bonus de lecture", () => {
    for (const level of ["facile", "moyen", "difficile"] as const) {
      const profile = BOT_PROFILES[level];
      for (let i = 0; i < 50; i++) {
        const d = botResponseDelayMs(level);
        expect(d).toBeGreaterThanOrEqual(profile.minDelayMs);
        expect(d).toBeLessThanOrEqual(profile.maxDelayMs);
      }
    }
  });

  it("retourne un entier", () => {
    const d = botResponseDelayMs("moyen");
    expect(Number.isInteger(d)).toBe(true);
  });

  it("ajoute un bonus de lecture proportionnel à la longueur de la question", () => {
    // Avec une longueur d'énoncé non-nulle, le délai doit être plus
    // grand que le min du profil seul.
    const baseLow = BOT_PROFILES.difficile.minDelayMs;
    const withReading = botResponseDelayMs("difficile", {
      enonceLength: 200,
      answerLength: 0,
      rng: () => 0, // tire le min de l'intervalle de base
    });
    expect(withReading).toBeGreaterThan(baseLow);
  });

  it("plafonne à 8 000 ms même avec énoncé très long", () => {
    const d = botResponseDelayMs("facile", {
      enonceLength: 5000,
      answerLength: 500,
      rng: () => 0.99,
    });
    expect(d).toBeLessThanOrEqual(8000);
  });

  it("le bot facile met plus de temps que le difficile pour la même question", () => {
    // Plage d'intervalle fixée → on prend rng=0 pour avoir le min de
    // l'intervalle de base, on ajoute la même longueur d'énoncé. Le
    // résultat doit toujours être plus grand pour facile (lecture lente).
    const easy = botResponseDelayMs("facile", {
      enonceLength: 100,
      answerLength: 20,
      rng: () => 0,
    });
    const hard = botResponseDelayMs("difficile", {
      enonceLength: 100,
      answerLength: 20,
      rng: () => 0,
    });
    expect(easy).toBeGreaterThan(hard);
  });
});

describe("botAnswersCorrectly", () => {
  it("facile ≈ 50 %, difficile ≈ 90 % sur un grand échantillon", () => {
    const trials = 5000;
    let easyHits = 0;
    let hardHits = 0;
    for (let i = 0; i < trials; i++) {
      if (botAnswersCorrectly("facile")) easyHits++;
      if (botAnswersCorrectly("difficile")) hardHits++;
    }
    const easyRate = easyHits / trials;
    const hardRate = hardHits / trials;
    expect(easyRate).toBeGreaterThan(0.4);
    expect(easyRate).toBeLessThan(0.6);
    expect(hardRate).toBeGreaterThan(0.82);
    expect(hardRate).toBeLessThan(0.97);
  });

  it("est déterministe avec un rng injecté", () => {
    // rng qui renvoie 0 → toujours < prob → toujours correct
    expect(botAnswersCorrectly("facile", () => 0)).toBe(true);
    // rng qui renvoie 0.999 → jamais < prob → toujours faux
    expect(botAnswersCorrectly("difficile", () => 0.999)).toBe(false);
  });
});

describe("computeFafXp", () => {
  it("0 XP en cas de défaite", () => {
    expect(computeFafXp({ won: false, timeLeftMs: 30_000 })).toBe(0);
  });

  it("500 XP si plus de 30 s restantes", () => {
    expect(computeFafXp({ won: true, timeLeftMs: 55_000 })).toBe(500);
    expect(computeFafXp({ won: true, timeLeftMs: 30_000 })).toBe(500);
  });

  it("400 XP entre 15 et 30 s restantes", () => {
    expect(computeFafXp({ won: true, timeLeftMs: 25_000 })).toBe(400);
    expect(computeFafXp({ won: true, timeLeftMs: 15_000 })).toBe(400);
  });

  it("300 XP entre 5 et 15 s restantes", () => {
    expect(computeFafXp({ won: true, timeLeftMs: 10_000 })).toBe(300);
    expect(computeFafXp({ won: true, timeLeftMs: 5_000 })).toBe(300);
  });

  it("200 XP pour victoire de justesse (< 5 s)", () => {
    expect(computeFafXp({ won: true, timeLeftMs: 1_000 })).toBe(200);
    expect(computeFafXp({ won: true, timeLeftMs: 0 })).toBe(200);
  });
});

describe("BOT_PROFILES", () => {
  it("couvre les 3 difficultés", () => {
    expect(Object.keys(BOT_PROFILES).sort()).toEqual([
      "difficile",
      "facile",
      "moyen",
    ]);
  });

  it("la proba augmente avec la difficulté", () => {
    expect(BOT_PROFILES.facile.correctProbability).toBeLessThan(
      BOT_PROFILES.moyen.correctProbability,
    );
    expect(BOT_PROFILES.moyen.correctProbability).toBeLessThan(
      BOT_PROFILES.difficile.correctProbability,
    );
  });

  it("le délai diminue avec la difficulté", () => {
    expect(BOT_PROFILES.facile.minDelayMs).toBeGreaterThan(
      BOT_PROFILES.difficile.minDelayMs,
    );
  });
});

describe("Constantes FAF", () => {
  it("FAF_DURATION_MS = 60 s", () => {
    expect(FAF_DURATION_MS).toBe(60_000);
  });

  it("FAF_POOL_SIZE > 10 (pool suffisant)", () => {
    expect(FAF_POOL_SIZE).toBeGreaterThan(10);
  });
});
