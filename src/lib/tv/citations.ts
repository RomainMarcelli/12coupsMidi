/**
 * P3.1 — Citations et phrases d'ambiance affichées dans le carrousel
 * d'attente du Mode TV (avant que la partie ne démarre).
 *
 * Toutes en français, ton complice / clin d'œil au quiz télévisé.
 * Utilisées par `WaitingCarousel` (cf. tv-host-room.tsx).
 */

export interface Citation {
  text: string;
  /** Auteur attribué (peut être fictif / clin d'œil). */
  author?: string;
}

export const CITATIONS: ReadonlyArray<Citation> = [
  { text: "Le quiz, c'est l'art de douter avec élégance." },
  { text: "On apprend toujours quelque chose à perdre. À gagner aussi." },
  { text: "Une bonne réponse vaut mille certitudes.", author: "Anonyme" },
  { text: "La culture, c'est ce qui reste quand on a tout oublié.", author: "Édouard Herriot" },
  { text: "Mieux vaut connaître la question que la réponse." },
  { text: "Le doute est le commencement de la sagesse.", author: "Aristote" },
  { text: "Réfléchis vite — mais réponds juste." },
  { text: "Au quiz, l'humilité a toujours raison." },
  { text: "On ne sait jamais d'où vient la prochaine question." },
  { text: "Celui qui pose la question est plus fort que celui qui répond.", author: "Proverbe africain" },
  { text: "À midi, tout le monde est expert. À 12 coups, tout le monde apprend." },
  { text: "Une partie sans bluff est une partie sans surprise." },
  { text: "Les bonnes réponses se cachent souvent dans les mauvaises questions." },
  { text: "Le savoir est la seule chose qui grandit en se partageant." },
  { text: "Plus on en sait, plus on découvre ce qu'on ignore.", author: "Socrate" },
];
