"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, Loader2, Save, X } from "lucide-react";
import Image from "next/image";
import { AvatarPicker } from "@/components/avatars/AvatarPicker";
import { Button } from "@/components/ui/button";
import { updatePlayerProfile } from "@/lib/realtime/player-actions";

/**
 * P2.1 — Modal d'édition du profil joueur dans le lobby (avant démarrage).
 * Permet de changer pseudo et avatar tant que la room est en `status =
 * "waiting"`. Le caller doit refermer le modal et re-track la presence
 * avec les nouvelles valeurs après onSaved.
 */
export function PlayProfileEditModal({
  open,
  onClose,
  onSaved,
  playerId,
  token,
  initialPseudo,
  initialAvatarUrl,
}: {
  open: boolean;
  onClose: () => void;
  onSaved: (next: { pseudo: string; avatarUrl: string | null }) => void;
  playerId: string;
  token: string;
  initialPseudo: string;
  initialAvatarUrl: string | null;
}) {
  const [pseudo, setPseudo] = useState(initialPseudo);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(initialAvatarUrl);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const dialogRef = useRef<HTMLDivElement>(null);

  // Sync avec les props quand le modal s'ouvre (au cas où on ré-ouvre
  // après un save : repart de la valeur actuelle).
  useEffect(() => {
    if (open) {
      setPseudo(initialPseudo);
      setAvatarUrl(initialAvatarUrl);
      setError(null);
    }
  }, [open, initialPseudo, initialAvatarUrl]);

  // Focus piège minimal : focus le dialog au mount, ESC pour fermer.
  useEffect(() => {
    if (!open) return;
    dialogRef.current?.focus();
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !submitting) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, submitting]);

  async function handleSubmit() {
    if (!pseudo.trim() || submitting) return;
    setSubmitting(true);
    setError(null);
    const res = await updatePlayerProfile({
      playerId,
      token,
      pseudo,
      avatarUrl,
    });
    if (!res.ok) {
      setError(res.message);
      setSubmitting(false);
      return;
    }
    setSubmitting(false);
    onSaved({ pseudo: pseudo.trim(), avatarUrl });
  }

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="profile-edit-title"
      tabIndex={-1}
      ref={dialogRef}
      className="fixed inset-0 z-[100] flex items-end justify-center bg-foreground/40 p-0 backdrop-blur-sm sm:items-center sm:p-4"
      onClick={(e) => {
        if (e.target === e.currentTarget && !submitting) onClose();
      }}
    >
      <div className="flex w-full max-w-md flex-col gap-4 rounded-t-3xl border border-border bg-card p-5 sm:rounded-3xl">
        <header className="flex items-center justify-between">
          <h2
            id="profile-edit-title"
            className="font-display text-xl font-extrabold text-foreground"
          >
            Modifier mon profil
          </h2>
          <button
            type="button"
            onClick={onClose}
            disabled={submitting}
            aria-label="Fermer"
            className="flex h-8 w-8 items-center justify-center rounded-md text-foreground/60 hover:bg-foreground/10 hover:text-foreground"
          >
            <X className="h-4 w-4" aria-hidden="true" />
          </button>
        </header>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={() => setPickerOpen(true)}
            aria-label="Choisir un avatar"
            className="relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-gold/10 transition-colors hover:border-gold hover:bg-gold/20"
          >
            {avatarUrl ? (
              <>
                <Image
                  src={avatarUrl}
                  alt=""
                  width={64}
                  height={64}
                  className="h-full w-full object-cover"
                  unoptimized
                />
                <span className="absolute inset-x-0 bottom-0 bg-foreground/70 px-1 py-0.5 text-[9px] font-bold uppercase tracking-wider text-background">
                  Modifier
                </span>
              </>
            ) : (
              <Camera className="h-6 w-6 text-gold-warm" aria-hidden="true" />
            )}
          </button>
          <input
            type="text"
            value={pseudo}
            onChange={(e) => setPseudo(e.target.value)}
            placeholder="Ton pseudo"
            maxLength={20}
            className="h-12 flex-1 rounded-xl border border-border bg-card px-4 text-lg font-semibold text-foreground focus:border-gold focus:outline-none"
          />
        </div>

        {error && (
          <p
            role="alert"
            className="rounded-xl border border-buzz/40 bg-buzz/10 px-3 py-2 text-sm text-buzz"
          >
            {error}
          </p>
        )}

        <Button
          variant="gold"
          size="lg"
          disabled={!pseudo.trim() || submitting}
          onClick={handleSubmit}
        >
          {submitting ? (
            <Loader2 className="h-5 w-5 animate-spin" aria-hidden="true" />
          ) : (
            <Save className="h-5 w-5" aria-hidden="true" />
          )}
          Enregistrer
        </Button>

        <AvatarPicker
          open={pickerOpen}
          currentUrl={avatarUrl}
          onClose={() => setPickerOpen(false)}
          onPick={(url) => setAvatarUrl(url)}
          uploadBucket="saved-players-avatars"
          uploadPath="guest"
          hideCustomTab
        />
      </div>
    </div>
  );
}
