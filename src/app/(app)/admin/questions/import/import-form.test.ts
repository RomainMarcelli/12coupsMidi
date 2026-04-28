/**
 * G1.1 — Tests du détecteur "réponse contenue dans énoncé".
 *
 * On teste sur des objets bruts (pré-Zod) car l'import-form lance le
 * détecteur AVANT la validation pour pouvoir afficher les warnings
 * même quand la question a un autre champ invalide (ex: `categorie_id`
 * au lieu de `category_slug`).
 */

import { describe, expect, it } from "vitest";
import {
  detectInconsistentFormat,
  detectSuspiciousRawQuestion,
  extractInconsistentFormatFromRaw,
  extractSuspiciousFromRaw,
} from "./detect-suspicious";

describe("detectSuspiciousRawQuestion", () => {
  it("détecte le cas Beethoven historique", () => {
    const q = {
      type: "face_a_face",
      enonce: "Combien de symphonies Beethoven a composées ?",
      bonne_reponse: "Beethoven",
    };
    expect(detectSuspiciousRawQuestion(q)).toBe(true);
  });

  it("ne flag pas une question correcte", () => {
    const q = {
      type: "face_a_face",
      enonce: "Combien de symphonies Beethoven a composées ?",
      bonne_reponse: "9",
    };
    expect(detectSuspiciousRawQuestion(q)).toBe(false);
  });

  it("ne flag pas une réponse complètement absente de l'énoncé", () => {
    const q = {
      type: "face_a_face",
      enonce: "Quel poète a écrit Les Fleurs du mal ?",
      bonne_reponse: "Baudelaire",
    };
    expect(detectSuspiciousRawQuestion(q)).toBe(false);
  });

  it("flag avec normalisation casse et accents", () => {
    const q = {
      type: "face_a_face",
      enonce: "Compléter l'expression : Appeler un chat un …",
      bonne_reponse: "Chat",
    };
    expect(detectSuspiciousRawQuestion(q)).toBe(true);
  });

  it("ignore les tokens de moins de 3 caractères", () => {
    const q = {
      type: "face_a_face",
      enonce: "Combien font 2 + 2 ?",
      bonne_reponse: "4",
    };
    expect(detectSuspiciousRawQuestion(q)).toBe(false);
  });

  it("ne match pas une sous-chaîne dans un mot plus long (or vs alors)", () => {
    const q = {
      type: "face_a_face",
      enonce: "Alors, quelle est la couleur du soleil ?",
      bonne_reponse: "or",
    };
    // "or" fait 2 chars → ignoré (filtre ≥ 3 chars).
    expect(detectSuspiciousRawQuestion(q)).toBe(false);
  });

  it("ne match pas une sous-chaîne (4 chars) dans un mot plus long", () => {
    const q = {
      type: "face_a_face",
      enonce: "Quel est le métier d'un orateur ?",
      bonne_reponse: "Orat",
    };
    // "orat" 4 chars présent dans "orateur" mais pas comme mot
    // entouré d'espaces → pas détecté (faux positif évité).
    expect(detectSuspiciousRawQuestion(q)).toBe(false);
  });

  it("retourne false sur des objets sans enonce ou sans bonne_reponse", () => {
    expect(detectSuspiciousRawQuestion({})).toBe(false);
    expect(detectSuspiciousRawQuestion({ enonce: "x" })).toBe(false);
    expect(detectSuspiciousRawQuestion({ bonne_reponse: "x" })).toBe(false);
    expect(detectSuspiciousRawQuestion(null)).toBe(false);
    expect(detectSuspiciousRawQuestion(undefined)).toBe(false);
    expect(detectSuspiciousRawQuestion("string")).toBe(false);
  });

  it("ignore les questions à choix (pas de bonne_reponse string)", () => {
    const q = {
      type: "quizz_2",
      enonce: "Beethoven est compositeur ?",
      reponses: [{ text: "Oui", correct: true }],
    };
    expect(detectSuspiciousRawQuestion(q)).toBe(false);
  });
});

describe("extractSuspiciousFromRaw", () => {
  it("retourne les indices et types des suspectes", () => {
    const arr = [
      { type: "face_a_face", enonce: "OK ?", bonne_reponse: "42" },
      {
        type: "face_a_face",
        enonce: "Beethoven combien de symphonies ?",
        bonne_reponse: "Beethoven",
      },
      { type: "face_a_face", enonce: "Couleur du ciel ?", bonne_reponse: "Bleu" },
    ];
    const out = extractSuspiciousFromRaw(arr);
    expect(out).toHaveLength(1);
    expect(out[0]?.idx).toBe(1);
    expect(out[0]?.type).toBe("face_a_face");
    expect(out[0]?.bonneReponse).toBe("Beethoven");
  });

  it("retourne [] sur un input qui n'est pas un tableau", () => {
    expect(extractSuspiciousFromRaw({})).toEqual([]);
    expect(extractSuspiciousFromRaw(null)).toEqual([]);
    expect(extractSuspiciousFromRaw("foo")).toEqual([]);
  });

  it("préserve l'index original même si la question a un champ invalide Zod", () => {
    // Cas-clé : si l'utilisateur a une question avec `categorie_id`
    // (faute de frappe), Zod échoue mais le détecteur doit quand même
    // pointer la suspecte avec son index réel.
    const arr = [
      { type: "face_a_face", enonce: "X", bonne_reponse: "1", categorie_id: 1 },
      {
        type: "face_a_face",
        enonce: "Beethoven combien de symphonies ?",
        bonne_reponse: "Beethoven",
        categorie_id: 1,
      },
    ];
    const out = extractSuspiciousFromRaw(arr);
    expect(out).toHaveLength(1);
    expect(out[0]?.idx).toBe(1);
  });
});

// ---------------------------------------------------------------------------
// I2.3 — Format incohérent CPC
// ---------------------------------------------------------------------------

describe("detectInconsistentFormat", () => {
  it("détecte le cas Oscars (Le Parrain sans parenthèses)", () => {
    const q = {
      type: "coup_par_coup",
      enonce: "Films ayant remporté au moins 9 Oscars",
      propositions: [
        { text: "Titanic (1997, 11 Oscars)", isIntrus: false },
        { text: "Ben-Hur (1959, 11 Oscars)", isIntrus: false },
        { text: "Le Parrain", isIntrus: true },
        { text: "West Side Story (1961, 10 Oscars)", isIntrus: false },
      ],
    };
    const reason = detectInconsistentFormat(q);
    expect(reason).not.toBeNull();
    expect(reason?.withParens).toHaveLength(3);
    expect(reason?.withoutParens).toEqual(["Le Parrain"]);
  });

  it("ne flag pas si TOUTES les propositions ont des parenthèses", () => {
    const q = {
      type: "coup_par_coup",
      enonce: "Test",
      propositions: [
        { text: "A (1)", isIntrus: false },
        { text: "B (2)", isIntrus: false },
      ],
    };
    expect(detectInconsistentFormat(q)).toBeNull();
  });

  it("ne flag pas si AUCUNE proposition n'a de parenthèses", () => {
    const q = {
      type: "coup_par_coup",
      enonce: "Test",
      propositions: [
        { text: "A", isIntrus: false },
        { text: "B", isIntrus: false },
      ],
    };
    expect(detectInconsistentFormat(q)).toBeNull();
  });

  it("ignore les types non coup_par_coup", () => {
    const q = {
      type: "quizz_2",
      enonce: "Test",
      propositions: [
        { text: "Oui (sûr)", isIntrus: false },
        { text: "Non", isIntrus: false },
      ],
    };
    expect(detectInconsistentFormat(q)).toBeNull();
  });

  it("ignore quand moins de 2 propositions", () => {
    const q = {
      type: "coup_par_coup",
      enonce: "Test",
      propositions: [{ text: "Solo (sans match)", isIntrus: false }],
    };
    expect(detectInconsistentFormat(q)).toBeNull();
  });

  it("retourne null sur un objet vide ou invalide", () => {
    expect(detectInconsistentFormat({})).toBeNull();
    expect(detectInconsistentFormat(null)).toBeNull();
    expect(detectInconsistentFormat(undefined)).toBeNull();
    expect(detectInconsistentFormat({ type: "coup_par_coup" })).toBeNull();
  });
});

describe("extractInconsistentFormatFromRaw", () => {
  it("retourne uniquement les CPC à format incohérent", () => {
    const arr = [
      // OK : tous avec parens.
      {
        type: "coup_par_coup",
        enonce: "OK",
        propositions: [
          { text: "A (1)" },
          { text: "B (2)" },
        ],
      },
      // KO : mix.
      {
        type: "coup_par_coup",
        enonce: "Mix",
        propositions: [
          { text: "C (3)" },
          { text: "D" },
        ],
      },
      // Pas concerné : quizz.
      {
        type: "quizz_2",
        enonce: "Quizz",
        propositions: [{ text: "E (5)" }, { text: "F" }],
      },
    ];
    const out = extractInconsistentFormatFromRaw(arr);
    expect(out).toHaveLength(1);
    expect(out[0]?.idx).toBe(1);
    expect(out[0]?.enonce).toBe("Mix");
  });

  it("retourne [] sur un input qui n'est pas un tableau", () => {
    expect(extractInconsistentFormatFromRaw({})).toEqual([]);
    expect(extractInconsistentFormatFromRaw(null)).toEqual([]);
  });
});
