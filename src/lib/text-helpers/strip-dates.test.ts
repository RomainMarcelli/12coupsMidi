import { describe, expect, it } from "vitest";
import { stripDatesFromText } from "./strip-dates";

describe("stripDatesFromText", () => {
  it("retire une année 4 chiffres entre parenthèses", () => {
    expect(stripDatesFromText("Pierre Curie (1903)")).toBe("Pierre Curie");
    expect(stripDatesFromText("Henri Becquerel (1903)")).toBe("Henri Becquerel");
  });

  it("ne touche pas aux noms sans parenthèses", () => {
    expect(stripDatesFromText("Werner Heisenberg")).toBe("Werner Heisenberg");
    expect(stripDatesFromText("Albert Einstein")).toBe("Albert Einstein");
  });

  it("ne touche pas aux parenthèses contenant autre chose qu'une année", () => {
    expect(stripDatesFromText("Sciences (Domaine: physique)")).toBe(
      "Sciences (Domaine: physique)",
    );
    expect(stripDatesFromText("Joueur (capitaine)")).toBe("Joueur (capitaine)");
  });

  it("retire plusieurs années", () => {
    expect(stripDatesFromText("Foo (1969) bar (2024)")).toBe("Foo bar");
  });

  it("accepte les années 2000-2099", () => {
    expect(stripDatesFromText("Médaille (2024)")).toBe("Médaille");
    expect(stripDatesFromText("Récompense (2099)")).toBe("Récompense");
  });

  it("ignore les années ≥ 2100 ou < 1000", () => {
    expect(stripDatesFromText("Cyborg (2100)")).toBe("Cyborg (2100)");
    expect(stripDatesFromText("Antiquité (-50)")).toBe("Antiquité (-50)");
  });

  it("collapse les espaces multiples laissés par le strip", () => {
    expect(stripDatesFromText("A (1900) B")).toBe("A B");
  });

  it("retourne une chaîne vide telle quelle", () => {
    expect(stripDatesFromText("")).toBe("");
  });
});
