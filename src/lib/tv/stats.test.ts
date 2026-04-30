import { describe, expect, it } from "vitest";
import { getFunStats } from "./stats";

describe("getFunStats", () => {
  it("returns 4 stats for any seed", () => {
    expect(getFunStats("1234")).toHaveLength(4);
    expect(getFunStats("zzzz")).toHaveLength(4);
  });

  it("is deterministic for the same seed", () => {
    const a = getFunStats("9999");
    const b = getFunStats("9999");
    expect(a).toEqual(b);
  });

  it("varies with the seed", () => {
    const a = getFunStats("1234");
    const b = getFunStats("5678");
    // Au moins une stat diffère (chiffres différents)
    const allEqual = a.every((s, i) => s.text === b[i]?.text);
    expect(allEqual).toBe(false);
  });
});
