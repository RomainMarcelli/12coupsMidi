"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Camera,
  Crown,
  Loader2,
  LogIn,
  Smartphone,
  Tv,
  WifiOff,
} from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";
import { uploadAvatarClient } from "@/lib/avatar-upload";
import {
  joinRoom,
  readStoredToken,
  rejoinRoomByToken,
} from "@/lib/realtime/player-actions";
import { cn } from "@/lib/utils";

interface PlayJoinClientProps {
  code: string;
  roomFound: boolean;
  initialStatus: "waiting" | "playing" | "paused" | null;
}

type Mode = "light" | "full";

/**
 * Formulaire de jonction côté téléphone. Sans auth — tout passe via les
 * policies publiques INSERT/UPDATE de tv_room_players, sécurisé par le
 * `player_token` stocké en localStorage.
 *
 * Si on a déjà un token en local pour ce code → tentative de reconnexion
 * automatique au mount, redirect vers /play/[code]/light ou /play/[code]
 * selon le mode précédemment choisi (mémorisé en localStorage).
 */
export function PlayJoinClient({
  code,
  roomFound,
  initialStatus,
}: PlayJoinClientProps) {
  const router = useRouter();
  const [pseudo, setPseudo] = useState("");
  const [mode, setMode] = useState<Mode>("light");
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reconnecting, setReconnecting] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // Tentative de reconnexion automatique si on a un token en localStorage.
  useEffect(() => {
    if (!roomFound) return;
    const token = readStoredToken(code);
    if (!token) return;
    setReconnecting(true);
    void rejoinRoomByToken({ code, token })
      .then((res) => {
        if (res.ok) {
          // Garde le mode du dernier passage si présent, sinon "light".
          const m =
            (window.localStorage.getItem(`mahylan-tv-mode:${code}`) as Mode) ??
            "light";
          router.push(m === "full" ? `/play/${code}/full` : `/play/${code}/light`);
        } else {
          setReconnecting(false);
        }
      })
      .catch(() => setReconnecting(false));
  }, [code, roomFound, router]);

  async function handlePickFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    const res = await uploadAvatarClient(
      file,
      "saved-players-avatars",
      "guest",
    );
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
    if (res.status === "ok") setAvatarUrl(res.url);
    else setError(res.message);
  }

  async function handleJoin() {
    if (!pseudo.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    const res = await joinRoom({ code, pseudo, avatarUrl });
    if (!res.ok) {
      setError(res.message);
      setSubmitting(false);
      return;
    }
    // Mémorise le mode pour la reconnexion auto
    window.localStorage.setItem(`mahylan-tv-mode:${code}`, mode);
    router.push(mode === "full" ? `/play/${code}/full` : `/play/${code}/light`);
  }

  if (!roomFound) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-buzz/15 text-buzz">
          <WifiOff className="h-10 w-10" aria-hidden="true" />
        </div>
        <h1 className="font-display text-2xl font-extrabold text-navy">
          Code invalide
        </h1>
        <p className="max-w-xs text-navy/60">
          Le code <strong>{code}</strong> ne correspond à aucune partie en
          cours. Vérifie auprès de l&apos;hôte.
        </p>
      </main>
    );
  }

  if (reconnecting) {
    return (
      <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-6 text-center">
        <Loader2 className="h-10 w-10 animate-spin text-gold-warm" aria-hidden="true" />
        <p className="text-navy/70">Reconnexion à la partie {code}…</p>
      </main>
    );
  }

  return (
    <main className="flex min-h-screen flex-col gap-5 bg-cream p-5">
      <header className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-gold/20 text-gold-warm">
          <Tv className="h-5 w-5" aria-hidden="true" />
        </div>
        <div>
          <p className="text-xs font-bold uppercase tracking-widest text-gold-warm">
            Partie {code}
          </p>
          <h1 className="font-display text-xl font-extrabold text-navy">
            Rejoindre la soirée
          </h1>
        </div>
      </header>

      {initialStatus && initialStatus !== "waiting" && (
        <div
          role="status"
          className="rounded-xl border border-sky/40 bg-sky/10 px-4 py-2 text-sm text-navy"
        >
          La partie a déjà commencé — tu rejoindras en cours.
        </div>
      )}

      <section className="flex flex-col gap-4 rounded-2xl border border-border bg-white p-5">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={uploading}
            className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-gold/10 hover:border-gold hover:bg-gold/20"
          >
            {avatarUrl ? (
              <Image
                src={avatarUrl}
                alt=""
                width={64}
                height={64}
                className="h-full w-full object-cover"
                unoptimized
              />
            ) : (
              <Camera className="h-6 w-6 text-gold-warm" aria-hidden="true" />
            )}
            {uploading && (
              <span className="absolute inset-0 flex items-center justify-center bg-navy/40">
                <Loader2 className="h-5 w-5 animate-spin text-cream" aria-hidden="true" />
              </span>
            )}
          </button>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            onChange={handlePickFile}
            className="hidden"
          />
          <input
            type="text"
            value={pseudo}
            onChange={(e) => setPseudo(e.target.value)}
            placeholder="Ton pseudo"
            maxLength={20}
            className="h-12 flex-1 rounded-xl border border-border bg-white px-4 text-lg font-semibold text-navy focus:border-gold focus:outline-none"
          />
        </div>
        <p className="text-xs text-navy/50">
          La photo est optionnelle — tu peux mettre un emoji-style avatar
          plus tard si tu veux.
        </p>
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-border bg-white p-5">
        <p className="text-xs font-bold uppercase tracking-widest text-navy/50">
          Mode d&apos;affichage
        </p>
        <div className="grid grid-cols-2 gap-2">
          <ModeCard
            icon={Smartphone}
            title="Light"
            desc="Juste les boutons A/B/C/D — recommandé"
            selected={mode === "light"}
            onClick={() => setMode("light")}
          />
          <ModeCard
            icon={Crown}
            title="Complet"
            desc="Avec la question + explications"
            selected={mode === "full"}
            onClick={() => setMode("full")}
          />
        </div>
      </section>

      {error && (
        <p
          role="alert"
          className="rounded-xl border border-buzz/40 bg-buzz/10 px-4 py-2 text-sm text-buzz"
        >
          {error}
        </p>
      )}

      <Button
        variant="gold"
        size="lg"
        disabled={!pseudo.trim() || submitting || uploading}
        onClick={handleJoin}
        className="text-lg"
      >
        {submitting ? (
          <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
        ) : (
          <LogIn className="h-5 w-5" aria-hidden="true" />
        )}
        Rejoindre
      </Button>
    </main>
  );
}

function ModeCard({
  icon: Icon,
  title,
  desc,
  selected,
  onClick,
}: {
  icon: typeof Tv;
  title: string;
  desc: string;
  selected: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex flex-col items-center gap-1 rounded-xl border-2 p-3 text-center transition-colors",
        selected
          ? "border-gold bg-gold/10"
          : "border-border bg-white hover:border-gold/50",
      )}
    >
      <Icon className="h-5 w-5 text-gold-warm" aria-hidden="true" />
      <p className="font-display text-sm font-bold text-navy">{title}</p>
      <p className="text-[11px] text-navy/60">{desc}</p>
    </button>
  );
}
