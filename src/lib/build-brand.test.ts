import { afterEach, describe, expect, it, vi } from "vitest";
import { getBuildBrand } from "./build-brand";

describe("getBuildBrand", () => {
  afterEach(() => {
    vi.unstubAllEnvs();
  });

  it("retourne le brand Mahylan quand NEXT_PUBLIC_BRAND_MODE=mahylan", () => {
    vi.stubEnv("NEXT_PUBLIC_BRAND_MODE", "mahylan");
    const brand = getBuildBrand();
    expect(brand.mode).toBe("mahylan");
    expect(brand.appName).toBe("Les 12 coups de Mahylan");
    expect(brand.faviconPath).toBe("/favicon-mahylan.ico");
    expect(brand.iconBasePath).toBe("/icons/mahylan");
  });

  it("retourne le brand générique quand NEXT_PUBLIC_BRAND_MODE=generic", () => {
    vi.stubEnv("NEXT_PUBLIC_BRAND_MODE", "generic");
    const brand = getBuildBrand();
    expect(brand.mode).toBe("generic");
    expect(brand.appName).toBe("Coups de Midi Quiz");
    expect(brand.faviconPath).toBe("/favicon.ico");
    expect(brand.iconBasePath).toBe("");
  });

  it("fallback sur generic quand la variable est absente / vide / inconnue", () => {
    vi.stubEnv("NEXT_PUBLIC_BRAND_MODE", "");
    expect(getBuildBrand().mode).toBe("generic");

    vi.stubEnv("NEXT_PUBLIC_BRAND_MODE", "famille");
    expect(getBuildBrand().mode).toBe("generic");

    vi.stubEnv("NEXT_PUBLIC_BRAND_MODE", "MAHYLAN");
    // Volontairement strict : seulement "mahylan" en lowercase active le brand
    expect(getBuildBrand().mode).toBe("generic");
  });
});
