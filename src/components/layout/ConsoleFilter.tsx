"use client";

import { useEffect } from "react";

/**
 * K1bis — Filtre console pour supprimer les warnings tiers connus
 * et inutiles en dev. À monter une fois dans `app/layout.tsx`.
 *
 * Actuellement filtre :
 *   - Recharts : "The width(-1) and height(-1) of chart should be
 *     greater than 0…" — émis pendant le 1ʳᵉ cycle de mesure du
 *     ResponsiveContainer même quand `minWidth={1}` est présent.
 *     Bénin et non actionnable côté app.
 *
 * Ne s'active QUE en dev — en prod ces logs ne sortent pas.
 */
export function ConsoleFilter() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "development") return;
    const original = console.warn;
    const originalError = console.error;
    const SUPPRESSED = [
      "The width(-1) and height(-1) of chart",
      "width(-1) and height(-1)",
    ];
    function shouldSuppress(args: unknown[]): boolean {
      const first = args[0];
      if (typeof first !== "string") return false;
      return SUPPRESSED.some((s) => first.includes(s));
    }
    console.warn = (...args: unknown[]) => {
      if (shouldSuppress(args)) return;
      original.apply(console, args as []);
    };
    console.error = (...args: unknown[]) => {
      if (shouldSuppress(args)) return;
      originalError.apply(console, args as []);
    };
    return () => {
      console.warn = original;
      console.error = originalError;
    };
  }, []);
  return null;
}
