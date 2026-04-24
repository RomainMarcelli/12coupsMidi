import { describe, expect, it } from "vitest";
import { isMatch, matchDetails, normalize } from "./fuzzy-match";

describe("normalize", () => {
  it("met en minuscules", () => {
    expect(normalize("PARIS")).toBe("paris");
  });

  it("retire les accents (NFD)", () => {
    expect(normalize("Napoléon")).toBe("napoleon");
    expect(normalize("ÉCOLE")).toBe("ecole");
    expect(normalize("crème brûlée")).toBe("creme brulee");
    expect(normalize("Ça va")).toBe("ca va");
  });

  it("retire les articles français en début de chaîne", () => {
    expect(normalize("Le Louvre")).toBe("louvre");
    expect(normalize("La Tour Eiffel")).toBe("tour eiffel");
    expect(normalize("Les Misérables")).toBe("miserables");
    expect(normalize("L'Odyssée")).toBe("odyssee");
    expect(normalize("Un président")).toBe("president");
    expect(normalize("Une oeuvre")).toBe("oeuvre");
  });

  it("retire l'article anglais 'the' en début", () => {
    expect(normalize("The Beatles")).toBe("beatles");
  });

  it("ne retire pas un article en milieu de chaîne", () => {
    expect(normalize("Valet de la reine")).toBe("valet de la reine");
  });

  it("normalise les espaces multiples, tirets et underscores", () => {
    expect(normalize("Jean   Dupont")).toBe("jean dupont");
    expect(normalize("Saint-Exupéry")).toBe("saint exupery");
    expect(normalize("foo_bar_baz")).toBe("foo bar baz");
  });

  it("trim les espaces en début et fin", () => {
    expect(normalize("   paris   ")).toBe("paris");
  });

  it("normalise les apostrophes typographiques", () => {
    expect(normalize("L’Odyssée")).toBe("odyssee");
    expect(normalize("L‘Odyssée")).toBe("odyssee");
  });

  it("retourne chaîne vide pour entrée vide", () => {
    expect(normalize("")).toBe("");
    expect(normalize("   ")).toBe("");
  });
});

describe("isMatch", () => {
  it("match sur égalité stricte après normalisation", () => {
    expect(isMatch("Paris", "paris")).toBe(true);
    expect(isMatch("PARIS", "Paris")).toBe(true);
  });

  it("match en ignorant les accents", () => {
    expect(isMatch("napoleon", "Napoléon")).toBe(true);
    expect(isMatch("eiffel", "Eiffel")).toBe(true);
  });

  it("match en ignorant les articles", () => {
    expect(isMatch("Louvre", "Le Louvre")).toBe(true);
    expect(isMatch("Le Louvre", "Louvre")).toBe(true);
  });

  it("tolère une faute de frappe (Levenshtein ≤ 2) sur strings > 3 chars", () => {
    expect(isMatch("napoleom", "napoléon")).toBe(true);
    expect(isMatch("einstien", "Einstein")).toBe(true);
  });

  it("rejette une faute trop grosse (distance > 2)", () => {
    expect(isMatch("napoelinf", "napoléon")).toBe(false);
  });

  it("exige une égalité stricte pour les saisies ≤ 3 caractères", () => {
    // "oui" vs "nui" = 1 edit, mais on refuse à cause de la longueur
    expect(isMatch("oui", "nui")).toBe(false);
    expect(isMatch("rat", "cat")).toBe(false);
    // Match strict toujours OK
    expect(isMatch("oui", "oui")).toBe(true);
  });

  it("match sur un alias fourni", () => {
    expect(
      isMatch("Bonaparte", "Napoléon", ["Napoléon Ier", "Bonaparte"]),
    ).toBe(true);
  });

  it("rejette une entrée vide", () => {
    expect(isMatch("", "Paris")).toBe(false);
    expect(isMatch("   ", "Paris")).toBe(false);
  });

  it("ignore les alias vides ou invalides", () => {
    expect(isMatch("Paris", "Paris", ["", "   "])).toBe(true);
  });

  it("respecte un seuil de Levenshtein personnalisé", () => {
    // Distance 2 mais seuil 1 → refus
    expect(isMatch("einstien", "Einstein", [], 1)).toBe(false);
    expect(isMatch("einstien", "Einstein", [], 2)).toBe(true);
  });
});

describe("matchDetails", () => {
  it("retourne le candidat qui a matché", () => {
    const res = matchDetails("Bonaparte", "Napoléon", ["Bonaparte"]);
    expect(res).toEqual({ matched: true, on: "Bonaparte" });
  });

  it("retourne matched: false si aucun candidat", () => {
    expect(matchDetails("xyz", "Paris")).toEqual({ matched: false });
  });

  it("retourne le candidat principal en cas de match sur celui-ci", () => {
    const res = matchDetails("paris", "Paris", ["Lutèce"]);
    expect(res).toEqual({ matched: true, on: "Paris" });
  });
});
