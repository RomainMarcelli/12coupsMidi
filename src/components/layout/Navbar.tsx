"use client";

import { BarChart3, LogOut, Play, RotateCcw, Shield, Trophy } from "lucide-react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/(app)/actions";
import { cn } from "@/lib/utils";

interface NavbarProps {
  pseudo: string;
  role: "user" | "admin";
}

const LINKS = [
  { href: "/jouer", label: "Jouer", icon: Play },
  { href: "/revision", label: "Révision", icon: RotateCcw },
  { href: "/stats", label: "Stats", icon: BarChart3 },
] as const;

export function Navbar({ pseudo, role }: NavbarProps) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-white/10 bg-midnight/80 px-4 py-3 text-cream backdrop-blur-md sm:px-6">
      <Link
        href="/"
        className="flex items-center gap-2 transition-opacity hover:opacity-80"
      >
        <Trophy className="h-6 w-6 text-gold" aria-hidden="true" />
        <span className="font-display text-lg font-extrabold tracking-tight text-gold">
          Midi Master
        </span>
      </Link>

      <nav className="flex items-center gap-1" aria-label="Navigation principale">
        {LINKS.map(({ href, label, icon: Icon }) => {
          const active = pathname === href || pathname.startsWith(href + "/");
          return (
            <Link
              key={href}
              href={href}
              aria-current={active ? "page" : undefined}
              className={cn(
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
                active
                  ? "bg-gold/15 text-gold"
                  : "text-cream/80 hover:bg-white/5 hover:text-cream",
              )}
            >
              <Icon className="h-4 w-4" aria-hidden="true" />
              <span className="hidden sm:inline">{label}</span>
            </Link>
          );
        })}

        {role === "admin" && (
          <Link
            href="/admin/questions"
            aria-current={pathname.startsWith("/admin") ? "page" : undefined}
            className={cn(
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-medium transition-colors",
              pathname.startsWith("/admin")
                ? "bg-buzz/15 text-buzz"
                : "text-buzz/80 hover:bg-buzz/10 hover:text-buzz",
            )}
          >
            <Shield className="h-4 w-4" aria-hidden="true" />
            <span className="hidden sm:inline">Admin</span>
          </Link>
        )}
      </nav>

      <div className="flex items-center gap-3">
        <span className="hidden text-sm text-cream/70 sm:inline" title={pseudo}>
          {pseudo}
        </span>
        <form action={signOut}>
          <button
            type="submit"
            className="flex items-center gap-1.5 rounded-md border border-white/15 px-2.5 py-1.5 text-sm text-cream/80 transition-colors hover:border-gold hover:text-gold"
            title="Se déconnecter"
          >
            <LogOut className="h-4 w-4" aria-hidden="true" />
            <span className="sr-only">Déconnexion</span>
          </button>
        </form>
      </div>
    </header>
  );
}
