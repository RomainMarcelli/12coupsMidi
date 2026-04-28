/**
 * Helpers purs pour le calendrier du Défi du jour.
 *
 * Toute la logique date est isolée ici (sans React) pour pouvoir
 * être testée unitairement sans monter de DOM. Tous les calculs
 * utilisent l'heure locale (le défi du jour bascule à minuit local).
 */

export interface CalendarDay {
  /** Date ISO "YYYY-MM-DD" pour ce jour. */
  iso: string;
  /** Numéro du jour dans le mois (1-31). */
  day: number;
  /** True si le jour fait partie du mois affiché (false = padding début/fin). */
  inMonth: boolean;
  /** True si la date est strictement dans le futur (par rapport à `today`). */
  isFuture: boolean;
  /** True si la date == today. */
  isToday: boolean;
}

/** Pad un nombre sur 2 chiffres. */
function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** Format ISO "YYYY-MM-DD" depuis (y, m1-12, d). */
export function isoDate(year: number, month: number, day: number): string {
  return `${year}-${pad2(month)}-${pad2(day)}`;
}

/** Convertit Date en ISO "YYYY-MM-DD" en heure locale. */
export function localIso(d: Date): string {
  return isoDate(d.getFullYear(), d.getMonth() + 1, d.getDate());
}

/**
 * Construit la grille du mois affiché (semaines de 7 jours, lun→dim).
 * On padde en début et en fin avec les jours du mois précédent / suivant
 * pour que la grille soit complète (utile pour le rendu CSS).
 *
 * @param year   Année (ex: 2026)
 * @param month  Mois 1-12
 * @param today  ISO de "aujourd'hui" (pour marquer la case + griser le futur)
 */
export function buildMonthGrid(
  year: number,
  month: number,
  today: string,
): CalendarDay[] {
  // 1) Premier et dernier jour du mois.
  const first = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0).getDate();

  // 2) Décalage avant : combien de jours du mois précédent on doit afficher.
  // getDay() : 0=dim, 1=lun, ... 6=sam. On veut un calendrier lun→dim donc
  // on convertit : lundi=0, dimanche=6.
  const firstDow = (first.getDay() + 6) % 7;

  const days: CalendarDay[] = [];

  // Jours du mois précédent (padding début).
  if (firstDow > 0) {
    const prevLast = new Date(year, month - 1, 0).getDate();
    const prevYear = month === 1 ? year - 1 : year;
    const prevMonth = month === 1 ? 12 : month - 1;
    for (let i = firstDow - 1; i >= 0; i--) {
      const d = prevLast - i;
      const iso = isoDate(prevYear, prevMonth, d);
      days.push({
        iso,
        day: d,
        inMonth: false,
        isFuture: iso > today,
        isToday: iso === today,
      });
    }
  }

  // Jours du mois courant.
  for (let d = 1; d <= lastDay; d++) {
    const iso = isoDate(year, month, d);
    days.push({
      iso,
      day: d,
      inMonth: true,
      isFuture: iso > today,
      isToday: iso === today,
    });
  }

  // Padding fin pour compléter la dernière semaine (multiple de 7).
  const remainder = days.length % 7;
  if (remainder > 0) {
    const fill = 7 - remainder;
    const nextYear = month === 12 ? year + 1 : year;
    const nextMonth = month === 12 ? 1 : month + 1;
    for (let d = 1; d <= fill; d++) {
      const iso = isoDate(nextYear, nextMonth, d);
      days.push({
        iso,
        day: d,
        inMonth: false,
        isFuture: iso > today,
        isToday: iso === today,
      });
    }
  }

  return days;
}

/** Retourne le mois précédent (year, month 1-12). */
export function prevMonth(year: number, month: number): { year: number; month: number } {
  if (month === 1) return { year: year - 1, month: 12 };
  return { year, month: month - 1 };
}

/** Retourne le mois suivant (year, month 1-12). */
export function nextMonth(year: number, month: number): { year: number; month: number } {
  if (month === 12) return { year: year + 1, month: 1 };
  return { year, month: month + 1 };
}

/** Nom du mois en français (capitalize). Ex: "avril 2026" → "avril 2026". */
export function monthLabel(year: number, month: number): string {
  // 1er du mois pour ne pas dépendre des jours.
  const d = new Date(year, month - 1, 1);
  const s = new Intl.DateTimeFormat("fr-FR", {
    month: "long",
    year: "numeric",
  }).format(d);
  return s;
}
