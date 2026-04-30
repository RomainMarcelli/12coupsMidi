"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MonitorPlay, Smartphone, Tv, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { createTvRoom } from "@/lib/realtime/room-actions";

/**
 * Landing visuelle "Créer une partie TV" : explique le concept en 3 lignes
 * (TV affiche, téléphones jouent), bouton de création principal.
 */
export function TvHostLanding() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function handleCreate() {
    setError(null);
    startTransition(async () => {
      const res = await createTvRoom({ gameMode: "douze_coups" });
      if (!res.ok) {
        setError(res.message);
        return;
      }
      router.push(`/tv/host/${res.code}`);
    });
  }

  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col items-center justify-center gap-8 p-6 text-center">
      <div className="flex h-24 w-24 items-center justify-center rounded-3xl bg-gold/20 shadow-[0_0_64px_rgba(245,183,0,0.45)]">
        <Tv className="h-12 w-12 text-gold-warm" aria-hidden="true" />
      </div>

      <div className="flex flex-col gap-2">
        <p className="text-sm font-bold uppercase tracking-widest text-gold-warm">
          Mode soirée
        </p>
        <h1 className="font-display text-4xl font-extrabold text-foreground sm:text-5xl">
          Lance une partie sur ta TV
        </h1>
        <p className="max-w-xl text-foreground/70 sm:text-lg">
          Affiche les questions sur ton écran. Tes amis rejoignent depuis
          leur téléphone et jouent en live, à plusieurs (jusqu&apos;à 8).
        </p>
      </div>

      <div className="grid w-full gap-3 sm:grid-cols-3">
        <Step icon={MonitorPlay} title="TV affiche" desc="QR code à scanner" />
        <Step icon={Smartphone} title="Tels rejoignent" desc="Code à 4 chiffres" />
        <Step icon={Users} title="2 à 8 joueurs" desc="Tour par tour" />
      </div>

      <Button
        variant="gold"
        size="lg"
        onClick={handleCreate}
        disabled={pending}
        className="text-lg"
      >
        {pending ? (
          <>
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
            Création…
          </>
        ) : (
          <>
            <Tv className="h-5 w-5" aria-hidden="true" />
            Créer la partie
          </>
        )}
      </Button>

      {error && (
        <p
          role="alert"
          className="rounded-md border border-buzz/40 bg-buzz/10 px-4 py-2 text-sm text-buzz"
        >
          {error}
        </p>
      )}

      <p className="text-xs text-foreground/50">
        L&apos;écran principal (cette page) doit rester ouvert sur la TV ou
        le PC pendant toute la partie.
      </p>
    </main>
  );
}

function Step({
  icon: Icon,
  title,
  desc,
}: {
  icon: typeof Tv;
  title: string;
  desc: string;
}) {
  return (
    <div className="flex flex-col items-center gap-1.5 rounded-xl border border-border bg-card p-4">
      <Icon className="h-7 w-7 text-gold-warm" aria-hidden="true" />
      <p className="font-display text-sm font-bold text-foreground">{title}</p>
      <p className="text-xs text-foreground/60">{desc}</p>
    </div>
  );
}
