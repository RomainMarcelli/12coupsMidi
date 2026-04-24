import { describe, expect, it } from "vitest";
import {
  DUEL_XP_WIN,
  buildDuelThemes,
  computeDuelXp,
  pickDuelQuestion,
  pickDuelThemes,
  resolveDuel,
  shuffleDuelAnswers,
  type DuelQuestion,
} from "./duel";
import { makeQuestion, makeSeededRng } from "./_test-fixtures";

function cat(id: number, nom: string) {
  return { id, nom, slug: nom.toLowerCase(), couleur: "#fff" };
}

function q4(id: string, categoryId: number) {
  return makeQuestion({
    id,
    type: "quizz_4",
    category_id: categoryId,
    enonce: `Question ${id} ?`,
    reponses: [
      { text: "A", correct: true },
      { text: "B", correct: false },
      { text: "C", correct: false },
      { text: "D", correct: false },
    ],
  });
}

describe("buildDuelThemes", () => {
  it("retourne vide si aucune quizz_4", () => {
    const pool = [makeQuestion({ id: "x", type: "quizz_2" })];
    expect(buildDuelThemes(pool, [cat(1, "Histoire")])).toEqual([]);
  });

  it("groupe par catégorie et ignore celles sans quizz_4", () => {
    const pool = [
      q4("a", 1),
      q4("b", 1),
      q4("c", 2),
      makeQuestion({ id: "x", type: "quizz_2", category_id: 3 }),
    ];
    const themes = buildDuelThemes(pool, [
      cat(1, "Histoire"),
      cat(2, "Géographie"),
      cat(3, "Sport"), // Sans quizz_4
    ]);
    expect(themes).toHaveLength(2);
    expect(themes.map((t) => t.label).sort()).toEqual([
      "Géographie",
      "Histoire",
    ]);
    const hist = themes.find((t) => t.label === "Histoire");
    expect(hist?.questions).toHaveLength(2);
  });
});

describe("pickDuelThemes", () => {
  const themes = [
    { categoryId: 1, label: "A", couleur: null, questions: [] },
    { categoryId: 2, label: "B", couleur: null, questions: [] },
    { categoryId: 3, label: "C", couleur: null, questions: [] },
  ];

  it("retourne 2 thèmes pour le 1er Duel", () => {
    const picked = pickDuelThemes(themes, 2, makeSeededRng(42));
    expect(picked).toHaveLength(2);
    expect(new Set(picked.map((t) => t.categoryId)).size).toBe(2);
  });

  it("retourne 1 thème pour le 2e Duel", () => {
    expect(pickDuelThemes(themes, 1, makeSeededRng(42))).toHaveLength(1);
  });

  it("déterministe avec rng seedé", () => {
    const a = pickDuelThemes(themes, 2, makeSeededRng(7));
    const b = pickDuelThemes(themes, 2, makeSeededRng(7));
    expect(a.map((t) => t.categoryId)).toEqual(b.map((t) => t.categoryId));
  });

  it("retourne tous les thèmes si count > themes.length", () => {
    expect(pickDuelThemes(themes.slice(0, 1), 2)).toHaveLength(1);
  });
});

describe("pickDuelQuestion", () => {
  const theme = {
    categoryId: 1,
    label: "T",
    couleur: null,
    questions: [
      { id: "q1", enonce: "Q1", reponses: [], explication: null, difficulte: 2 },
      { id: "q2", enonce: "Q2", reponses: [], explication: null, difficulte: 2 },
    ],
  };

  it("tire une question existante", () => {
    const picked = pickDuelQuestion(theme, makeSeededRng(3));
    expect(["q1", "q2"]).toContain(picked?.id);
  });

  it("retourne null pour thème vide", () => {
    expect(
      pickDuelQuestion({
        categoryId: 0,
        label: "",
        couleur: null,
        questions: [],
      }),
    ).toBeNull();
  });
});

describe("shuffleDuelAnswers", () => {
  const base: DuelQuestion = {
    id: "q",
    enonce: "?",
    explication: null,
    difficulte: 2,
    reponses: [
      { text: "A", correct: true },
      { text: "B", correct: false },
      { text: "C", correct: false },
      { text: "D", correct: false },
    ],
  };

  it("conserve les mêmes réponses (set égal)", () => {
    const shuffled = shuffleDuelAnswers(base, makeSeededRng(9));
    const texts = shuffled.reponses.map((r) => r.text).sort();
    expect(texts).toEqual(["A", "B", "C", "D"]);
  });

  it("conserve exactement 1 réponse correcte", () => {
    const shuffled = shuffleDuelAnswers(base, makeSeededRng(9));
    expect(shuffled.reponses.filter((r) => r.correct)).toHaveLength(1);
  });
});

describe("resolveDuel", () => {
  it("bonne réponse : l'adversaire gagne", () => {
    const r = resolveDuel({
      rougeId: "rouge",
      adversaryId: "adv",
      adversaryAnsweredCorrectly: true,
      questionId: "q",
    });
    expect(r.winnerId).toBe("adv");
    expect(r.eliminatedId).toBe("rouge");
  });

  it("mauvaise réponse : l'adversaire est éliminé", () => {
    const r = resolveDuel({
      rougeId: "rouge",
      adversaryId: "adv",
      adversaryAnsweredCorrectly: false,
      questionId: "q",
    });
    expect(r.winnerId).toBe("rouge");
    expect(r.eliminatedId).toBe("adv");
  });
});

describe("computeDuelXp", () => {
  const sampleResult = {
    winnerId: "user",
    eliminatedId: "other",
    adversaryAnsweredCorrectly: true,
    questionId: "q",
  };

  it("XP_WIN si le user gagne", () => {
    expect(
      computeDuelXp({ userId: "user", result: sampleResult }),
    ).toBe(DUEL_XP_WIN);
  });

  it("0 si le user perd", () => {
    expect(
      computeDuelXp({
        userId: "other",
        result: sampleResult,
      }),
    ).toBe(0);
  });
});
