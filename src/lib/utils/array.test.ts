import { describe, expect, it } from "vitest";
import { shuffle } from "./array";

describe("shuffle", () => {
  it("retourne tableau vide quand input vide", () => {
    expect(shuffle([])).toEqual([]);
  });

  it("retourne tableau de 1 élément inchangé", () => {
    expect(shuffle([42])).toEqual([42]);
  });

  it("ne mute pas le tableau d'entrée", () => {
    const input = [1, 2, 3, 4, 5];
    const before = input.slice();
    shuffle(input);
    expect(input).toEqual(before);
  });

  it("garde tous les éléments (permutation pure)", () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const out = shuffle(input);
    expect(out).toHaveLength(input.length);
    expect(out.slice().sort((a, b) => a - b)).toEqual(input);
  });

  it("produit au moins 2 ordres différents sur 50 itérations (sanity)", () => {
    const input = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
    const seen = new Set<string>();
    for (let i = 0; i < 50; i++) {
      seen.add(shuffle(input).join(","));
    }
    // Sur 10! = 3 628 800 permutations, 50 essais devraient en produire
    // au moins 2 distinctes — chance d'échec pratiquement nulle.
    expect(seen.size).toBeGreaterThan(1);
  });
});
