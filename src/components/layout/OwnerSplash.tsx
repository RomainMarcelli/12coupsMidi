"use client";

import { useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import type { AppBranding } from "@/lib/branding";

const SPLASH_KEY = "mahylan_seen_splash";

interface OwnerSplashProps {
  branding: AppBranding;
}

/**
 * L2.2 — Splash de bienvenue pour le compte owner (Mahylan).
 *
 * S'affiche UNE FOIS par device : marque `localStorage[SPLASH_KEY]`
 * = "1" au clic "Commencer". Si l'owner se reconnecte sur un autre
 * device, le splash réapparaît une fois — c'est OK.
 *
 * - Si `branding.isOwner` est false → ne render rien.
 * - Si déjà vu → ne render rien.
 * - Animation Framer : fade + scale sur le logo, halo doré pulsé.
 */
export function OwnerSplash({ branding }: OwnerSplashProps) {
  // `null` = pas encore décidé (premier render, on lit localStorage).
  // `true` = on doit afficher. `false` = on cache.
  const [show, setShow] = useState<boolean | null>(null);

  useEffect(() => {
    if (!branding.isOwner) {
      setShow(false);
      return;
    }
    if (typeof window === "undefined") return;
    const seen = window.localStorage.getItem(SPLASH_KEY);
    setShow(seen !== "1");
  }, [branding.isOwner]);

  function dismiss() {
    if (typeof window !== "undefined") {
      window.localStorage.setItem(SPLASH_KEY, "1");
    }
    setShow(false);
  }

  if (show !== true) return null;

  return (
    <AnimatePresence>
      <motion.div
        key="owner-splash"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.4 }}
        role="dialog"
        aria-modal="true"
        aria-labelledby="owner-splash-title"
        className="fixed inset-0 z-[400] flex items-center justify-center bg-foreground/80 backdrop-blur-md p-6"
      >
        <motion.div
          initial={{ scale: 0.85, y: 16, opacity: 0 }}
          animate={{ scale: 1, y: 0, opacity: 1 }}
          transition={{ type: "spring", stiffness: 220, damping: 22 }}
          className="relative flex max-w-md flex-col items-center gap-5 rounded-3xl border-2 border-gold/50 bg-card p-8 text-center shadow-[0_0_64px_rgba(245,183,0,0.4)] sm:p-10"
        >
          {/* Halo doré pulsé */}
          <motion.div
            aria-hidden="true"
            className="pointer-events-none absolute -inset-6 -z-10 rounded-full bg-gold/30 blur-3xl"
            animate={{ opacity: [0.4, 0.7, 0.4] }}
            transition={{ duration: 2.5, repeat: Infinity, ease: "easeInOut" }}
          />

          <motion.div
            initial={{ scale: 0.5, rotate: -8 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{
              type: "spring",
              stiffness: 180,
              damping: 14,
              delay: 0.15,
            }}
          >
            <Image
              src={branding.logoLargeUrl}
              alt={branding.appName}
              width={240}
              height={240}
              className="h-32 w-32 rounded-3xl object-contain shadow-[0_8px_48px_rgba(245,183,0,0.6)] sm:h-40 sm:w-40"
              priority
            />
          </motion.div>

          <h1
            id="owner-splash-title"
            className="font-display text-3xl font-extrabold text-foreground sm:text-4xl"
          >
            Bienvenue Mahylan !
          </h1>
          <p className="text-base text-foreground/70">
            Ton application personnelle est prête.
            <br />
            <span className="text-foreground/50">
              {branding.appName}
            </span>
          </p>

          <Button
            variant="gold"
            size="lg"
            onClick={dismiss}
            className="mt-2 min-w-[200px]"
          >
            Commencer
          </Button>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}
