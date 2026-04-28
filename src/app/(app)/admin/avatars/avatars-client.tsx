"use client";

import { useRef, useState, useTransition } from "react";
import { Loader2, Trash2, Upload } from "lucide-react";
import Image from "next/image";
import { ConfirmDialog } from "@/components/ui/ConfirmDialog";
import { AvatarLightbox } from "@/components/avatars/AvatarLightbox";
import { uploadAvatarClient } from "@/lib/avatar-upload";
import {
  createCustomAvatar,
  deleteCustomAvatar,
  type CustomAvatarRow,
} from "./actions";

interface Props {
  initialAvatars: CustomAvatarRow[];
  initialError: string | null;
}

/**
 * H4.3 — UI admin pour la gestion des avatars custom.
 *
 * V1 : pas de tags ni stats d'utilisation (le schema BDD les supporte
 * mais l'UI minimaliste suffit pour démarrer). À enrichir plus tard.
 */
export function AvatarsAdminClient({ initialAvatars, initialError }: Props) {
  const [avatars, setAvatars] = useState<CustomAvatarRow[]>(initialAvatars);
  const [error, setError] = useState<string | null>(initialError);
  const [uploading, setUploading] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  // I4.1 + J4.1 — État du lightbox : index dans `avatars` (-1 = fermé).
  // Permet la navigation flèches/swipe entre les avatars.
  const [lightboxIndex, setLightboxIndex] = useState<number>(-1);
  const [, startTransition] = useTransition();
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setUploading(true);
    // On upload dans le bucket "avatars" (public). On pourrait dédier
    // un bucket admin, mais l'avatar admin reste utilisable côté users.
    const upload = await uploadAvatarClient(file, "avatars", "admin-pack");
    if (upload.status !== "ok") {
      setUploading(false);
      e.target.value = "";
      setError(upload.message);
      return;
    }
    const created = await createCustomAvatar({ url: upload.url, tags: [] });
    setUploading(false);
    e.target.value = "";
    if (created.status !== "ok") {
      setError(created.message);
      return;
    }
    setAvatars((prev) => [
      {
        id: created.id,
        url: upload.url,
        tags: [],
        uploadedBy: null,
        createdAt: new Date().toISOString(),
      },
      ...prev,
    ]);
  }

  function handleDeleteConfirmed() {
    const id = deleteId;
    if (!id) return;
    startTransition(async () => {
      const res = await deleteCustomAvatar(id);
      if (res.status === "error") {
        setError(res.message);
        return;
      }
      setAvatars((prev) => prev.filter((a) => a.id !== id));
      setDeleteId(null);
    });
  }

  return (
    <div className="flex flex-col gap-4">
      <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
        <h2 className="font-display text-lg font-bold text-foreground">
          Importer un nouvel avatar
        </h2>
        <button
          type="button"
          onClick={() => fileInputRef.current?.click()}
          disabled={uploading}
          className="inline-flex w-fit items-center gap-2 rounded-md bg-gold px-5 py-2.5 font-bold text-on-color shadow-[0_4px_0_0_#e89e00] transition-all hover:-translate-y-px disabled:opacity-50"
        >
          {uploading ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : (
            <Upload className="h-4 w-4" aria-hidden="true" />
          )}
          {uploading ? "Upload…" : "Choisir un fichier"}
        </button>
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleUpload}
          className="hidden"
        />
        {error && (
          <p
            role="alert"
            className="rounded-md border border-buzz/40 bg-buzz/10 px-3 py-2 text-sm text-buzz"
          >
            {error}
          </p>
        )}
      </section>

      <section className="flex flex-col gap-3 rounded-2xl border border-border bg-card p-5">
        <div className="flex items-center justify-between">
          <h2 className="font-display text-lg font-bold text-foreground">
            Avatars custom ({avatars.length})
          </h2>
        </div>
        {avatars.length === 0 ? (
          <p className="text-sm text-foreground/55">
            Aucun avatar custom. Importe-en un ci-dessus.
          </p>
        ) : (
          <ul className="grid grid-cols-3 gap-3 sm:grid-cols-5 lg:grid-cols-7">
            {avatars.map((a, i) => (
              <li
                key={a.id}
                className="group relative aspect-square overflow-hidden rounded-xl border border-border bg-muted"
              >
                {/* I4.1 — Bouton wrapper : clic = ouvre le lightbox.
                    Empêche tout comportement natif d'agrandissement
                    image et fournit une vraie modal. */}
                <button
                  type="button"
                  onClick={() => setLightboxIndex(i)}
                  className="block h-full w-full"
                  aria-label="Voir l'avatar en grand"
                  title="Voir en grand"
                >
                  <Image
                    src={a.url}
                    alt=""
                    width={120}
                    height={120}
                    className="h-full w-full object-cover"
                    unoptimized
                  />
                </button>
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteId(a.id);
                  }}
                  aria-label="Supprimer cet avatar"
                  className="absolute inset-x-1 bottom-1 inline-flex h-7 items-center justify-center gap-1 rounded-md bg-buzz/90 text-[11px] font-bold text-white opacity-0 transition-opacity group-hover:opacity-100"
                >
                  <Trash2 className="h-3 w-3" aria-hidden="true" />
                  Supprimer
                </button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <ConfirmDialog
        open={deleteId !== null}
        onClose={() => setDeleteId(null)}
        onConfirm={handleDeleteConfirmed}
        title="Supprimer cet avatar ?"
        description="L'avatar sera retiré du pool. Les utilisateurs qui l'avaient sélectionné garderont leur copie de l'URL, mais elle pointera potentiellement vers un fichier supprimé du bucket."
        confirmLabel="Supprimer"
        confirmVariant="danger"
      />

      {/* I4.1 + J4.1 — Lightbox avec navigation flèches/swipe entre
          tous les avatars de la liste. */}
      <AvatarLightbox
        open={lightboxIndex >= 0}
        avatars={avatars.map((a) => ({
          url: a.url,
          tags: a.tags,
          uploadedAtIso: a.createdAt,
        }))}
        currentIndex={lightboxIndex}
        onNavigate={(i) => setLightboxIndex(i)}
        onClose={() => setLightboxIndex(-1)}
        onDelete={() => {
          const a = avatars[lightboxIndex];
          if (a) {
            setDeleteId(a.id);
            setLightboxIndex(-1);
          }
        }}
      />
    </div>
  );
}
