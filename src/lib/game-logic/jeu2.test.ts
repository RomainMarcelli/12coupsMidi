import { describe, expect, it } from "vitest";
import {
  JEU2_MAX_INDICES,
  computeBlurPx,
  computeJeu2Xp,
  pickOneEtoile,
  placeholderAvatarUrl,
} from "./jeu2";
import { SAMPLE_CATEGORIES, makeQuestion } from "./_test-fixtures";

function etoile(overrides: {
  id: string;
  bonne_reponse?: string;
  alias?: string[];
  indices?: string[];
  category_id?: number | null;
  image_url?: string | null;
}) {
  return makeQuestion({
    id: overrides.id,
    type: "etoile",
    category_id: overrides.category_id ?? 1,
    bonne_reponse: overrides.bonne_reponse ?? "Napoléon",
    alias: overrides.alias ?? ["Bonaparte"],
    indices: overrides.indices ?? [
      "Indice 1",
      "Indice 2",
      "Indice 3",
      "Indice 4",
      "Indice 5",
    ],
    image_url: overrides.image_url ?? null,
  });
}

describe("pickOneEtoile", () => {
  it("retourne null pour un pool vide", () => {
    expect(pickOneEtoile([], SAMPLE_CATEGORIES)).toBeNull();
  });

  it("retourne une question valide du pool", () => {
    const pool = [etoile({ id: "e1" }), etoile({ id: "e2" })];
    const picked = pickOneEtoile(pool, SAMPLE_CATEGORIES);
    expect(picked).not.toBeNull();
    expect(["e1", "e2"]).toContain(picked!.id);
  });

  it("préfère les questions avec ≥ 3 indices", () => {
    const small = etoile({ id: "small", indices: ["un"] });
    const big = etoile({ id: "big" }); // 5 indices par défaut
    const pool = [small, big];
    // Sur 100 tirages, on ne doit jamais prendre "small"
    for (let i = 0; i < 100; i++) {
      const picked = pickOneEtoile(pool, SAMPLE_CATEGORIES);
      expect(picked!.id).toBe("big");
    }
  });

  it("accepte les questions même sans assez d'indices si le pool n'a que celles-ci", () => {
    const small = etoile({ id: "only", indices: ["un"] });
    const picked = pickOneEtoile([small], SAMPLE_CATEGORIES);
    expect(picked!.id).toBe("only");
    expect(picked!.indices).toHaveLength(1);
  });

  it("tronque à JEU2_MAX_INDICES indices", () => {
    const many = etoile({
      id: "many",
      indices: Array.from({ length: 10 }, (_, i) => `i${i}`),
    });
    const picked = pickOneEtoile([many], SAMPLE_CATEGORIES);
    expect(picked!.indices).toHaveLength(JEU2_MAX_INDICES);
  });

  it("joint les infos de catégorie", () => {
    const pool = [etoile({ id: "e1", category_id: 2 })];
    const picked = pickOneEtoile(pool, SAMPLE_CATEGORIES);
    expect(picked!.category?.nom).toBe("Géographie");
  });
});

describe("computeBlurPx", () => {
  it("0 indice révélé → flou max", () => {
    expect(computeBlurPx(0)).toBe(48);
  });

  it("5 indices révélés → net (0px)", () => {
    expect(computeBlurPx(5)).toBe(0);
  });

  it("valeurs hors bornes sont clampées", () => {
    expect(computeBlurPx(-10)).toBe(48);
    expect(computeBlurPx(99)).toBe(0);
  });

  it("suit la décroissance attendue", () => {
    const vals = [0, 1, 2, 3, 4, 5].map(computeBlurPx);
    expect(vals).toEqual([48, 36, 24, 14, 6, 0]);
  });
});

describe("computeJeu2Xp", () => {
  it("0 indice révélé → 0 (n'a rien tenté)", () => {
    expect(computeJeu2Xp(0)).toBe(0);
  });

  it("barème : 1 → 500, 2 → 400, 3 → 300, 4 → 200, 5 → 100", () => {
    expect(computeJeu2Xp(1)).toBe(500);
    expect(computeJeu2Xp(2)).toBe(400);
    expect(computeJeu2Xp(3)).toBe(300);
    expect(computeJeu2Xp(4)).toBe(200);
    expect(computeJeu2Xp(5)).toBe(100);
  });

  it("6+ indices révélés = 100 (plafonné)", () => {
    expect(computeJeu2Xp(6)).toBe(100);
    expect(computeJeu2Xp(99)).toBe(100);
  });
});

describe("placeholderAvatarUrl", () => {
  it("encode le seed pour l'URL", () => {
    expect(placeholderAvatarUrl("Napoléon Ier")).toContain(
      "seed=Napol%C3%A9on%20Ier",
    );
  });

  it("fallback si seed vide", () => {
    expect(placeholderAvatarUrl("")).toContain("seed=Inconnu");
  });
});
