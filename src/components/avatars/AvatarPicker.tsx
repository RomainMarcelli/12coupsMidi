"use client";

import { useEffect, useRef, useState } from "react";
import {
  Camera,
  Check,
  Crown,
  Dices,
  ImageIcon,
  Loader2,
  Palette,
  Upload,
  X,
} from "lucide-react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import {
  AVATAR_PACK,
  DICEBEAR_STYLES,
  generateRandomAvatar,
  type DicebearStyle,
} from "@/lib/avatars/presets";
import { uploadAvatarClient } from "@/lib/avatar-upload";
import { createClient as createSupabaseBrowserClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

type UploadBucket = "avatars" | "saved-players-avatars";

interface AvatarPickerProps {
  open: boolean;
  currentUrl: string | null;
  onClose: () => void;
  onPick: (url: string | null) => void;
  /** Bucket Storage pour l'upload (avatars / saved-players-avatars). */
  uploadBucket?: UploadBucket;
  /** Sous-dossier pour l'upload. */
  uploadPath?: string;
}

type Tab = "pack" | "custom" | "random" | "upload";

/**
 * Sélecteur d'avatar unifié (F3.2).
 *
 * 3 onglets :
 *   - Pack : 16 avatars pré-définis (DiceBear)
 *   - Aléatoire : génère un avatar via DiceBear avec choix de style
 *   - Importer : upload depuis l'appareil (compression côté client)
 */
export function AvatarPicker({
  open,
  currentUrl,
  onClose,
  onPick,
  uploadBucket = "avatars",
  uploadPath = "user",
}: AvatarPickerProps) {
  const [tab, setTab] = useState<Tab>("pack");

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === "Escape") onClose();
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [open, onClose]);

  return (
    <AnimatePresence>
      {open && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-foreground/60 p-4"
          role="dialog"
          aria-modal="true"
          aria-label="Choisir un avatar"
        >
          <motion.div
            initial={{ scale: 0.95, y: 10 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 10 }}
            transition={{ type: "spring", stiffness: 280, damping: 24 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-2xl overflow-hidden rounded-2xl border border-border bg-card shadow-2xl"
          >
            <header className="flex items-center justify-between gap-3 border-b border-border px-4 py-3">
              <h2 className="font-display text-lg font-extrabold text-foreground">
                Choisir un avatar
              </h2>
              <button
                type="button"
                onClick={onClose}
                aria-label="Fermer"
                className="flex h-8 w-8 items-center justify-center rounded-md text-foreground/60 hover:bg-foreground/10 hover:text-foreground"
              >
                <X className="h-4 w-4" aria-hidden="true" />
              </button>
            </header>

            {/* Tabs */}
            <nav className="flex gap-1 border-b border-border bg-card px-3 py-2">
              <TabButton
                active={tab === "pack"}
                onClick={() => setTab("pack")}
                icon={Palette}
              >
                Pack
              </TabButton>
              <TabButton
                active={tab === "custom"}
                onClick={() => setTab("custom")}
                icon={ImageIcon}
              >
                Custom
              </TabButton>
              <TabButton
                active={tab === "random"}
                onClick={() => setTab("random")}
                icon={Dices}
              >
                Aléatoire
              </TabButton>
              <TabButton
                active={tab === "upload"}
                onClick={() => setTab("upload")}
                icon={Upload}
              >
                Importer
              </TabButton>
              {currentUrl && (
                <button
                  type="button"
                  onClick={() => {
                    onPick(null);
                    onClose();
                  }}
                  className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-buzz/40 bg-card px-3 py-1.5 text-xs font-bold text-buzz transition-colors hover:bg-buzz/10"
                >
                  <X className="h-3.5 w-3.5" aria-hidden="true" />
                  Retirer
                </button>
              )}
            </nav>

            <div className="max-h-[70vh] overflow-y-auto p-4">
              {tab === "pack" && (
                <PackTab
                  currentUrl={currentUrl}
                  onPick={(url) => {
                    onPick(url);
                    onClose();
                  }}
                />
              )}
              {tab === "custom" && (
                <CustomTab
                  currentUrl={currentUrl}
                  onPick={(url) => {
                    onPick(url);
                    onClose();
                  }}
                />
              )}
              {tab === "random" && (
                <RandomTab
                  onPick={(url) => {
                    onPick(url);
                    onClose();
                  }}
                />
              )}
              {tab === "upload" && (
                <UploadTab
                  bucket={uploadBucket}
                  path={uploadPath}
                  onPick={(url) => {
                    onPick(url);
                    onClose();
                  }}
                />
              )}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

function TabButton({
  active,
  onClick,
  icon: Icon,
  children,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof Palette;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm font-bold transition-colors",
        active
          ? "bg-gold/15 text-gold-warm"
          : "text-foreground/65 hover:bg-foreground/5",
      )}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {children}
    </button>
  );
}

// =============================================================================
// Pack tab
// =============================================================================

function PackTab({
  currentUrl,
  onPick,
}: {
  currentUrl: string | null;
  onPick: (url: string) => void;
}) {
  return (
    <div>
      <p className="mb-3 text-sm text-foreground/65">
        Choisis un avatar parmi les {AVATAR_PACK.length} pré-définis :
      </p>
      {/* G4.3 — Pas de labels (les seeds DiceBear ne matchent pas
          forcément le nom). On numérote discrètement en bas-droite
          pour que l'utilisateur puisse identifier "le n°5" sans
          ambiguïté visuelle. */}
      <div className="grid grid-cols-4 gap-3 sm:grid-cols-5">
        {AVATAR_PACK.map((p, i) => {
          const selected = currentUrl === p.url;
          return (
            <button
              key={p.id}
              type="button"
              onClick={() => onPick(p.url)}
              aria-label={`Avatar ${i + 1}`}
              className={cn(
                "group relative aspect-square overflow-hidden rounded-xl border-2 p-1 transition-all",
                selected
                  ? "border-gold bg-gold/10 shadow-[0_0_18px_rgba(245,183,0,0.35)]"
                  : "border-border bg-card hover:border-gold/50 hover:scale-[1.04]",
              )}
            >
              <div className="relative h-full w-full overflow-hidden rounded-lg bg-foreground/5">
                <Image
                  src={p.url}
                  alt=""
                  width={80}
                  height={80}
                  className="h-full w-full object-cover"
                  unoptimized
                />
              </div>
              <span className="absolute bottom-1 right-1 rounded-full bg-foreground/70 px-1.5 py-0.5 text-[9px] font-bold leading-none text-background">
                {i + 1}
              </span>
              {selected && (
                <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-gold text-on-color">
                  <Check className="h-3 w-3" aria-hidden="true" />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// =============================================================================
// Random tab
// =============================================================================

function RandomTab({ onPick }: { onPick: (url: string) => void }) {
  const [style, setStyle] = useState<DicebearStyle>("avataaars");
  const [previews, setPreviews] = useState<string[]>([]);

  function regenerate() {
    setPreviews(Array.from({ length: 6 }, () => generateRandomAvatar(style)));
  }

  // Génère 6 previews au mount + à chaque changement de style
  useEffect(() => {
    regenerate();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [style]);

  return (
    <div className="flex flex-col gap-3">
      <p className="text-sm text-foreground/65">
        Choisis un style puis clique sur celui qui te plaît. Tu peux
        regénérer à tout moment.
      </p>

      <div className="flex flex-wrap gap-1.5">
        {DICEBEAR_STYLES.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setStyle(s.id)}
            className={cn(
              "rounded-full border-2 px-3 py-1 text-xs font-bold transition-colors",
              style === s.id
                ? "border-gold bg-gold/15 text-gold-warm"
                : "border-border bg-card text-foreground/55 hover:border-gold/40",
            )}
          >
            {s.label}
          </button>
        ))}
        <button
          type="button"
          onClick={regenerate}
          className="ml-auto inline-flex items-center gap-1.5 rounded-md border border-border bg-card px-3 py-1 text-xs font-bold text-foreground/80 hover:border-gold/50 hover:bg-gold/10"
        >
          <Dices className="h-3.5 w-3.5" aria-hidden="true" />
          Re-générer
        </button>
      </div>

      <div className="grid grid-cols-3 gap-3 sm:grid-cols-6">
        {previews.map((url, i) => (
          <button
            key={`${url}-${i}`}
            type="button"
            onClick={() => onPick(url)}
            className="group flex flex-col items-center gap-1 rounded-xl border-2 border-border bg-card p-2 transition-all hover:scale-[1.05] hover:border-gold/50"
          >
            <div className="relative h-20 w-20 overflow-hidden rounded-xl bg-foreground/5">
              <Image
                src={url}
                alt=""
                width={80}
                height={80}
                className="h-full w-full object-cover"
                unoptimized
              />
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}

// =============================================================================
// Upload tab
// =============================================================================

function UploadTab({
  bucket,
  path,
  onPick,
}: {
  bucket: UploadBucket;
  path: string;
  onPick: (url: string) => void;
}) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    const res = await uploadAvatarClient(file, bucket, path);
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
    if (res.status === "ok") onPick(res.url);
    else setError(res.message);
  }

  return (
    <div className="flex flex-col items-center gap-3 rounded-xl border-2 border-dashed border-border bg-background/40 p-8 text-center">
      <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-gold/15 text-gold-warm">
        <Camera className="h-8 w-8" aria-hidden="true" />
      </div>
      <div>
        <h3 className="font-display text-base font-extrabold text-foreground">
          Importer une photo
        </h3>
        <p className="text-xs text-foreground/65">
          JPG, PNG, WebP — max ~5 Mo. Compression automatique côté
          client.
        </p>
      </div>
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={uploading}
        className="inline-flex items-center gap-2 rounded-md bg-gold px-5 py-2.5 font-bold text-on-color shadow-[0_4px_0_0_#e89e00] transition-all hover:-translate-y-px disabled:opacity-50"
      >
        {uploading ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : (
          <Upload className="h-4 w-4" aria-hidden="true" />
        )}
        {uploading ? "Upload…" : "Choisir un fichier"}
      </button>
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        onChange={handleFile}
        className="hidden"
      />
      {error && (
        <p className="rounded-md border border-buzz/40 bg-buzz/10 px-3 py-2 text-xs text-buzz">
          {error}
        </p>
      )}
    </div>
  );
}

// =============================================================================
// L2.3 — Custom tab : avatars uploadés par l'admin via /admin/avatars
// (table public.custom_avatars). Lecture autorisée à tout user
// authentifié (RLS policy "custom_avatars select for authenticated").
// =============================================================================

interface CustomAvatar {
  id: string;
  url: string;
  tags: string[];
}

function CustomTab({
  currentUrl,
  onPick,
}: {
  currentUrl: string | null;
  onPick: (url: string) => void;
}) {
  const [avatars, setAvatars] = useState<CustomAvatar[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    async function load() {
      const supabase = createSupabaseBrowserClient();
      const { data, error: fetchErr } = await supabase
        .from("custom_avatars")
        .select("id, url, tags")
        .order("created_at", { ascending: false });
      if (cancelled) return;
      if (fetchErr) {
        setError(fetchErr.message);
        setAvatars([]);
        return;
      }
      setAvatars(
        (data ?? []).map((a) => ({
          id: a.id,
          url: a.url,
          tags: a.tags ?? [],
        })),
      );
    }
    void load();
    return () => {
      cancelled = true;
    };
  }, []);

  if (avatars === null) {
    return (
      <div className="flex items-center justify-center gap-2 py-8 text-sm text-foreground/60">
        <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        Chargement des avatars custom…
      </div>
    );
  }

  if (error) {
    return (
      <p className="rounded-md border border-buzz/40 bg-buzz/10 px-3 py-2 text-sm text-buzz">
        Erreur : {error}
      </p>
    );
  }

  if (avatars.length === 0) {
    return (
      <div className="flex flex-col items-center gap-2 rounded-xl border-2 border-dashed border-border bg-background/40 p-8 text-center">
        <ImageIcon
          className="h-8 w-8 text-foreground/30"
          aria-hidden="true"
        />
        <p className="text-sm text-foreground/65">
          Aucun avatar custom uploadé pour l&apos;instant.
        </p>
        <p className="text-xs text-foreground/50">
          L&apos;admin peut en ajouter via{" "}
          <code className="rounded bg-muted px-1 text-[11px]">
            /admin/avatars
          </code>
          .
        </p>
      </div>
    );
  }

  return (
    <div>
      <p className="mb-3 text-sm text-foreground/65">
        {avatars.length} avatar{avatars.length > 1 ? "s" : ""} uploadé
        {avatars.length > 1 ? "s" : ""} par l&apos;admin :
      </p>
      <div className="grid grid-cols-4 gap-3 sm:grid-cols-5">
        {avatars.map((a) => {
          const selected = currentUrl === a.url;
          return (
            <button
              key={a.id}
              type="button"
              onClick={() => onPick(a.url)}
              aria-label={a.tags.join(", ") || "Avatar custom"}
              title={a.tags.join(", ") || undefined}
              className={cn(
                "group relative aspect-square overflow-hidden rounded-xl border-2 p-1 transition-all",
                selected
                  ? "border-gold bg-gold/10 shadow-[0_0_18px_rgba(245,183,0,0.35)]"
                  : "border-border bg-card hover:border-gold/50 hover:scale-[1.04]",
              )}
            >
              <div className="relative h-full w-full overflow-hidden rounded-lg bg-foreground/5">
                {/* Avatars stockés sur le bucket Supabase Storage,
                    domaine pas dans next.config remotePatterns → on
                    utilise <img> brut. */}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={a.url}
                  alt=""
                  className="h-full w-full object-cover"
                />
              </div>
              {selected && (
                <span className="absolute right-1 top-1 flex h-5 w-5 items-center justify-center rounded-full bg-gold text-on-color">
                  <Check className="h-3 w-3" aria-hidden="true" />
                </span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}

// Avoid unused import warning when Crown is dropped in a future iteration
void Crown;
