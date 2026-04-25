"use client";

import {
  BarChart3,
  LogOut,
  Play,
  RotateCcw,
  Settings,
  Shield,
} from "lucide-react";
import Link from "next/link";
import Image from "next/image";
import { usePathname } from "next/navigation";
import { signOut } from "@/app/(app)/actions";
import { cn } from "@/lib/utils";

interface NavbarProps {
  pseudo: string;
  role: "user" | "admin";
  avatarUrl?: string | null;
}

const LINKS = [
  { href: "/jouer", label: "Jouer", icon: Play },
  { href: "/revision", label: "Révision", icon: RotateCcw },
  { href: "/stats", label: "Stats", icon: BarChart3 },
] as const;

export function Navbar({ pseudo, role, avatarUrl }: NavbarProps) {
  const pathname = usePathname();

  return (
    <header className="sticky top-0 z-30 flex items-center justify-between border-b border-border/60 bg-card/85 px-4 py-3 text-foreground shadow-sm backdrop-blur-md sm:px-6">
      <Link
        href="/"
        className="flex items-center gap-2 transition-opacity hover:opacity-80"
      >
        <Image
          src="/logo.png"
          alt=""
          width={64}
          height={64}
          className="h-8 w-8 rounded-md object-cover"
          priority
        />
        <span className="font-display text-lg font-extrabold tracking-tight text-foreground">
          Les <span className="text-gold-warm">12&nbsp;coups</span> de Mahylan
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
                  ? "bg-gold/20 text-foreground"
                  : "text-foreground/70 hover:bg-gold/10 hover:text-foreground",
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

      <div className="flex items-center gap-2">
        <Link
          href="/parametres"
          aria-label="Paramètres"
          className={cn(
            "flex h-9 w-9 items-center justify-center rounded-md border border-border bg-card text-foreground/70 transition-colors hover:border-gold/50 hover:bg-gold/10 hover:text-foreground",
            pathname.startsWith("/parametres") && "border-gold bg-gold/15 text-foreground",
          )}
          title="Paramètres"
        >
          <Settings className="h-4 w-4" aria-hidden="true" />
        </Link>

        <Link
          href="/parametres"
          className="hidden items-center gap-2 rounded-full border border-border bg-card px-2 py-1 text-sm text-foreground/80 transition-colors hover:border-gold/50 hover:bg-gold/10 sm:flex"
          title={pseudo}
        >
          <Avatar avatarUrl={avatarUrl} pseudo={pseudo} />
          <span className="max-w-[120px] truncate">{pseudo}</span>
        </Link>

        <form action={signOut}>
          <button
            type="submit"
            className="flex items-center gap-1.5 rounded-md border border-border bg-card px-2.5 py-1.5 text-sm text-foreground/80 transition-colors hover:border-buzz hover:text-buzz"
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

function Avatar({
  avatarUrl,
  pseudo,
}: {
  avatarUrl: string | null | undefined;
  pseudo: string;
}) {
  if (avatarUrl) {
    return (
      <span className="flex h-7 w-7 overflow-hidden rounded-full border border-border">
        {/* Use plain img to allow arbitrary domains without next.config remotePatterns */}
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src={avatarUrl} alt="" className="h-full w-full object-cover" />
      </span>
    );
  }
  return (
    <span className="flex h-7 w-7 items-center justify-center rounded-full bg-gold/20 text-xs font-bold text-gold-warm">
      {(pseudo[0] ?? "?").toUpperCase()}
    </span>
  );
}
