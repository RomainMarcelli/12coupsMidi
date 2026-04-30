"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  BarChart3,
  LogOut,
  Menu,
  Play,
  RotateCcw,
  Settings,
  Shield,
  Tv,
  X,
  type LucideIcon,
} from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { signOut } from "@/app/(app)/actions";
import { cn } from "@/lib/utils";

/**
 * M2.2 — Menu burger pour la navigation mobile (< md / 768px).
 *
 * Visible uniquement sous `md:` via la classe `md:hidden` au niveau
 * de la Navbar. Sur desktop, les liens sont rendus inline directement
 * dans la Navbar.
 *
 * UX :
 *   - Drawer qui slide depuis la droite (Framer Motion, tween 250ms)
 *   - Backdrop semi-transparent au clic en dehors → ferme
 *   - Touche Échap → ferme
 *   - `body { overflow: hidden }` quand ouvert pour bloquer le scroll
 *   - Focus simple : 1er lien focusé à l'ouverture, focus restauré
 *     sur le bouton burger à la fermeture (pas un trap complet —
 *     suffisant pour usage perso, à durcir pour V2 publique)
 *   - Item actif highlight gold
 *   - Auto-close au clic sur un lien
 *
 * Limitation a11y connue (V2) : pas de focus trap au sens strict
 * (Tab peut sortir du menu). Pour usage public RGAA / WCAG, intégrer
 * `focus-trap-react` ou Radix `<Dialog>`.
 */

interface MobileMenuLink {
  href: string;
  label: string;
  icon: LucideIcon;
}

const LINKS: MobileMenuLink[] = [
  { href: "/", label: "Accueil", icon: Play },
  { href: "/jouer", label: "Jouer", icon: Play },
  { href: "/tv/host", label: "Mode TV", icon: Tv },
  { href: "/revision", label: "Révision", icon: RotateCcw },
  { href: "/stats", label: "Stats", icon: BarChart3 },
  { href: "/parametres", label: "Paramètres", icon: Settings },
];

interface MobileMenuProps {
  pseudo: string;
  role: "user" | "admin";
  avatarUrl?: string | null;
}

export function MobileMenu({ pseudo, role, avatarUrl }: MobileMenuProps) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const firstLinkRef = useRef<HTMLAnchorElement | null>(null);

  // Bloquer scroll body quand ouvert
  useEffect(() => {
    if (open) {
      const previous = document.body.style.overflow;
      document.body.style.overflow = "hidden";
      return () => {
        document.body.style.overflow = previous;
      };
    }
  }, [open]);

  // Échap → ferme
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  // Focus le 1er lien à l'ouverture, restore sur trigger à la fermeture
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => firstLinkRef.current?.focus(), 60);
      return () => clearTimeout(t);
    } else {
      triggerRef.current?.focus();
    }
  }, [open]);

  // Fermer si on resize > md (cas où l'utilisateur change orientation
  // ou ouvre les DevTools en plein menu)
  useEffect(() => {
    if (!open) return;
    const mq = window.matchMedia("(min-width: 768px)");
    const handler = (e: MediaQueryListEvent) => {
      if (e.matches) setOpen(false);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [open]);

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(href + "/");
  }

  return (
    <>
      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen(true)}
        aria-label="Ouvrir le menu"
        aria-haspopup="menu"
        aria-expanded={open}
        className="flex h-10 w-10 items-center justify-center rounded-md border border-border bg-card text-foreground/70 transition-colors hover:border-gold/50 hover:bg-gold/10 hover:text-foreground md:hidden"
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
      </button>

      <AnimatePresence>
        {open && (
          <>
            <motion.div
              key="backdrop"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              transition={{ duration: 0.15 }}
              onClick={() => setOpen(false)}
              className="fixed inset-0 z-[90] bg-black/55 backdrop-blur-sm md:hidden"
              aria-hidden="true"
            />
            <motion.nav
              key="drawer"
              initial={{ x: "100%" }}
              animate={{ x: 0 }}
              exit={{ x: "100%" }}
              transition={{ type: "tween", duration: 0.25 }}
              role="dialog"
              aria-modal="true"
              aria-label="Menu de navigation"
              className="fixed right-0 top-0 bottom-0 z-[100] flex w-[85vw] max-w-sm flex-col bg-card text-foreground shadow-2xl md:hidden"
            >
              {/* Header avec avatar + close */}
              <div className="flex items-center justify-between border-b border-border/60 px-4 py-3">
                <div className="flex items-center gap-2 min-w-0">
                  <Avatar avatarUrl={avatarUrl} pseudo={pseudo} />
                  <span className="truncate font-display text-sm font-bold text-foreground">
                    {pseudo}
                  </span>
                </div>
                <button
                  type="button"
                  onClick={() => setOpen(false)}
                  aria-label="Fermer le menu"
                  className="flex h-9 w-9 items-center justify-center rounded-md text-foreground/70 transition-colors hover:bg-foreground/10 hover:text-foreground"
                >
                  <X className="h-5 w-5" aria-hidden="true" />
                </button>
              </div>

              {/* Liens */}
              <div className="flex flex-1 flex-col gap-1 overflow-y-auto p-3">
                {LINKS.map(({ href, label, icon: Icon }, i) => {
                  const active = isActive(href);
                  return (
                    <Link
                      key={href}
                      ref={i === 0 ? firstLinkRef : undefined}
                      href={href}
                      onClick={() => setOpen(false)}
                      aria-current={active ? "page" : undefined}
                      className={cn(
                        "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold transition-colors",
                        active
                          ? "bg-gold/20 text-foreground"
                          : "text-foreground/80 hover:bg-gold/10 hover:text-foreground",
                      )}
                    >
                      <Icon className="h-5 w-5" aria-hidden="true" />
                      {label}
                    </Link>
                  );
                })}

                {role === "admin" && (
                  <Link
                    href="/admin"
                    onClick={() => setOpen(false)}
                    aria-current={
                      pathname.startsWith("/admin") ? "page" : undefined
                    }
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold transition-colors",
                      pathname.startsWith("/admin")
                        ? "bg-buzz/15 text-buzz"
                        : "text-buzz/80 hover:bg-buzz/10 hover:text-buzz",
                    )}
                  >
                    <Shield className="h-5 w-5" aria-hidden="true" />
                    Admin
                  </Link>
                )}
              </div>

              {/* Footer : déconnexion */}
              <div className="border-t border-border/60 p-3">
                <form action={signOut}>
                  <button
                    type="submit"
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-card px-3 py-2.5 text-sm font-semibold text-foreground/80 transition-colors hover:border-buzz hover:bg-buzz/5 hover:text-buzz"
                  >
                    <LogOut className="h-4 w-4" aria-hidden="true" />
                    Se déconnecter
                  </button>
                </form>
              </div>
            </motion.nav>
          </>
        )}
      </AnimatePresence>
    </>
  );
}

function Avatar({
  avatarUrl,
  pseudo,
}: {
  avatarUrl: string | null | undefined;
  pseudo: string;
}) {
  if (avatarUrl) {
    return (
      <span className="flex h-9 w-9 shrink-0 overflow-hidden rounded-full border border-border">
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
      </span>
    );
  }
  return (
    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-gold/20 text-sm font-bold text-gold-warm">
      {(pseudo[0] ?? "?").toUpperCase()}
    </span>
  );
}
