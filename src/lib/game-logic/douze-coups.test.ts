import { describe, expect, it } from "vitest";
import {
  DC_MAX_ERRORS,
  DC_STARTING_CAGNOTTE,
  applyCorrectAnswer,
  applyDuelResult,
  applyWrongAnswer,
  availableDuelThemes,
  consumeDuelTheme,
  dcAliveCount,
  dcLifeState,
  dcNextActiveIdx,
  dcPodium,
  dcShouldTriggerDuel,
  makeInitialDuelThemes,
  nextPhaseAfter,
  pickDuelCategories,
  resetErrorsForNewGame,
  type DcPlayer,
} from "./douze-coups";
import { makeSeededRng } from "./_test-fixtures";

function player(
  id: string,
  overrides: Partial<DcPlayer> = {},
): DcPlayer {
  return {
    id,
    pseudo: id,
    isBot: false,
    color: "gold",
    cagnotte: DC_STARTING_CAGNOTTE,
    errors: 0,
    isEliminated: false,
    eliminatedAt: null,
    correctCount: 0,
    wrongCount: 0,
    ...overrides,
  };
}

function category(id: number, nom: string) {
  return { id, nom, slug: nom.toLowerCase(), couleur: null };
}

describe("dcLifeState", () => {
  it("0 → green, 1 → yellow, 2+ → red", () => {
    expect(dcLifeState(0)).toBe("green");
    expect(dcLifeState(1)).toBe("yellow");
    expect(dcLifeState(2)).toBe("red");
    expect(dcLifeState(99)).toBe("red");
  });
});

describe("dcShouldTriggerDuel", () => {
  it("true à DC_MAX_ERRORS erreurs", () => {
    expect(dcShouldTriggerDuel(DC_MAX_ERRORS - 1)).toBe(false);
    expect(dcShouldTriggerDuel(DC_MAX_ERRORS)).toBe(true);
    expect(dcShouldTriggerDuel(DC_MAX_ERRORS + 5)).toBe(true);
  });
});

describe("pickDuelCategories", () => {
  const cats = [
    category(1, "Histoire"),
    category(2, "Géographie"),
    category(3, "Sport"),
    category(4, "Art"),
  ];

  it("tire N catégories parmi celles éligibles (>= minQuizz4)", () => {
    const counts = new Map([[1, 3], [2, 5], [3, 0], [4, 2]]);
    const out = pickDuelCategories(cats, counts, 2, 1, makeSeededRng(42));
    expect(out).toHaveLength(2);
    // Sport (0 quizz_4) est exclu
    expect(out.map((c) => c.id)).not.toContain(3);
  });

  it("retourne [] si pas assez de catégories éligibles", () => {
    const counts = new Map([[1, 1]]);
    expect(pickDuelCategories(cats, counts, 2)).toEqual([]);
  });

  it("est déterministe avec un RNG seedé", () => {
    const counts = new Map(cats.map((c) => [c.id, 5] as [number, number]));
    const a = pickDuelCategories(cats, counts, 2, 1, makeSeededRng(7));
    const b = pickDuelCategories(cats, counts, 2, 1, makeSeededRng(7));
    expect(a.map((c) => c.id)).toEqual(b.map((c) => c.id));
  });
});

describe("makeInitialDuelThemes", () => {
  const cats = [category(1, "A"), category(2, "B"), category(3, "C")];

  it("renvoie 2 thèmes non consommés", () => {
    const counts = new Map(cats.map((c) => [c.id, 5] as [number, number]));
    const themes = makeInitialDuelThemes(cats, counts, makeSeededRng(1));
    expect(themes).not.toBeNull();
    expect(themes!.theme1Used).toBe(false);
    expect(themes!.theme2Used).toBe(false);
    expect(themes!.theme1.id).not.toBe(themes!.theme2.id);
  });

  it("renvoie null si pas assez de catégories", () => {
    expect(
      makeInitialDuelThemes([cats[0]!], new Map([[1, 5]])),
    ).toBeNull();
  });
});

describe("availableDuelThemes + consumeDuelTheme", () => {
  const themes = {
    theme1: category(1, "Histoire"),
    theme2: category(2, "Géographie"),
    theme1Used: false,
    theme2Used: false,
  };

  it("au départ, les 2 thèmes sont disponibles", () => {
    expect(availableDuelThemes(themes).map((c) => c.id)).toEqual([1, 2]);
  });

  it("après consommation de 1, il en reste 1", () => {
    const after = consumeDuelTheme(themes, 1);
    expect(availableDuelThemes(after).map((c) => c.id)).toEqual([2]);
  });

  it("consommation d'un id non trouvé = pas de changement", () => {
    expect(consumeDuelTheme(themes, 99)).toEqual(themes);
  });

  it("après consommation des 2, availableDuelThemes retourne []", () => {
    const a = consumeDuelTheme(themes, 1);
    const b = consumeDuelTheme(a, 2);
    expect(availableDuelThemes(b)).toEqual([]);
  });
});

describe("dcNextActiveIdx", () => {
  const players = [
    player("a"),
    player("b"),
    player("c"),
    player("d"),
  ];

  it("rotation classique", () => {
    expect(dcNextActiveIdx(0, players)).toBe(1);
    expect(dcNextActiveIdx(3, players)).toBe(0);
  });

  it("saute les éliminés", () => {
    const ps = players.map((p, i) =>
      i === 1 || i === 2 ? { ...p, isEliminated: true } : p,
    );
    expect(dcNextActiveIdx(0, ps)).toBe(3);
    expect(dcNextActiveIdx(3, ps)).toBe(0);
  });

  it("retourne -1 si tous éliminés", () => {
    const ps = players.map((p) => ({ ...p, isEliminated: true }));
    expect(dcNextActiveIdx(0, ps)).toBe(-1);
  });
});

describe("dcAliveCount", () => {
  it("compte les non-éliminés", () => {
    const ps = [
      player("a"),
      player("b", { isEliminated: true }),
      player("c"),
    ];
    expect(dcAliveCount(ps)).toBe(2);
  });
});

describe("applyCorrectAnswer", () => {
  it("incrémente correctCount SANS toucher à la cagnotte", () => {
    const ps = [player("a"), player("b")];
    const updated = applyCorrectAnswer(ps, "a");
    expect(updated[0]!.correctCount).toBe(1);
    // Cagnotte inchangée : l'argent ne bouge qu'aux duels / face-à-face
    expect(updated[0]!.cagnotte).toBe(DC_STARTING_CAGNOTTE);
    expect(updated[1]!.cagnotte).toBe(DC_STARTING_CAGNOTTE);
  });
});

describe("applyWrongAnswer", () => {
  it("+1 erreur et +1 wrongCount pour le joueur ciblé", () => {
    const ps = [player("a")];
    const updated = applyWrongAnswer(ps, "a");
    expect(updated[0]!.errors).toBe(1);
    expect(updated[0]!.wrongCount).toBe(1);
  });
});

describe("applyDuelResult", () => {
  it("bonne réponse de l'adversaire : le challenger est éliminé, cagnotte transférée", () => {
    const ps = [
      player("rouge", { cagnotte: 10_000, errors: 2 }),
      player("adv", { cagnotte: 15_000, errors: 1 }),
    ];
    const out = applyDuelResult(
      ps,
      "rouge",
      "adv",
      /* adversaryCorrect */ true,
      /* now */ 12345,
    );
    const rouge = out.find((p) => p.id === "rouge")!;
    const adv = out.find((p) => p.id === "adv")!;
    expect(rouge.isEliminated).toBe(true);
    expect(rouge.eliminatedAt).toBe(12345);
    expect(rouge.cagnotte).toBe(0);
    expect(adv.cagnotte).toBe(25_000);
    expect(adv.eliminatedAt).toBeNull();
    // L'adversaire survit → ses erreurs sont remises à 0
    expect(adv.errors).toBe(0);
  });

  it("mauvaise réponse de l'adversaire : l'adversaire est éliminé, cagnotte transférée", () => {
    const ps = [
      player("rouge", { cagnotte: 10_000, errors: 2 }),
      player("adv", { cagnotte: 15_000 }),
    ];
    const out = applyDuelResult(ps, "rouge", "adv", false);
    const rouge = out.find((p) => p.id === "rouge")!;
    const adv = out.find((p) => p.id === "adv")!;
    expect(adv.isEliminated).toBe(true);
    expect(adv.cagnotte).toBe(0);
    expect(rouge.cagnotte).toBe(25_000);
    expect(rouge.errors).toBe(0);
  });

  it("les autres joueurs (non impliqués) restent inchangés", () => {
    const ps = [
      player("rouge"),
      player("adv"),
      player("c", { cagnotte: 7_000 }),
    ];
    const out = applyDuelResult(ps, "rouge", "adv", true);
    expect(out.find((p) => p.id === "c")!.cagnotte).toBe(7_000);
    expect(out.find((p) => p.id === "c")!.isEliminated).toBe(false);
  });
});

describe("resetErrorsForNewGame", () => {
  it("remet les erreurs à 0 pour les non-éliminés uniquement", () => {
    const ps = [
      player("a", { errors: 1 }),
      player("b", { errors: 2, isEliminated: true }),
    ];
    const out = resetErrorsForNewGame(ps);
    expect(out[0]!.errors).toBe(0);
    expect(out[1]!.errors).toBe(2); // inchangé (éliminé)
  });
});

describe("nextPhaseAfter", () => {
  const alive3 = [player("a"), player("b"), player("c")];
  const alive2 = [player("a"), player("b"), player("c", { isEliminated: true })];
  const alive1 = [
    player("a"),
    player("b", { isEliminated: true }),
    player("c", { isEliminated: true }),
  ];

  it("après jeu1 avec 3+ vivants → jeu2", () => {
    expect(nextPhaseAfter("jeu1", alive3)).toBe("jeu2");
  });

  it("après jeu1 avec 2 vivants → faceaface", () => {
    expect(nextPhaseAfter("jeu1", alive2)).toBe("faceaface");
  });

  it("après jeu2 avec 2 vivants → faceaface", () => {
    expect(nextPhaseAfter("jeu2", alive2)).toBe("faceaface");
  });

  it("avec <=1 vivant → results", () => {
    expect(nextPhaseAfter("jeu1", alive1)).toBe("results");
  });
});

describe("dcPodium", () => {
  it("classe le vainqueur (non-éliminé) en premier puis par eliminatedAt desc", () => {
    // Scénario typique de fin de partie : un vainqueur, 3 éliminés à
    // différents moments. Le DERNIER éliminé doit finir 2e, le PREMIER
    // dernier — peu importe leur cagnotte ou leurs bonnes réponses.
    const ps = [
      player("rom1", {
        isEliminated: true,
        eliminatedAt: 1000, // éliminé tôt (Jeu 1)
        correctCount: 0,
      }),
      player("rom2", {
        isEliminated: true,
        eliminatedAt: 2000, // éliminé en milieu (Jeu 2)
        correctCount: 6,
      }),
      player("rom3", {
        isEliminated: false, // vainqueur
        cagnotte: 40_000,
        correctCount: 6,
      }),
      player("rom4", {
        isEliminated: true,
        eliminatedAt: 3000, // dernier éliminé (face-à-face final)
        correctCount: 4,
      }),
    ];
    const podium = dcPodium(ps).map((p) => p.id);
    expect(podium).toEqual(["rom3", "rom4", "rom2", "rom1"]);
  });

  it("ignore le nombre de bonnes réponses dans le tri", () => {
    // rom2 a plus de bonnes réponses que rom4 mais a été éliminé avant
    // → rom4 finit devant rom2.
    const ps = [
      player("v", { isEliminated: false }),
      player("rom2", { isEliminated: true, eliminatedAt: 100, correctCount: 99 }),
      player("rom4", { isEliminated: true, eliminatedAt: 200, correctCount: 1 }),
    ];
    expect(dcPodium(ps).map((p) => p.id)).toEqual(["v", "rom4", "rom2"]);
  });

  it("fallback cagnotte si eliminatedAt absent (compat ancien state)", () => {
    const ps = [
      player("v", { isEliminated: false }),
      player("a", { isEliminated: true, eliminatedAt: null, cagnotte: 5_000 }),
      player("b", { isEliminated: true, eliminatedAt: null, cagnotte: 15_000 }),
    ];
    // Pas de timestamp → on retombe sur la cagnotte décroissante
    expect(dcPodium(ps).map((p) => p.id)).toEqual(["v", "b", "a"]);
  });
});
