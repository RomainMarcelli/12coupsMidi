import { describe, expect, it } from "vitest";
import { questionsBulkSchema } from "@/lib/schemas/question";
import {
  formatQuestionsForExport,
  type RawQuestionRow,
} from "./format-export";

/**
 * M6.1 — Test critique : le format produit par `exportQuestions` doit
 * être ré-importable directement via `/admin/questions/import`. Si ce
 * test casse, ça veut dire qu'un export ne pourrait pas être réinséré
 * tel quel — ce qui briserait la promesse de la feature (backup +
 * restore).
 *
 * On teste le round-trip pour les 5 types de questions.
 */
describe("export → import round-trip", () => {
  const categorySlugById = new Map<number, string>([
    [1, "histoire"],
    [2, "geographie"],
    [3, "art"],
  ]);
  const subcategorySlugById = new Map<number, string>([[10, "xxe"]]);

  it("export face_a_face → réimport valide", () => {
    const rows: RawQuestionRow[] = [
      {
        id: "q1",
        type: "face_a_face",
        category_id: 2,
        subcategory_id: null,
        difficulte: 2,
        enonce: "Quelle est la capitale du Portugal ?",
        reponses: [],
        bonne_reponse: "Lisbonne",
        alias: ["Lisboa"],
        indices: null,
        image_url: null,
        explication: "Capitale.",
        format: null,
      },
    ];
    const exported = formatQuestionsForExport(
      rows,
      categorySlugById,
      subcategorySlugById,
    );
    const parsed = questionsBulkSchema.safeParse(exported);
    expect(parsed.success).toBe(true);
  });

  it("export quizz_4 → réimport valide", () => {
    const rows: RawQuestionRow[] = [
      {
        id: "q2",
        type: "quizz_4",
        category_id: 1,
        subcategory_id: 10,
        difficulte: 3,
        enonce: "Qui a peint la Joconde ?",
        reponses: [
          { text: "Léonard de Vinci", correct: true },
          { text: "Michel-Ange", correct: false },
          { text: "Raphaël", correct: false },
          { text: "Botticelli", correct: false },
        ],
        bonne_reponse: null,
        alias: null,
        indices: null,
        image_url: null,
        explication: null,
        format: null,
      },
    ];
    const exported = formatQuestionsForExport(
      rows,
      categorySlugById,
      subcategorySlugById,
    );
    expect(exported[0]?.subcategory_slug).toBe("xxe");
    const parsed = questionsBulkSchema.safeParse(exported);
    expect(parsed.success).toBe(true);
  });

  it("export quizz_2 avec format vrai_faux → réimport valide", () => {
    const rows: RawQuestionRow[] = [
      {
        id: "q3",
        type: "quizz_2",
        category_id: 1,
        subcategory_id: null,
        difficulte: 1,
        enonce: "Napoléon est mort à Sainte-Hélène.",
        reponses: [
          { text: "Vrai", correct: true },
          { text: "Faux", correct: false },
        ],
        bonne_reponse: null,
        alias: null,
        indices: null,
        image_url: null,
        explication: null,
        format: "vrai_faux",
      },
    ];
    const exported = formatQuestionsForExport(
      rows,
      categorySlugById,
      subcategorySlugById,
    );
    expect(exported[0]?.format).toBe("vrai_faux");
    const parsed = questionsBulkSchema.safeParse(exported);
    expect(parsed.success).toBe(true);
  });

  it("export coup_par_coup → réimport valide", () => {
    const rows: RawQuestionRow[] = [
      {
        id: "q4",
        type: "coup_par_coup",
        category_id: 2,
        subcategory_id: null,
        difficulte: 2,
        enonce: "Pays d'Europe",
        reponses: [
          { text: "France", correct: true },
          { text: "Espagne", correct: true },
          { text: "Italie", correct: true },
          { text: "Portugal", correct: true },
          { text: "Allemagne", correct: true },
          { text: "Belgique", correct: true },
          { text: "Japon", correct: false },
        ],
        bonne_reponse: null,
        alias: null,
        indices: null,
        image_url: null,
        explication: null,
        format: null,
      },
    ];
    const exported = formatQuestionsForExport(
      rows,
      categorySlugById,
      subcategorySlugById,
    );
    const parsed = questionsBulkSchema.safeParse(exported);
    expect(parsed.success).toBe(true);
  });

  it("export etoile → réimport valide", () => {
    const rows: RawQuestionRow[] = [
      {
        id: "q5",
        type: "etoile",
        category_id: 3,
        subcategory_id: null,
        difficulte: 3,
        enonce: "Qui suis-je ?",
        reponses: [],
        bonne_reponse: "Picasso",
        alias: ["Pablo Picasso"],
        indices: ["Né en 1881", "Cubiste", "Guernica", "Espagnol", "Pablo"],
        image_url: null,
        explication: null,
        format: null,
      },
    ];
    const exported = formatQuestionsForExport(
      rows,
      categorySlugById,
      subcategorySlugById,
    );
    const parsed = questionsBulkSchema.safeParse(exported);
    expect(parsed.success).toBe(true);
  });

  it("rows orphelines (category_id null ou inconnu) sont filtrées", () => {
    const rows: RawQuestionRow[] = [
      {
        id: "orphan1",
        type: "face_a_face",
        category_id: null,
        subcategory_id: null,
        difficulte: 2,
        enonce: "X",
        reponses: [],
        bonne_reponse: "Y",
        alias: null,
        indices: null,
        image_url: null,
        explication: null,
        format: null,
      },
      {
        id: "orphan2",
        type: "face_a_face",
        category_id: 999, // inconnu dans la map
        subcategory_id: null,
        difficulte: 2,
        enonce: "X",
        reponses: [],
        bonne_reponse: "Y",
        alias: null,
        indices: null,
        image_url: null,
        explication: null,
        format: null,
      },
    ];
    const exported = formatQuestionsForExport(
      rows,
      categorySlugById,
      subcategorySlugById,
    );
    expect(exported).toHaveLength(0);
  });

  it("round-trip mixte 5 types simultanés", () => {
    const rows: RawQuestionRow[] = [
      {
        id: "m1",
        type: "face_a_face",
        category_id: 2,
        subcategory_id: null,
        difficulte: 2,
        enonce: "Capitale du Portugal ?",
        reponses: [],
        bonne_reponse: "Lisbonne",
        alias: null,
        indices: null,
        image_url: null,
        explication: null,
        format: null,
      },
      {
        id: "m2",
        type: "quizz_4",
        category_id: 1,
        subcategory_id: null,
        difficulte: 2,
        enonce: "Question quizz_4",
        reponses: [
          { text: "A", correct: true },
          { text: "B", correct: false },
          { text: "C", correct: false },
          { text: "D", correct: false },
        ],
        bonne_reponse: null,
        alias: null,
        indices: null,
        image_url: null,
        explication: null,
        format: null,
      },
      {
        id: "m3",
        type: "quizz_2",
        category_id: 1,
        subcategory_id: null,
        difficulte: 2,
        enonce: "Vrai ou faux ?",
        reponses: [
          { text: "Vrai", correct: true },
          { text: "Faux", correct: false },
        ],
        bonne_reponse: null,
        alias: null,
        indices: null,
        image_url: null,
        explication: null,
        format: null,
      },
      {
        id: "m4",
        type: "coup_par_coup",
        category_id: 2,
        subcategory_id: null,
        difficulte: 2,
        enonce: "Capitales européennes",
        reponses: [
          { text: "Paris", correct: true },
          { text: "Madrid", correct: true },
          { text: "Rome", correct: true },
          { text: "Lisbonne", correct: true },
          { text: "Berlin", correct: true },
          { text: "Bruxelles", correct: true },
          { text: "Tokyo", correct: false },
        ],
        bonne_reponse: null,
        alias: null,
        indices: null,
        image_url: null,
        explication: null,
        format: null,
      },
      {
        id: "m5",
        type: "etoile",
        category_id: 3,
        subcategory_id: null,
        difficulte: 3,
        enonce: "Qui suis-je ?",
        reponses: [],
        bonne_reponse: "Picasso",
        alias: null,
        indices: ["A", "B", "C"],
        image_url: null,
        explication: null,
        format: null,
      },
    ];
    const exported = formatQuestionsForExport(
      rows,
      categorySlugById,
      subcategorySlugById,
    );
    expect(exported).toHaveLength(5);
    const parsed = questionsBulkSchema.safeParse(exported);
    if (!parsed.success) {
      throw new Error(JSON.stringify(parsed.error.issues, null, 2));
    }
    expect(parsed.success).toBe(true);
  });
});
