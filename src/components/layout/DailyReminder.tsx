"use client";

import { useEffect } from "react";
import { useSetting } from "@/lib/settings";

const LS_LAST_NOTIFIED = "mm-last-daily-notif";
const LS_LAST_PLAYED = "mm-last-played-day";

/**
 * Rappel local quotidien.
 *
 * Mécanique simple (pas de backend push) :
 *  - Si la permission `Notification` est accordée et que `dailyNotif=true` :
 *  - Au montage et toutes les minutes :
 *    - Si on est après 18h locale, qu'on n'a pas joué aujourd'hui et qu'on
 *      n'a pas déjà notifié aujourd'hui, on `new Notification(...)`.
 *
 * `mm-last-played-day` doit être set par les actions de fin de partie pour
 * détecter une journée "active". On le fait côté client via un effect ailleurs
 * — ici on se contente de lire.
 */
export function DailyReminder() {
  const enabled = useSetting("dailyNotif");

  useEffect(() => {
    if (!enabled) return;
    if (typeof window === "undefined") return;
    if (!("Notification" in window)) return;
    if (Notification.permission !== "granted") return;

    function check() {
      const today = new Date().toISOString().slice(0, 10);
      const hour = new Date().getHours();
      if (hour < 18) return;

      const lastPlayed = localStorage.getItem(LS_LAST_PLAYED);
      if (lastPlayed === today) return; // déjà joué aujourd'hui

      const lastNotified = localStorage.getItem(LS_LAST_NOTIFIED);
      if (lastNotified === today) return; // déjà notifié aujourd'hui

      try {
        new Notification("Mahylan — petite révision ?", {
          body: "Tu n'as pas encore joué aujourd'hui. Une question ?",
          icon: "/icon-192.png",
          badge: "/icon-192.png",
          tag: "mahylan-daily",
        });
        localStorage.setItem(LS_LAST_NOTIFIED, today);
      } catch {
        // ignore
      }
    }

    check();
    const id = window.setInterval(check, 60_000);
    return () => window.clearInterval(id);
  }, [enabled]);

  return null;
}
