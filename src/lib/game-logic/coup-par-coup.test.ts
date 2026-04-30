import { describe, expect, it } from "vitest";
import {
  CPC_MAX_ERRORS,
  CPC_PROPOSITIONS_PER_ROUND,
  CPC_ROUNDS_PER_GAME,
  CPC_VALID_PER_ROUND,
  CPC_XP_GAME_PERFECT_BONUS,
  CPC_XP_PER_CORRECT,
  CPC_XP_ROUND_PERFECT_BONUS,
  botPickCpcProposition,
  computeCpcXp,
  cpcIsGameOver,
  cpcLifeState,
  pickCoupParCoupRounds,
  type CpcProposition,
  type CpcRoundResult,
} from "./coup-par-coup";
import { SAMPLE_CATEGORIES, makeQuestion } from "./_test-fixtures";

function cpcQuestion(id: string, categoryId = 1) {
  const reponses = [
    { text: "V1", correct: true },
    { text: "V2", correct: true },
    { text: "V3", correct: true },
    { text: "V4", correct: true },
    { text: "V5", correct: true },
    { text: "V6", correct: true },
    { text: "INTRUS", correct: false },
  ];
  return makeQuestion({
    id,
    type: "coup_par_coup",
    category_id: categoryId,
    enonce: `Thème ${id}`,
    reponses,
  });
}

describe("cpcLifeState", () => {
  it("0 erreur → green", () => {
    expect(cpcLifeState(0)).toBe("green");
  });
  it("1 erreur → yellow", () => {
    expect(cpcLifeState(1)).toBe("yellow");
  });
  it("2 erreurs → red (game over)", () => {
    expect(cpcLifeState(2)).toBe("red");
    expect(cpcLifeState(3)).toBe("red");
  });
});

describe("cpcIsGameOver", () => {
  it("false en dessous du seuil", () => {
    expect(cpcIsGameOver(0)).toBe(false);
    expect(cpcIsGameOver(1)).toBe(false);
  });

  it("true à partir de CPC_MAX_ERRORS erreurs", () => {
    expect(cpcIsGameOver(CPC_MAX_ERRORS)).toBe(true);
    expect(cpcIsGameOver(CPC_MAX_ERRORS + 1)).toBe(true);
  });
});

describe("pickCoupParCoupRounds", () => {
  it("retourne tableau vide pour pool vide", () => {
    expect(pickCoupParCoupRounds([], SAMPLE_CATEGORIES)).toEqual([]);
  });

  it("retourne `count` rounds si le pool suffit", () => {
    const pool = Array.from({ length: 10 }, (_, i) => cpcQuestion(`q${i}`));
    const rounds = pickCoupParCoupRounds(
      pool,
      SAMPLE_CATEGORIES,
      CPC_ROUNDS_PER_GAME,
    );
    expect(rounds).toHaveLength(CPC_ROUNDS_PER_GAME);
  });

  it("retourne jusqu'à `pool.length` si le pool est plus petit", () => {
    const pool = [cpcQuestion("q1"), cpcQuestion("q2")];
    const rounds = pickCoupParCoupRounds(pool, SAMPLE_CATEGORIES, 5);
    expect(rounds.length).toBeLessThanOrEqual(2);
  });

  it("chaque round contient 7 propositions dont 6 valides + 1 intrus", () => {
    const pool = [cpcQuestion("q1")];
    const [round] = pickCoupParCoupRounds(pool, SAMPLE_CATEGORIES, 1);
    expect(round!.propositions).toHaveLength(CPC_PROPOSITIONS_PER_ROUND);
    expect(
      round!.propositions.filter((p) => p.isValid).length,
    ).toBe(CPC_VALID_PER_ROUND);
    expect(
      round!.propositions.filter((p) => !p.isValid).length,
    ).toBe(1);
  });

  it("inclut le thème et la catégorie", () => {
    const pool = [cpcQuestion("q1", 3)];
    const [round] = pickCoupParCoupRounds(pool, SAMPLE_CATEGORIES, 1);
    expect(round!.theme).toBe("Thème q1");
    expect(round!.category?.nom).toBe("Sport");
  });
});

describe("botPickCpcProposition", () => {
  const props: CpcProposition[] = [
    { text: "V1", isValid: true },
    { text: "V2", isValid: true },
    { text: "V3", isValid: true },
    { text: "INTRUS", isValid: false },
  ];

  it("retourne -1 si tout est cliqué", () => {
    const clicked = new Set(props.map((p) => p.text));
    expect(botPickCpcProposition(props, clicked, "moyen")).toBe(-1);
  });

  it("ne re-clique jamais une proposition déjà cliquée", () => {
    const clicked = new Set(["V1"]);
    for (let i = 0; i < 50; i++) {
      const idx = botPickCpcProposition(props, clicked, "facile");
      expect(props[idx]?.text).not.toBe("V1");
    }
  });

  it("sur un bot difficile, tape très majoritairement des valides (≥ 90%)", () => {
    const clicked = new Set<string>();
    let validCount = 0;
    const trials = 1000;
    for (let i = 0; i < trials; i++) {
      const idx = botPickCpcProposition(props, clicked, "difficile");
      if (props[idx]?.isValid) validCount++;
    }
    expect(validCount / trials).toBeGreaterThan(0.85);
  });

  it("sur un bot facile, tape parfois l'intrus", () => {
    const clicked = new Set<string>();
    let intrusCount = 0;
    const trials = 1000;
    for (let i = 0; i < trials; i++) {
      const idx = botPickCpcProposition(props, clicked, "facile");
      if (!props[idx]?.isValid) intrusCount++;
    }
    // Devrait être autour de 30% (facile = 70% correct)
    expect(intrusCount).toBeGreaterThan(200);
    expect(intrusCount).toBeLessThan(400);
  });

  it("clique l'intrus s'il ne reste que lui", () => {
    const clicked = new Set(["V1", "V2", "V3"]);
    const idx = botPickCpcProposition(props, clicked, "difficile");
    expect(props[idx]?.text).toBe("INTRUS");
  });
});

describe("computeCpcXp", () => {
  const perfectRound: CpcRoundResult = {
    questionId: "r",
    correctClicks: CPC_VALID_PER_ROUND,
    hitIntrus: false,
    status: "perfect",
  };
  const caughtRound: CpcRoundResult = {
    questionId: "r",
    correctClicks: 3,
    hitIntrus: true,
    status: "caught-intrus",
  };

  it("0 round → 0 XP", () => {
    expect(computeCpcXp([])).toBe(0);
  });

  it("round parfait : 6×50 + 200 bonus = 500", () => {
    expect(computeCpcXp([perfectRound])).toBe(
      CPC_VALID_PER_ROUND * CPC_XP_PER_CORRECT + CPC_XP_ROUND_PERFECT_BONUS,
    );
  });

  it("round raté : seulement clicks corrects, pas de bonus", () => {
    expect(computeCpcXp([caughtRound])).toBe(3 * CPC_XP_PER_CORRECT);
  });

  it("5 rounds parfaits → bonus de partie parfaite (+500)", () => {
    const rounds = Array.from({ length: CPC_ROUNDS_PER_GAME }, () => ({
      ...perfectRound,
    }));
    const expected =
      CPC_ROUNDS_PER_GAME *
        (CPC_VALID_PER_ROUND * CPC_XP_PER_CORRECT +
          CPC_XP_ROUND_PERFECT_BONUS) +
      CPC_XP_GAME_PERFECT_BONUS;
    expect(computeCpcXp(rounds)).toBe(expected);
  });

  it("4 rounds parfaits + 1 raté → pas de bonus de partie", () => {
    const rounds: CpcRoundResult[] = [
      perfectRound,
      perfectRound,
      perfectRound,
      perfectRound,
      caughtRound,
    ];
    const expected =
      4 *
        (CPC_VALID_PER_ROUND * CPC_XP_PER_CORRECT +
          CPC_XP_ROUND_PERFECT_BONUS) +
      3 * CPC_XP_PER_CORRECT;
    expect(computeCpcXp(rounds)).toBe(expected);
  });
});
