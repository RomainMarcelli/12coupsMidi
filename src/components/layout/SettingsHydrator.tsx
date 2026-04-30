"use client";

import { useEffect } from "react";
import { useSettingsStore, type UserSettings } from "@/lib/settings";

interface SettingsHydratorProps {
  serverSettings: Partial<UserSettings>;
}

/**
 * Charge dans le store global les settings venus de la BDD (profile.settings).
 * Une fois hydraté, les composants peuvent piocher via `useSetting(...)`.
 */
export function SettingsHydrator({ serverSettings }: SettingsHydratorProps) {
  const hydrate = useSettingsStore((s) => s.hydrateFromServer);

  useEffect(() => {
    hydrate(serverSettings);
  }, [hydrate, serverSettings]);

  return null;
}
