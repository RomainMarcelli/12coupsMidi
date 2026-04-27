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
  detectSuspiciousRawQuestion,
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
