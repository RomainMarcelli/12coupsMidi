import { describe, expect, it, vi } from "vitest";
import { tallyVote } from "./face-a-face-state";

const A = "tk-A";
const B = "tk-B";
const finalists: [string, string] = [A, B];

describe("tallyVote", () => {
  it("returns the majority winner", () => {
    expect(
      tallyVote({ v1: A, v2: A, v3: B }, finalists),
    ).toBe(A);
    expect(
      tallyVote({ v1: B, v2: B, v3: A }, finalists),
    ).toBe(B);
  });

  it("returns one of the finalists on tie (uses Math.random)", () => {
    const spy = vi.spyOn(Math, "random").mockReturnValue(0.2);
    expect(tallyVote({ v1: A, v2: B }, finalists)).toBe(A);
    spy.mockReturnValue(0.7);
    expect(tallyVote({ v1: A, v2: B }, finalists)).toBe(B);
    spy.mockRestore();
  });

  it("returns one of the finalists with no votes (random)", () => {
    const spy = vi.spyOn(Math, "random").mockReturnValue(0.0);
    expect(tallyVote({}, finalists)).toBe(A);
    spy.mockRestore();
  });

  it("ignores votes for non-finalist tokens", () => {
    expect(
      tallyVote({ v1: A, v2: "ghost", v3: B, v4: B }, finalists),
    ).toBe(B);
  });
});
