import { describe, expect, it } from "vitest";
import {
  guessLabelFromExplanation,
  isGenericChoiceLabel,
  resolveCorrectAnswerLabel,
} from "./answer-display";

describe("isGenericChoiceLabel", () => {
  it("true sur les placeholders L'un / L'autre (avec apostrophes variantes)", () => {
    expect(isGenericChoiceLabel("L'un")).toBe(true);
    expect(isGenericChoiceLabel("l'autre")).toBe(true);
    expect(isGenericChoiceLabel("L’autre")).toBe(true);
    expect(isGenericChoiceLabel("L un")).toBe(true);
  });

  it("true sur Vrai/Faux/Plus/Moins/Oui/Non", () => {
    expect(isGenericChoiceLabel("Vrai")).toBe(true);
    expect(isGenericChoiceLabel("FAUX")).toBe(true);
    expect(isGenericChoiceLabel("Plus")).toBe(true);
    expect(isGenericChoiceLabel("moins")).toBe(true);
    expect(isGenericChoiceLabel("Oui")).toBe(true);
    expect(isGenericChoiceLabel("Non")).toBe(true);
  });

  it("false sur les vrais libellés", () => {
    expect(isGenericChoiceLabel("Astana")).toBe(false);
    expect(isGenericChoiceLabel("Charles de Gaulle")).toBe(false);
    expect(isGenericChoiceLabel("La mer Morte")).toBe(false);
    expect(isGenericChoiceLabel("843")).toBe(false);
  });

  it("false sur null/empty", () => {
    expect(isGenericChoiceLabel(null)).toBe(false);
    expect(isGenericChoiceLabel(undefined)).toBe(false);
    expect(isGenericChoiceLabel("")).toBe(false);
    expect(isGenericChoiceLabel("   ")).toBe(false);
  });
});

describe("guessLabelFromExplanation", () => {
  it("coupe sur première parenthèse", () => {
    expect(
      guessLabelFromExplanation(
        "Astana (anciennement Noursoultan) est la capitale du Kazakhstan depuis 1997.",
      ),
    ).toBe("Astana");
  });

  it("coupe sur première virgule", () => {
    expect(
      guessLabelFromExplanation(
        "Louis XVI, place de la Révolution (actuelle place de la Concorde).",
      ),
    ).toBe("Louis XVI");
  });

  it("coupe sur 'est'/'a été'", () => {
    expect(
      guessLabelFromExplanation(
        "De Gaulle est devenu président en 1959.",
      ),
    ).toBe("De Gaulle");
    expect(
      guessLabelFromExplanation(
        "Werner Heisenberg a été le formulateur du principe d'incertitude.",
      ),
    ).toBe("Werner Heisenberg");
  });

  it("coupe sur ':'", () => {
    expect(
      guessLabelFromExplanation(
        "L'architecte canado-américain : Frank Gehry.",
      ),
    ).toBe("L'architecte canado-américain");
  });

  it("ne coupe PAS sur ' ou '", () => {
    // Important : "Vrai ou faux : ..." dans l'énoncé ne doit pas tronquer
    expect(
      guessLabelFromExplanation("Frank Gehry ou Norman Foster"),
    ).toBe("Frank Gehry ou Norman Foster");
  });

  it("retourne null si trop court ou vide", () => {
    expect(guessLabelFromExplanation(null)).toBeNull();
    expect(guessLabelFromExplanation("")).toBeNull();
    expect(guessLabelFromExplanation("ab")).toBeNull();
  });

  it("cape à 60 caractères avec ellipse", () => {
    const long =
      "Une explication très longue sans aucune ponctuation forte qui dépasse largement la longueur cible";
    const out = guessLabelFromExplanation(long);
    expect(out).not.toBeNull();
    expect(out!.length).toBeLessThanOrEqual(61);
    expect(out!.endsWith("…")).toBe(true);
  });
});

describe("resolveCorrectAnswerLabel", () => {
  it("garde un correctText informatif tel quel", () => {
    expect(
      resolveCorrectAnswerLabel("Brasília", "Brasília depuis 1960."),
    ).toBe("Brasília");
  });

  it("extrait depuis l'explication si correctText est générique", () => {
    expect(
      resolveCorrectAnswerLabel(
        "L'autre",
        "Astana (anciennement Noursoultan) est la capitale du Kazakhstan.",
      ),
    ).toBe("Astana");
  });

  it("retourne null si correctText générique ET pas d'explication", () => {
    expect(resolveCorrectAnswerLabel("L'autre", null)).toBeNull();
    expect(resolveCorrectAnswerLabel("Vrai", "")).toBeNull();
  });

  it("cas Frank Gehry — extrait début de l'explication", () => {
    expect(
      resolveCorrectAnswerLabel(
        "L'autre",
        "L'architecte canado-américain Frank Gehry a conçu le musée Guggenheim de Bilbao, inauguré en 1997.",
      ),
    ).toBe("L'architecte canado-américain Frank Gehry");
  });
});
