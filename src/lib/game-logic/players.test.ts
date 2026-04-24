import { describe, expect, it } from "vitest";
import {
  FREE_MAX_PLAYERS,
  MIN_PLAYERS,
  OFFICIAL_MAX_PLAYERS,
  defaultBotName,
  newPlayerId,
  nextActivePlayerIdx,
  validateMultiConfig,
  type MultiConfig,
} from "./players";

function player(id: string, pseudo: string, isBot = false) {
  return { id, pseudo, isBot };
}

describe("validateMultiConfig", () => {
  const base: MultiConfig = {
    mode: "vs_bots",
    botDifficulty: "moyen",
    isOfficialRules: true,
    players: [player("a", "Romain"), player("b", "Bot 1", true)],
  };

  it("accepte une config valide", () => {
    expect(validateMultiConfig(base)).toBeNull();
  });

  it("rejette moins de MIN_PLAYERS joueurs", () => {
    expect(
      validateMultiConfig({ ...base, players: base.players.slice(0, 1) }),
    ).toMatch(/au moins/);
  });

  it("rejette plus de OFFICIAL_MAX_PLAYERS en règles officielles", () => {
    const many = Array.from({ length: OFFICIAL_MAX_PLAYERS + 1 }, (_, i) =>
      player(`p${i}`, `P${i}`),
    );
    expect(
      validateMultiConfig({ ...base, players: many }),
    ).toMatch(/règles officielles/);
  });

  it("accepte OFFICIAL_MAX_PLAYERS + 1 en règles libres", () => {
    const many = Array.from({ length: OFFICIAL_MAX_PLAYERS + 1 }, (_, i) =>
      player(`p${i}`, `P${i}`),
    );
    expect(
      validateMultiConfig({
        ...base,
        players: many,
        isOfficialRules: false,
      }),
    ).toBeNull();
  });

  it("rejette plus de FREE_MAX_PLAYERS même en libre", () => {
    const many = Array.from({ length: FREE_MAX_PLAYERS + 1 }, (_, i) =>
      player(`p${i}`, `P${i}`),
    );
    expect(
      validateMultiConfig({
        ...base,
        players: many,
        isOfficialRules: false,
      }),
    ).toMatch(/Maximum/);
  });

  it("rejette un pseudo vide", () => {
    expect(
      validateMultiConfig({
        ...base,
        players: [player("a", ""), player("b", "Bot 1", true)],
      }),
    ).toMatch(/pseudo/);
  });

  it("rejette vs_bots sans difficulté", () => {
    expect(
      validateMultiConfig({ ...base, botDifficulty: undefined }),
    ).toMatch(/difficult/);
  });

  it("rejette les pseudos en double", () => {
    expect(
      validateMultiConfig({
        ...base,
        players: [player("a", "Romain"), player("b", "Romain")],
      }),
    ).toMatch(/uniques/);
  });

  it("ignore la casse et les espaces pour la détection des doublons", () => {
    expect(
      validateMultiConfig({
        ...base,
        players: [player("a", "Romain"), player("b", " romain ")],
      }),
    ).toMatch(/uniques/);
  });
});

describe("nextActivePlayerIdx", () => {
  const players = [
    player("a", "A"),
    player("b", "B"),
    player("c", "C"),
    player("d", "D"),
  ];

  it("avance d'un cran", () => {
    expect(nextActivePlayerIdx(0, players)).toBe(1);
    expect(nextActivePlayerIdx(2, players)).toBe(3);
  });

  it("revient au début après le dernier", () => {
    expect(nextActivePlayerIdx(3, players)).toBe(0);
  });

  it("saute les joueurs éliminés", () => {
    const eliminated = new Set(["b", "c"]);
    expect(nextActivePlayerIdx(0, players, eliminated)).toBe(3);
    expect(nextActivePlayerIdx(3, players, eliminated)).toBe(0);
  });

  it("retourne -1 si tout le monde est éliminé", () => {
    const eliminated = new Set(["a", "b", "c", "d"]);
    expect(nextActivePlayerIdx(0, players, eliminated)).toBe(-1);
  });

  it("retourne -1 sur liste vide", () => {
    expect(nextActivePlayerIdx(0, [])).toBe(-1);
  });
});

describe("defaultBotName", () => {
  it("varie selon la difficulté", () => {
    expect(defaultBotName(0, "facile")).toMatch(/débutant/);
    expect(defaultBotName(0, "moyen")).toMatch(/joueur/);
    expect(defaultBotName(0, "difficile")).toMatch(/champion/);
  });

  it("numérote à partir de 1", () => {
    expect(defaultBotName(0, "moyen")).toMatch(/1$/);
    expect(defaultBotName(1, "moyen")).toMatch(/2$/);
  });
});

describe("newPlayerId", () => {
  it("retourne des ids uniques", () => {
    const ids = new Set(Array.from({ length: 20 }, () => newPlayerId()));
    expect(ids.size).toBe(20);
  });

  it("retourne une string non vide", () => {
    expect(newPlayerId().length).toBeGreaterThan(0);
  });
});

describe("MIN / MAX constants", () => {
  it("MIN_PLAYERS ≥ 2", () => {
    expect(MIN_PLAYERS).toBeGreaterThanOrEqual(2);
  });
  it("OFFICIAL_MAX_PLAYERS = 4", () => {
    expect(OFFICIAL_MAX_PLAYERS).toBe(4);
  });
  it("FREE_MAX_PLAYERS > OFFICIAL_MAX_PLAYERS", () => {
    expect(FREE_MAX_PLAYERS).toBeGreaterThan(OFFICIAL_MAX_PLAYERS);
  });
});
