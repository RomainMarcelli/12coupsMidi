/**
 * G2.1 — Tests de l'intégrité des mappings du tableau périodique.
 *
 * Vérifie qu'il y a bien exactement 10 familles, que chaque famille a
 * un style et un label définis, et que les helpers de matching sont
 * cohérents.
 */

import { describe, expect, it } from "vitest";
import {
  ALL_FAMILIES,
  FAMILY_STYLES,
  getFamilyStyle,
  matchElement,
  normalizeForMatch,
  type PeriodicElement,
} from "./types";

describe("FAMILY_STYLES", () => {
  it("a exactement 10 familles (I2.1 — revert split non-metaux)", () => {
    expect(Object.keys(FAMILY_STYLES)).toHaveLength(10);
    expect(ALL_FAMILIES).toHaveLength(10);
  });

  it("chaque famille a un bg hex et un label non vide", () => {
    for (const f of ALL_FAMILIES) {
      const style = FAMILY_STYLES[f];
      expect(style).toBeDefined();
      expect(style.bg).toMatch(/^#[0-9a-f]{6}$/i);
      expect(style.label.length).toBeGreaterThan(0);
    }
  });

  it("ALL_FAMILIES match exactement les clés de FAMILY_STYLES", () => {
    expect(new Set(ALL_FAMILIES)).toEqual(new Set(Object.keys(FAMILY_STYLES)));
  });

  it("getFamilyStyle retourne le fallback pour une famille inconnue", () => {
    // Cas typique : ancienne valeur de BDD non migrée.
    const style = getFamilyStyle("famille-qui-n-existe-pas");
    expect(style.bg).toBe("#9ca3af");
    expect(style.label).toBe("Inconnu");
  });

  it("getFamilyStyle retourne le bon style pour une famille connue", () => {
    expect(getFamilyStyle("metaux-alcalins").label).toBe("Métaux alcalins");
    expect(getFamilyStyle("gaz-nobles").label).toBe("Gaz nobles");
  });

  it("metaux-pauvres et non-metaux (anciens slugs H) → fallback Inconnu", () => {
    // Ces slugs ont été retirés en I2.1.
    expect(getFamilyStyle("metaux-pauvres").label).toBe("Inconnu");
    expect(getFamilyStyle("non-metaux").label).toBe("Inconnu");
  });
});

describe("normalizeForMatch", () => {
  it("supprime accents et casse", () => {
    expect(normalizeForMatch("Hélium")).toBe("helium");
    expect(normalizeForMatch("ÉTAIN")).toBe("etain");
  });

  it("supprime ponctuation et espaces", () => {
    expect(normalizeForMatch("hydro-gène!")).toBe("hydrogene");
  });
});

describe("matchElement", () => {
  // Mini-jeu de données pour les tests.
  const elements: PeriodicElement[] = [
    {
      numero_atomique: 1,
      symbole: "H",
      nom: "Hydrogène",
      periode: 1,
      groupe: 1,
      famille: "non-metaux-reactifs",
      masse_atomique: 1.008,
      etat_standard: "gaz",
      grid_row: 1,
      grid_col: 1,
    },
    {
      numero_atomique: 2,
      symbole: "He",
      nom: "Hélium",
      periode: 1,
      groupe: 18,
      famille: "gaz-nobles",
      masse_atomique: 4.0026,
      etat_standard: "gaz",
      grid_row: 1,
      grid_col: 18,
    },
    {
      numero_atomique: 79,
      symbole: "Au",
      nom: "Or",
      periode: 6,
      groupe: 11,
      famille: "metaux-transition",
      masse_atomique: 196.97,
      etat_standard: "solide",
      grid_row: 6,
      grid_col: 11,
    },
  ];

  it("match exact sur le symbole (case-insensitive)", () => {
    expect(matchElement("H", elements)?.numero_atomique).toBe(1);
    expect(matchElement("h", elements)?.numero_atomique).toBe(1);
    expect(matchElement("He", elements)?.numero_atomique).toBe(2);
    expect(matchElement("AU", elements)?.numero_atomique).toBe(79);
  });

  it("match exact sur le nom français (avec accents)", () => {
    expect(matchElement("Hydrogène", elements)?.numero_atomique).toBe(1);
    expect(matchElement("hydrogene", elements)?.numero_atomique).toBe(1);
    expect(matchElement("HÉLIUM", elements)?.numero_atomique).toBe(2);
  });

  it("tolère 1 typo Levenshtein si nom ≥ 4 chars", () => {
    expect(matchElement("hydrogen", elements)?.numero_atomique).toBe(1); // -e final
    expect(matchElement("hydrogenne", elements)?.numero_atomique).toBe(1); // n doublé
  });

  it("ne tolère PAS 2 typos (Levenshtein > 1)", () => {
    // "heluim" = "helium" avec swap u↔i → distance 2 → rejeté.
    expect(matchElement("heluim", elements)).toBeNull();
  });

  it("ne tolère PAS 1 typo si nom < 4 chars (évite faux positifs)", () => {
    // "or" n'a que 2 chars → strict, mais "H" 1 char OK car symbole exact.
    expect(matchElement("ar", elements)).toBeNull();
  });

  it("retourne null sur input vide", () => {
    expect(matchElement("", elements)).toBeNull();
    expect(matchElement("   ", elements)).toBeNull();
  });

  it("retourne null sur match inexistant", () => {
    expect(matchElement("xyzzy", elements)).toBeNull();
  });
});
