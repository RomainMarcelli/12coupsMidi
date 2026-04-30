/**
 * Préférences de notifications stockées dans
 * `profiles.notification_settings` (JSONB).
 */
export interface NotificationSettings {
  /** Toggle global : recevoir un mail quotidien si pas de partie jouée. */
  email_daily: boolean;
  /** Heure locale d'envoi, format "HH:MM". */
  email_time: string;
  /** Jours de la semaine où on autorise l'envoi (0=dimanche, 1=lundi, …). */
  email_days: number[];
  /** Notifs push navigateur (existant, on regroupe ici pour cohérence). */
  push_daily: boolean;
}

export const DEFAULT_NOTIFICATION_SETTINGS: NotificationSettings = {
  email_daily: false,
  email_time: "18:00",
  email_days: [1, 2, 3, 4, 5, 6, 0],
  push_daily: false,
};

export const DAY_LABELS = [
  { id: 1, label: "Lun" },
  { id: 2, label: "Mar" },
  { id: 3, label: "Mer" },
  { id: 4, label: "Jeu" },
  { id: 5, label: "Ven" },
  { id: 6, label: "Sam" },
  { id: 0, label: "Dim" },
] as const;

/** Normalise un input partiel (BDD) vers un objet complet. */
export function normalizeNotificationSettings(
  raw: unknown,
): NotificationSettings {
  if (!raw || typeof raw !== "object") return DEFAULT_NOTIFICATION_SETTINGS;
  const r = raw as Partial<NotificationSettings>;
  return {
    email_daily: typeof r.email_daily === "boolean" ? r.email_daily : false,
    email_time:
      typeof r.email_time === "string" && /^\d{2}:\d{2}$/.test(r.email_time)
        ? r.email_time
        : DEFAULT_NOTIFICATION_SETTINGS.email_time,
    email_days: Array.isArray(r.email_days)
      ? r.email_days.filter(
          (d) => typeof d === "number" && d >= 0 && d <= 6,
        )
      : DEFAULT_NOTIFICATION_SETTINGS.email_days,
    push_daily: typeof r.push_daily === "boolean" ? r.push_daily : false,
  };
}
