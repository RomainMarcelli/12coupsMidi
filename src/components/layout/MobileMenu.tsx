"use client";

import { AnimatePresence, motion } from "framer-motion";
import {
  BarChart3,
  Home,
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
import { createPortal } from "react-dom";
import { signOut } from "@/app/(app)/actions";
import { cn } from "@/lib/utils";

/**
 * M2.2 + N (refonte) — Menu burger pour la navigation mobile (< md / 768px).
 *
 * Bug initial : le drawer était rendu dans le DOM de la Navbar, qui a
 * `sticky top-0` + `backdrop-blur-md`. Cette combinaison crée un
 * **containing block** transformé qui annule l'effet de `position: fixed`
 * (le `inset-0` se confine à la Navbar au lieu de couvrir le viewport).
 * Conséquence : drawer coupé, le contenu de la page qui transparaît
 * derrière, scroll body lock cassé.
 *
 * Fix : rendre le drawer via `createPortal` directement dans
 * `document.body`, hors de toute hiérarchie transformée. Le portal
 * n'est créé qu'après le montage côté client (sinon erreur SSR).
 */

interface MobileMenuLink {
  href: string;
  label: string;
  icon: LucideIcon;
}

const LINKS: MobileMenuLink[] = [
  { href: "/", label: "Accueil", icon: Home },
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
  const [mounted, setMounted] = useState(false);
  const pathname = usePathname();
  const triggerRef = useRef<HTMLButtonElement | null>(null);
  const firstLinkRef = useRef<HTMLAnchorElement | null>(null);

  // Le portal a besoin de `document.body` qui n'existe qu'au montage client.
  useEffect(() => {
    setMounted(true);
  }, []);

  // Body scroll lock : empêche la page derrière de scroller.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  // Échap → ferme.
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [open]);

  // Focus 1er lien à l'open, restaure sur trigger à la fermeture.
  useEffect(() => {
    if (open) {
      const t = setTimeout(() => firstLinkRef.current?.focus(), 60);
      return () => clearTimeout(t);
    } else {
      // Pas de focus restore si le composant vient juste de monter.
      if (mounted) triggerRef.current?.focus({ preventScroll: true });
    }
  }, [open, mounted]);

  // Si on resize >= md, on referme automatiquement (cas rotation tablette).
  useEffect(() => {
    if (!open) return;
    const mq = window.matchMedia("(min-width: 768px)");
    const handler = (e: MediaQueryListEvent) => {
      if (e.matches) setOpen(false);
    };
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, [open]);

  // Ferme automatiquement quand l'URL change (= clic sur un lien).
  useEffect(() => {
    setOpen(false);
  }, [pathname]);

  function isActive(href: string) {
    if (href === "/") return pathname === "/";
    return pathname === href || pathname.startsWith(href + "/");
  }

  const drawer = (
    <AnimatePresence>
      {open && (
        <>
          {/* Backdrop */}
          <motion.div
            key="backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            onClick={() => setOpen(false)}
            className="fixed inset-0 z-[200] bg-black/60 backdrop-blur-sm"
            aria-hidden="true"
          />
          {/* Drawer */}
          <motion.div
            key="drawer"
            initial={{ x: "100%" }}
            animate={{ x: 0 }}
            exit={{ x: "100%" }}
            transition={{ type: "tween", duration: 0.25, ease: "easeOut" }}
            role="dialog"
            aria-modal="true"
            aria-label="Menu de navigation"
            className="fixed inset-y-0 right-0 z-[201] flex h-full w-[85vw] max-w-sm flex-col border-l border-border bg-card text-foreground shadow-2xl"
          >
            {/* Header avec avatar + bouton close */}
            <div className="flex shrink-0 items-center justify-between gap-2 border-b border-border/60 px-4 py-3">
              <div className="flex min-w-0 items-center gap-2">
                <Avatar avatarUrl={avatarUrl} pseudo={pseudo} />
                <span className="truncate font-display text-sm font-bold text-foreground">
                  {pseudo}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Fermer le menu"
                className="flex h-9 w-9 shrink-0 items-center justify-center rounded-md text-foreground/70 transition-colors hover:bg-foreground/10 hover:text-foreground"
              >
                <X className="h-5 w-5" aria-hidden="true" />
              </button>
            </div>

            {/* Liens (scrollable si trop nombreux) */}
            <nav
              className="flex flex-1 flex-col gap-1 overflow-y-auto p-3"
              aria-label="Menu mobile"
            >
              {LINKS.map(({ href, label, icon: Icon }, i) => {
                const active = isActive(href);
                return (
                  <Link
                    key={href}
                    ref={i === 0 ? firstLinkRef : undefined}
                    href={href}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "flex items-center gap-3 rounded-lg px-3 py-3 text-sm font-semibold transition-colors",
                      active
                        ? "bg-gold/20 text-foreground"
                        : "text-foreground/80 hover:bg-gold/10 hover:text-foreground",
                    )}
                  >
                    <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
                    <span>{label}</span>
                  </Link>
                );
              })}

              {role === "admin" && (
                <Link
                  href="/admin"
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
                  <Shield className="h-5 w-5 shrink-0" aria-hidden="true" />
                  <span>Admin</span>
                </Link>
              )}
            </nav>

            {/* Footer : déconnexion */}
            <div className="shrink-0 border-t border-border/60 p-3">
              <form action={signOut}>
                <button
                  type="submit"
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-border bg-background/40 px-3 py-2.5 text-sm font-semibold text-foreground/80 transition-colors hover:border-buzz hover:bg-buzz/5 hover:text-buzz"
                >
                  <LogOut className="h-4 w-4" aria-hidden="true" />
                  Se déconnecter
                </button>
              </form>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );

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

      {/* Portal vers document.body : sort de la stack context de la Navbar
          (sticky + backdrop-blur) qui transforme `position: fixed` en
          contained. Sans portal, le drawer reste prisonnier de la
          Navbar et ne couvre pas le viewport. */}
      {mounted ? createPortal(drawer, document.body) : null}
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
