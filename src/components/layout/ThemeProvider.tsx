"use client";

import { ThemeProvider as NextThemesProvider } from "next-themes";
import type { ReactNode } from "react";

interface ThemeProviderProps {
  children: ReactNode;
  /**
   * L3.1 — Thème par défaut. Si le user n'a JAMAIS choisi, on force
   * `light` (au lieu de suivre le système). Couvert par
   * `enableSystem={false}`.
   */
  defaultTheme?: "light" | "dark";
}

/**
 * L3.1 — `defaultTheme="light"` + `enableSystem={false}`.
 *
 * Comportement :
 *   - Nouvel utilisateur (storage vide)   → light (default)
 *   - User a choisi light                 → light (storage)
 *   - User a choisi dark                  → dark (storage)
 *   - User n'a pas choisi + système dark  → light (override car
 *                                            enableSystem=false)
 *
 * Le `ThemeApplier` (côté layout app) override avec la préférence
 * `profiles.theme` BDD si elle est `"light"` ou `"dark"`. Si la BDD
 * a `"system"` (anciens users), on traite comme `"light"`.
 */
export function ThemeProvider({
  children,
  defaultTheme = "light",
}: ThemeProviderProps) {
  return (
    <NextThemesProvider
      attribute="class"
      defaultTheme={defaultTheme}
      enableSystem={false}
      storageKey="mahylan-theme"
      disableTransitionOnChange={false}
    >
      {children}
    </NextThemesProvider>
  );
}
