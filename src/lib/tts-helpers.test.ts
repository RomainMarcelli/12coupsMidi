import { describe, expect, it } from "vitest";
import { buildTTSText, buildTTSFeedbackText } from "./tts-helpers";

describe("buildTTSText", () => {
  it("énoncé seul (pas de choix)", () => {
    expect(buildTTSText({ enonce: "Quelle est la capitale ?" })).toBe(
      "Quelle est la capitale ?",
    );
  });

  it("2 choix : sépare par 'ou'", () => {
    expect(
      buildTTSText({
        enonce: "Quel architecte ?",
        choices: ["Frank Gehry", "Norman Foster"],
      }),
    ).toBe("Quel architecte ?. Frank Gehry ou Norman Foster");
  });

  it("4 choix : virgules + 'ou' final", () => {
    expect(
      buildTTSText({
        enonce: "Quel océan ?",
        choices: ["Atlantique", "Pacifique", "Indien", "Arctique"],
      }),
    ).toBe("Quel océan ?. Atlantique, Pacifique, Indien ou Arctique");
  });

  it("7 choix (Jeu 2)", () => {
    expect(
      buildTTSText({
        enonce: "Trouve l'intrus",
        choices: ["A", "B", "C", "D", "E", "F", "G"],
      }),
    ).toBe("Trouve l'intrus. A, B, C, D, E, F ou G");
  });

  it("ajoute l'explication en dernier si fournie", () => {
    expect(
      buildTTSText({
        enonce: "Quel architecte ?",
        choices: ["Frank Gehry", "Norman Foster"],
        explanation: "Frank Gehry a conçu le musée Guggenheim.",
      }),
    ).toBe(
      "Quel architecte ?. Frank Gehry ou Norman Foster. Frank Gehry a conçu le musée Guggenheim.",
    );
  });

  it("filtre les choix vides", () => {
    expect(
      buildTTSText({
        enonce: "X",
        choices: ["", "A", "  ", "B"],
      }),
    ).toBe("X. A ou B");
  });

  it("ne casse pas si choices vide", () => {
    expect(buildTTSText({ enonce: "X", choices: [] })).toBe("X");
  });
});

describe("buildTTSFeedbackText", () => {
  it("bonne réponse + explication", () => {
    expect(
      buildTTSFeedbackText({
        isCorrect: true,
        explanation: "Effectivement, c'est en 1969.",
      }),
    ).toBe("Bonne réponse. Effectivement, c'est en 1969.");
  });

  it("mauvaise réponse + label + explication", () => {
    expect(
      buildTTSFeedbackText({
        isCorrect: false,
        correctLabel: "Frank Gehry",
        explanation: "L'architecte canado-américain a conçu Bilbao.",
      }),
    ).toBe(
      "Mauvaise réponse. La bonne réponse était Frank Gehry. L'architecte canado-américain a conçu Bilbao.",
    );
  });

  it("mauvaise réponse sans label disponible (fallback explication seule)", () => {
    expect(
      buildTTSFeedbackText({
        isCorrect: false,
        correctLabel: null,
        explanation: "Bilbao est en Espagne.",
      }),
    ).toBe("Mauvaise réponse. Bilbao est en Espagne.");
  });

  it("bonne réponse sans explication", () => {
    expect(buildTTSFeedbackText({ isCorrect: true })).toBe("Bonne réponse");
  });
});
