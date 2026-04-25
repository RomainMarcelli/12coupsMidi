"use client";

import { useEffect } from "react";
import { useTheme } from "next-themes";

interface ThemeApplierProps {
  theme: "light" | "dark" | "system";
}

/**
 * Aligne le thème actif (next-themes) sur la préférence sauvegardée en BDD.
 * S'exécute après le mount initial pour ne pas casser le SSR.
 */
export function ThemeApplier({ theme }: ThemeApplierProps) {
  const { setTheme, theme: current } = useTheme();
  useEffect(() => {
    if (current !== theme) {
      setTheme(theme);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [theme]);
  return null;
}
