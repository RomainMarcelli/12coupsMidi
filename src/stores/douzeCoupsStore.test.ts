import { beforeEach, describe, expect, it } from "vitest";
import { useDouzeCoupsStore } from "./douzeCoupsStore";
import { DC_STARTING_CAGNOTTE } from "@/lib/game-logic/douze-coups";

const cats = [
  { id: 1, nom: "Histoire", slug: "histoire", couleur: null },
  { id: 2, nom: "Géographie", slug: "geo", couleur: null },
];

const counts = new Map([
  [1, 3],
  [2, 3],
]);

function init4() {
  const { initParty, startJeu1 } = useDouzeCoupsStore.getState();
  const res = initParty({
    players: [
      { pseudo: "User", isBot: false },
      { pseudo: "Bot 1", isBot: true, botLevel: "moyen" },
      { pseudo: "Bot 2", isBot: true, botLevel: "moyen" },
      { pseudo: "Bot 3", isBot: true, botLevel: "moyen" },
    ],
    categories: cats,
    quizz4CountByCategory: counts,
  });
  startJeu1();
  return res;
}

describe("douzeCoupsStore", () => {
  beforeEach(() => {
    useDouzeCoupsStore.getState().reset();
  });

  it("initParty rejette < 2 joueurs", () => {
    const res = useDouzeCoupsStore.getState().initParty({
      players: [{ pseudo: "Solo", isBot: false }],
      categories: cats,
      quizz4CountByCategory: counts,
    });
    expect(res.ok).toBe(false);
  });

  it("initParty rejette > 4 joueurs", () => {
    const res = useDouzeCoupsStore.getState().initParty({
      players: Array.from({ length: 5 }, (_, i) => ({
        pseudo: `P${i}`,
        isBot: false,
      })),
      categories: cats,
      quizz4CountByCategory: counts,
    });
    expect(res.ok).toBe(false);
  });

  it("initParty initialise cagnottes à DC_STARTING_CAGNOTTE", () => {
    init4();
    const state = useDouzeCoupsStore.getState();
    expect(state.players).toHaveLength(4);
    for (const p of state.players) {
      expect(p.cagnotte).toBe(DC_STARTING_CAGNOTTE);
      expect(p.isEliminated).toBe(false);
      expect(p.errors).toBe(0);
    }
  });

  it("initParty tire 2 thèmes de duel non consommés", () => {
    init4();
    const themes = useDouzeCoupsStore.getState().duelThemes;
    expect(themes).not.toBeNull();
    expect(themes!.theme1Used).toBe(false);
    expect(themes!.theme2Used).toBe(false);
  });

  it("recordCorrect incrémente correctCount sans toucher à la cagnotte", () => {
    init4();
    const id = useDouzeCoupsStore.getState().players[0]!.id;
    useDouzeCoupsStore.getState().recordCorrect(id);
    const p = useDouzeCoupsStore
      .getState()
      .players.find((pl) => pl.id === id)!;
    expect(p.correctCount).toBe(1);
    expect(p.cagnotte).toBe(DC_STARTING_CAGNOTTE);
  });

  it("recordWrong incrémente les erreurs", () => {
    init4();
    const id = useDouzeCoupsStore.getState().players[0]!.id;
    useDouzeCoupsStore.getState().recordWrong(id, "jeu1");
    const p = useDouzeCoupsStore
      .getState()
      .players.find((pl) => pl.id === id)!;
    expect(p.errors).toBe(1);
    expect(useDouzeCoupsStore.getState().phase).toBe("jeu1");
  });

  it("recordWrong bascule en duel à 2 erreurs", () => {
    init4();
    const id = useDouzeCoupsStore.getState().players[0]!.id;
    useDouzeCoupsStore.getState().recordWrong(id, "jeu1");
    useDouzeCoupsStore.getState().recordWrong(id, "jeu1");
    const state = useDouzeCoupsStore.getState();
    expect(state.phase).toBe("duel");
    expect(state.pendingDuel?.challengerId).toBe(id);
  });

  it("resolveDuel (bonne réponse) élimine le challenger et passe à jeu2", () => {
    init4();
    const players = useDouzeCoupsStore.getState().players;
    const rougeId = players[0]!.id;
    const advId = players[1]!.id;
    // Pousse le joueur 0 au rouge
    useDouzeCoupsStore.getState().recordWrong(rougeId, "jeu1");
    useDouzeCoupsStore.getState().recordWrong(rougeId, "jeu1");
    useDouzeCoupsStore.getState().designateAdversary(advId);
    // Bonne réponse de l'adversaire → challenger éliminé
    useDouzeCoupsStore.getState().resolveDuel(true, -1);
    const state = useDouzeCoupsStore.getState();
    const rouge = state.players.find((p) => p.id === rougeId)!;
    const adv = state.players.find((p) => p.id === advId)!;
    expect(rouge.isEliminated).toBe(true);
    expect(rouge.cagnotte).toBe(0);
    expect(adv.cagnotte).toBe(DC_STARTING_CAGNOTTE * 2);
    expect(state.phase).toBe("jeu2");
  });

  it("resolveDuel (mauvaise réponse) élimine l'adversaire", () => {
    init4();
    const players = useDouzeCoupsStore.getState().players;
    const rougeId = players[0]!.id;
    const advId = players[1]!.id;
    useDouzeCoupsStore.getState().recordWrong(rougeId, "jeu1");
    useDouzeCoupsStore.getState().recordWrong(rougeId, "jeu1");
    useDouzeCoupsStore.getState().designateAdversary(advId);
    useDouzeCoupsStore.getState().resolveDuel(false, -1);
    const state = useDouzeCoupsStore.getState();
    const rouge = state.players.find((p) => p.id === rougeId)!;
    const adv = state.players.find((p) => p.id === advId)!;
    expect(adv.isEliminated).toBe(true);
    expect(rouge.errors).toBe(0); // reset après duel gagné
    expect(rouge.cagnotte).toBe(DC_STARTING_CAGNOTTE * 2);
  });

  it("finalizeFaceAFace élimine le perdant, transfère cagnotte, passe en results", () => {
    init4();
    // Simule une partie jusqu'au faceaface avec 2 joueurs restants
    const players = useDouzeCoupsStore.getState().players;
    const winnerId = players[0]!.id;
    const loserId = players[1]!.id;
    useDouzeCoupsStore.getState().finalizeFaceAFace(winnerId, loserId);
    const state = useDouzeCoupsStore.getState();
    expect(state.phase).toBe("results");
    const winner = state.players.find((p) => p.id === winnerId)!;
    const loser = state.players.find((p) => p.id === loserId)!;
    expect(loser.isEliminated).toBe(true);
    expect(loser.cagnotte).toBe(0);
    expect(winner.cagnotte).toBe(DC_STARTING_CAGNOTTE * 2);
  });

  it("reset ramène le store à l'état initial", () => {
    init4();
    useDouzeCoupsStore.getState().reset();
    const state = useDouzeCoupsStore.getState();
    expect(state.phase).toBe("setup");
    expect(state.players).toEqual([]);
    expect(state.duelThemes).toBeNull();
  });
});
