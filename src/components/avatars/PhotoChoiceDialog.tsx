"use client";

import { useEffect, useRef, useState } from "react";
import { Camera, ImageIcon, Loader2, Palette, X } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { uploadAvatarClient } from "@/lib/avatar-upload";
import { cn } from "@/lib/utils";

type UploadBucket = "avatars" | "saved-players-avatars";

export interface PhotoChoiceDialogProps {
  open: boolean;
  onClose: () => void;
  /** Appelé avec l'URL finale (upload custom ou avatar pré-défini). */
  onPhotoChosen: (url: string) => void;
  /** Quand l'utilisateur veut le picker d'avatars pré-définis. */
  onPickAvatar: () => void;
  uploadBucket?: UploadBucket;
  uploadPath?: string;
}

/**
 * H4.1 — Sélecteur de source photo style mobile (caméra / galerie /
 * avatar). Remplace l'input file simple. 3 cards cliquables :
 *
 *   1. Caméra (input file capture="environment", actif sur mobile,
 *      désactivé sinon avec badge).
 *   2. Galerie (input file standard).
 *   3. Avatar pré-défini (ferme le dialog et délègue à l'AvatarPicker).
 *
 * La détection mobile est volontairement basique (UA "Mobi|Android") :
 * sur desktop sans webcam, le bouton caméra est grisé. La précision
 * exacte n'est pas critique car même sur desktop Chrome ouvre une
 * boîte de dialogue OS qui propose la webcam si elle existe.
 */
export function PhotoChoiceDialog({
  open,
  onClose,
  onPhotoChosen,
  onPickAvatar,
  uploadBucket = "avatars",
  uploadPath = "user",
}: PhotoChoiceDialogProps) {
  const cameraInputRef = useRef<HTMLInputElement>(null);
  const galleryInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isMobile, setIsMobile] = useState(false);

  useEffect(() => {
    if (typeof navigator === "undefined") return;
    setIsMobile(/Mobi|Android/i.test(navigator.userAgent));
  }, []);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape" && !uploading) onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose, uploading]);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    const res = await uploadAvatarClient(file, uploadBucket, uploadPath);
    setUploading(false);
    e.target.value = "";
    if (res.status === "ok") {
      onPhotoChosen(res.url);
      onClose();
    } else {
      setError(res.message);
    }
  }

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={() => !uploading && onClose()}
          className="fixed inset-0 z-[250] flex items-center justify-center bg-foreground/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Choisir une photo"
        >
          <motion.div
            initial={{ scale: 0.92, y: 16 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.92, y: 16 }}
            transition={{ type: "spring", stiffness: 280, damping: 24 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
          >
            <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
              <h2 className="font-display text-lg font-extrabold text-foreground">
                Choisir une photo
              </h2>
              <button
                type="button"
                onClick={onClose}
                disabled={uploading}
                aria-label="Fermer"
                className="flex h-8 w-8 items-center justify-center rounded-md text-foreground/60 hover:bg-foreground/10 hover:text-foreground disabled:opacity-50"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </header>

            <div className="grid gap-2 p-4">
              <ChoiceCard
                icon={Camera}
                title="Prendre une photo"
                desc={isMobile ? "Ouvre l'appareil photo" : "Mobile uniquement"}
                disabled={!isMobile || uploading}
                onClick={() => cameraInputRef.current?.click()}
                accent="gold"
              />
              <ChoiceCard
                icon={ImageIcon}
                title="Choisir depuis ma galerie"
                desc="JPG, PNG, WebP — max ~5 Mo"
                disabled={uploading}
                onClick={() => galleryInputRef.current?.click()}
                accent="sky"
              />
              <ChoiceCard
                icon={Palette}
                title="Choisir un avatar"
                desc="16 avatars pré-définis ou aléatoire"
                disabled={uploading}
                onClick={() => {
                  onClose();
                  onPickAvatar();
                }}
                accent="life-green"
              />
            </div>

            {uploading && (
              <div className="flex items-center justify-center gap-2 border-t border-border bg-muted/40 px-4 py-3 text-sm text-foreground/70">
                <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
                Upload en cours…
              </div>
            )}
            {error && (
              <div
                role="alert"
                className="border-t border-buzz/30 bg-buzz/10 px-4 py-3 text-sm text-buzz"
              >
                {error}
              </div>
            )}

            {/* Inputs cachés. capture="environment" déclenche la
                caméra arrière sur mobile. */}
            <input
              ref={cameraInputRef}
              type="file"
              accept="image/*"
              capture="environment"
              onChange={handleFile}
              className="hidden"
            />
            <input
              ref={galleryInputRef}
              type="file"
              accept="image/*"
              onChange={handleFile}
              className="hidden"
            />
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function ChoiceCard({
  icon: Icon,
  title,
  desc,
  disabled,
  onClick,
  accent,
}: {
  icon: typeof Camera;
  title: string;
  desc: string;
  disabled?: boolean;
  onClick: () => void;
  accent: "gold" | "sky" | "life-green";
}) {
  const accentBg = {
    gold: "bg-gold/15 text-gold-warm",
    sky: "bg-sky/15 text-sky",
    "life-green": "bg-life-green/15 text-life-green",
  }[accent];

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={cn(
        "group flex items-center gap-3 rounded-xl border border-border bg-card p-4 text-left transition-all",
        !disabled && "hover:border-gold/50 hover:bg-gold/5 hover:scale-[1.01]",
        disabled && "cursor-not-allowed opacity-50",
      )}
    >
      <div
        className={cn(
          "flex h-12 w-12 shrink-0 items-center justify-center rounded-xl transition-transform",
          !disabled && "group-hover:scale-110",
          accentBg,
        )}
      >
        <Icon className="h-6 w-6" aria-hidden="true" />
      </div>
      <div className="flex-1">
        <p className="font-display text-base font-bold text-foreground">
          {title}
        </p>
        <p className="text-xs text-foreground/65">{desc}</p>
      </div>
    </button>
  );
}
