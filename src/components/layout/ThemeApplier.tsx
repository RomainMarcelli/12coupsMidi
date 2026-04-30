"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";

interface ThemeApplierProps {
  theme: "light" | "dark" | "system";
}

/**
 * Aligne le thème actif (next-themes) sur la préférence sauvegardée en BDD.
 * S'exécute après le mount initial pour ne pas casser le SSR.
 *
 * L3.1 — Si la préférence BDD est `"system"` (vestige des anciens
 * comptes), on traite comme `"light"` car `enableSystem={false}` côté
 * provider rendrait `"system"` invalide. Mode clair par défaut.
 */
export function ThemeApplier({ theme }: ThemeApplierProps) {
  const { setTheme, theme: current } = useTheme();
  useEffect(() => {
    const target = theme === "system" ? "light" : theme;
    if (current !== target) {
      setTheme(target);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);
  return null;
}
