import { describe, expect, it } from "vitest";
import { questionsBulkSchema } from "@/lib/schemas/question";
import { FORMATS } from "./import-format-examples";

/**
 * M5.1 — Garantit que tous les exemples affichés dans le guide
 * d'import passent la validation Zod (`questionsBulkSchema`). Si le
 * schéma évolue et casse un exemple, ce test échoue immédiatement
 * et l'admin n'a jamais à voir un exemple invalide en prod.
 */
describe("ImportFormatGuide examples", () => {
  it("le guide documente bien les 5 types de questions importables", () => {
    const types = FORMATS.map((f) => f.type).sort();
    expect(types).toEqual(
      ["coup_par_coup", "etoile", "face_a_face", "quizz_2", "quizz_4"].sort(),
    );
  });

  for (const f of FORMATS) {
    it(`exemple ${f.type} passe questionsBulkSchema.safeParse`, () => {
      const parsed = questionsBulkSchema.safeParse([f.example]);
      if (!parsed.success) {
        // Affiche les erreurs lisibles si le test échoue.
        const issues = parsed.error.issues
          .map((iss) => `${iss.path.join(".")}: ${iss.message}`)
          .join("\n");
        throw new Error(`Exemple ${f.type} invalide :\n${issues}`);
      }
      expect(parsed.success).toBe(true);
    });
  }

  it("chaque exemple a au moins un champ requis et type correspondant", () => {
    for (const f of FORMATS) {
      expect(f.requiredFields.length).toBeGreaterThan(0);
      const exType = (f.example as { type: string }).type;
      expect(exType).toBe(f.type);
    }
  });
});
