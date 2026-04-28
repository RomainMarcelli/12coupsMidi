import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { listCustomAvatars } from "./actions";
import { AvatarsAdminClient } from "./avatars-client";

export const metadata = { title: "Admin — Avatars" };
export const dynamic = "force-dynamic";

/**
 * H4.3 — Page admin pour gérer le pool d'avatars custom.
 * Lecture seule pour l'instant (V1) : liste + upload + delete.
 */
export default async function AdminAvatarsPage() {
  const res = await listCustomAvatars();
  const avatars = res.status === "ok" ? res.avatars : [];
  const error = res.status === "error" ? res.message : null;

  return (
    <main className="mx-auto flex w-full max-w-5xl flex-1 flex-col gap-5 p-4 sm:p-6 lg:p-8">
      <Link
        href="/admin"
        className="inline-flex w-fit items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1.5 text-sm font-semibold text-foreground/80 hover:border-gold/50 hover:bg-gold/10"
      >
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        Admin
      </Link>
      <header className="flex flex-col gap-1">
        <p className="text-xs font-bold uppercase tracking-widest text-buzz">
          Administration
        </p>
        <h1 className="font-display text-3xl font-extrabold text-foreground sm:text-4xl">
          Gérer les avatars
        </h1>
        <p className="text-foreground/65">
          Importer des avatars custom (PNG/JPG/WebP, max ~5 Mo). Compression
          automatique côté client.
        </p>
      </header>
      <AvatarsAdminClient initialAvatars={avatars} initialError={error} />
    </main>
  );
}
