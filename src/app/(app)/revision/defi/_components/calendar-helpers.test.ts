import { describe, expect, it } from "vitest";
import {
  buildMonthGrid,
  isoDate,
  monthLabel,
  nextMonth,
  prevMonth,
} from "./calendar-helpers";

describe("calendar-helpers", () => {
  describe("isoDate", () => {
    it("pads single digits", () => {
      expect(isoDate(2026, 1, 5)).toBe("2026-01-05");
      expect(isoDate(2026, 12, 31)).toBe("2026-12-31");
    });
  });

  describe("prevMonth / nextMonth", () => {
    it("rolls over years correctly", () => {
      expect(prevMonth(2026, 1)).toEqual({ year: 2025, month: 12 });
      expect(nextMonth(2026, 12)).toEqual({ year: 2027, month: 1 });
    });

    it("stays in same year for normal moves", () => {
      expect(prevMonth(2026, 5)).toEqual({ year: 2026, month: 4 });
      expect(nextMonth(2026, 5)).toEqual({ year: 2026, month: 6 });
    });
  });

  describe("buildMonthGrid", () => {
    it("returns a length multiple of 7", () => {
      const grid = buildMonthGrid(2026, 4, "2026-04-27");
      expect(grid.length % 7).toBe(0);
    });

    it("contains all days of the month with inMonth=true", () => {
      // Avril 2026 a 30 jours.
      const grid = buildMonthGrid(2026, 4, "2026-04-27");
      const inMonth = grid.filter((d) => d.inMonth);
      expect(inMonth).toHaveLength(30);
      expect(inMonth[0]?.day).toBe(1);
      expect(inMonth[29]?.day).toBe(30);
    });

    it("marks today correctly", () => {
      const grid = buildMonthGrid(2026, 4, "2026-04-27");
      const todayCells = grid.filter((d) => d.isToday);
      // Une seule case correspond à 2026-04-27 (jour du mois affiché).
      expect(todayCells).toHaveLength(1);
      expect(todayCells[0]?.iso).toBe("2026-04-27");
    });

    it("flags future dates", () => {
      const grid = buildMonthGrid(2026, 4, "2026-04-27");
      const future = grid.filter((d) => d.inMonth && d.isFuture);
      // Du 28 au 30 avril = 3 jours.
      expect(future).toHaveLength(3);
    });

    it("starts on a Monday (lundi)", () => {
      // 1er avril 2026 est un mercredi → la grille démarre lundi 30 mars.
      const grid = buildMonthGrid(2026, 4, "2026-04-27");
      expect(grid[0]?.iso).toBe("2026-03-30");
      expect(grid[0]?.inMonth).toBe(false);
    });

    it("handles January (year rollover at start)", () => {
      const grid = buildMonthGrid(2026, 1, "2026-01-15");
      // 1er janvier 2026 est un jeudi → padding lun 29 dec 2025.
      expect(grid[0]?.iso).toBe("2025-12-29");
      const inMonth = grid.filter((d) => d.inMonth);
      expect(inMonth).toHaveLength(31);
    });
  });

  describe("monthLabel", () => {
    it("returns French long format", () => {
      const s = monthLabel(2026, 4);
      // Selon l'ICU, ça peut être "avril 2026" (variante non-NBSP).
      expect(s.toLowerCase()).toContain("avril");
      expect(s).toContain("2026");
    });
  });
});
