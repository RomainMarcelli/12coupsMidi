"use client";

import { BarChart3, LogOut, Play, RotateCcw, Shield } from "lucide-react";
import Link from "next/link";
import Image from "next/image";
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
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border/60 bg-white/85 px-4 py-3 text-navy shadow-sm backdrop-blur-md sm:px-6">
      <Link
        href="/"
        className="flex items-center gap-2 transition-opacity hover:opacity-80"
      >
        <Image
          src="/logo.svg"
          alt=""
          width={32}
          height={32}
          className="h-8 w-8"
          priority
        />
        <span className="font-display text-lg font-extrabold tracking-tight text-navy">
          Midi <span className="text-gold-warm">Master</span>
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
                "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold transition-colors",
                active
                  ? "bg-gold/20 text-navy"
                  : "text-navy/70 hover:bg-gold/10 hover:text-navy",
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
              "flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-semibold transition-colors",
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
        <span
          className="hidden max-w-[160px] truncate text-sm text-navy/70 sm:inline"
          title={pseudo}
        >
          {pseudo}
        </span>
        <form action={signOut}>
          <button
            type="submit"
            className="flex items-center gap-1.5 rounded-md border border-navy/15 bg-white px-2.5 py-1.5 text-sm text-navy/80 transition-colors hover:border-buzz hover:text-buzz"
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
