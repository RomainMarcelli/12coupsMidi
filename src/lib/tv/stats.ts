/**
 * P3.1 — Stats fun affichées dans le carrousel d'attente. Pour le MVP,
 * pures à partir d'un générateur déterministe basé sur le code de room
 * (pas d'appel BDD pour ne pas surcharger le lobby).
 *
 * Si on veut des stats réelles plus tard, faire un fetch côté serveur
 * dans `tv/host/[code]/page.tsx` et les passer en prop.
 */

export interface FunStat {
  /** Phrase principale, déjà avec le chiffre formaté. */
  text: string;
  /** Sous-titre / contexte. */
  caption?: string;
}

/**
 * Génère un set de stats "réalistes mais bidons" pour ambiance lobby.
 * Le `seed` (ex. code de room) garantit que les stats restent stables
 * pour une session donnée — on ne change pas les chiffres à chaque
 * tick du carrousel.
 */
export function getFunStats(seed: string): FunStat[] {
  // Hash très simple du seed → entier déterministe
  let h = 0;
  for (let i = 0; i < seed.length; i++) {
    h = (h * 31 + seed.charCodeAt(i)) >>> 0;
  }
  const rand = (mod: number) => {
    h = (h * 1103515245 + 12345) >>> 0;
    return h % mod;
  };
  const partiesWeek = 230 + rand(85);
  const playersToday = 45 + rand(35);
  const correctRate = 62 + rand(15);
  const longestStreak = 8 + rand(7);

  return [
    {
      text: `${partiesWeek} parties jouées cette semaine`,
      caption: "Le quiz est en pleine forme",
    },
    {
      text: `${playersToday} joueurs en ligne aujourd'hui`,
      caption: "Bienvenue parmi eux",
    },
    {
      text: `${correctRate}% de bonnes réponses en moyenne`,
      caption: "Et toi, tu fais combien ?",
    },
    {
      text: `Record de la semaine : ${longestStreak} bonnes réponses d'affilée`,
      caption: "Tu peux faire mieux ?",
    },
  ];
}
