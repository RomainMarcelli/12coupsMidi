import { describe, expect, it } from "vitest";
import {
  getDisplayedAnswer,
  truncate,
  type DisplayedAnswerInput,
} from "./questions-table-helpers";

describe("getDisplayedAnswer", () => {
  it("face_a_face → retourne `bonne_reponse`", () => {
    const q: DisplayedAnswerInput = {
      type: "face_a_face",
      bonne_reponse: "Lisbonne",
      reponses: null,
    };
    expect(getDisplayedAnswer(q)).toBe("Lisbonne");
  });

  it("etoile → retourne `bonne_reponse`", () => {
    const q: DisplayedAnswerInput = {
      type: "etoile",
      bonne_reponse: "Picasso",
      reponses: null,
    };
    expect(getDisplayedAnswer(q)).toBe("Picasso");
  });

  it("coup_maitre → retourne `bonne_reponse`", () => {
    const q: DisplayedAnswerInput = {
      type: "coup_maitre",
      bonne_reponse: "Da Vinci",
      reponses: null,
    };
    expect(getDisplayedAnswer(q)).toBe("Da Vinci");
  });

  it("quizz_2 → retourne le texte de la réponse correcte", () => {
    const q: DisplayedAnswerInput = {
      type: "quizz_2",
      bonne_reponse: null,
      reponses: [
        { text: "Vrai", correct: true },
        { text: "Faux", correct: false },
      ],
    };
    expect(getDisplayedAnswer(q)).toBe("Vrai");
  });

  it("quizz_4 → retourne le texte de la réponse correcte (parmi 4)", () => {
    const q: DisplayedAnswerInput = {
      type: "quizz_4",
      bonne_reponse: null,
      reponses: [
        { text: "Léonard de Vinci", correct: true },
        { text: "Michel-Ange", correct: false },
        { text: "Raphaël", correct: false },
        { text: "Botticelli", correct: false },
      ],
    };
    expect(getDisplayedAnswer(q)).toBe("Léonard de Vinci");
  });

  it("coup_par_coup → préfixe 'Intrus :' devant la réponse incorrecte", () => {
    const q: DisplayedAnswerInput = {
      type: "coup_par_coup",
      bonne_reponse: null,
      reponses: [
        { text: "France", correct: true },
        { text: "Espagne", correct: true },
        { text: "Italie", correct: true },
        { text: "Portugal", correct: true },
        { text: "Allemagne", correct: true },
        { text: "Belgique", correct: true },
        { text: "Japon", correct: false },
      ],
    };
    expect(getDisplayedAnswer(q)).toBe("Intrus : Japon");
  });

  it("fallback '—' si bonne_reponse vide pour face_a_face", () => {
    const q: DisplayedAnswerInput = {
      type: "face_a_face",
      bonne_reponse: "",
      reponses: null,
    };
    expect(getDisplayedAnswer(q)).toBe("—");
  });

  it("fallback '—' si reponses null pour quizz_4", () => {
    const q: DisplayedAnswerInput = {
      type: "quizz_4",
      bonne_reponse: null,
      reponses: null,
    };
    expect(getDisplayedAnswer(q)).toBe("—");
  });

  it("fallback '—' si pas de réponse correcte trouvée pour quizz_2", () => {
    const q: DisplayedAnswerInput = {
      type: "quizz_2",
      bonne_reponse: null,
      reponses: [
        { text: "A", correct: false },
        { text: "B", correct: false },
      ],
    };
    expect(getDisplayedAnswer(q)).toBe("—");
  });

  it("ignore les entrées malformées dans reponses", () => {
    const q: DisplayedAnswerInput = {
      type: "quizz_4",
      bonne_reponse: null,
      reponses: [
        { text: "OK", correct: true },
        // entrées invalides ignorées
        null,
        "garbage",
        { texts: "wrong-key" },
      ] as unknown as DisplayedAnswerInput["reponses"],
    };
    expect(getDisplayedAnswer(q)).toBe("OK");
  });
});

describe("truncate", () => {
  it("ne tronque pas une chaîne courte", () => {
    expect(truncate("Hello")).toBe("Hello");
  });

  it("tronque avec ellipsis si > max", () => {
    const s = "abcdefghijklmnopqrstuvwxyz";
    expect(truncate(s, 10)).toBe("abcdefghi…");
  });

  it("respecte le param max custom", () => {
    expect(truncate("Bonjour le monde", 8)).toBe("Bonjour…");
  });
});
