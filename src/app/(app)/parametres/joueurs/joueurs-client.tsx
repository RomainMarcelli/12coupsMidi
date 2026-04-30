"use client";

import { useRef, useState, useTransition } from "react";
import {
  AlertTriangle,
  Camera,
  Check,
  Crown,
  Loader2,
  Pencil,
  Trash2,
  Users,
} from "lucide-react";
import Image from "next/image";
import { BackButton } from "@/components/ui/BackButton";
import { Modal } from "@/components/ui/Modal";
import { uploadAvatarClient } from "@/lib/avatar-upload";
import {
  deleteSavedPlayer,
  type SavedPlayer,
  updateSavedPlayer,
} from "@/lib/saved-players/actions";
import { cn } from "@/lib/utils";

interface JoueursClientProps {
  initial: SavedPlayer[];
}

/**
 * Page de gestion des joueurs locaux mémorisés.
 *
 * Refonte (post-tests) :
 *  - Édition via modal (au lieu d'inline) → action plus claire
 *  - Confirmation suppression via modal (au lieu de window.confirm qui
 *    pouvait être bloqué/ignoré sur certains navigateurs)
 *  - Try/catch + bandeau d'erreur visible si action Supabase échoue
 *  - Tri/recherche : liste filtrable par pseudo, tri 3 modes
 */
export function JoueursClient({ initial }: JoueursClientProps) {
  const [players, setPlayers] = useState<SavedPlayer[]>(initial);
  const [editTarget, setEditTarget] = useState<SavedPlayer | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<SavedPlayer | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  // Filtre + tri
  const [search, setSearch] = useState("");
  const [sortBy, setSortBy] = useState<"recent" | "played" | "won">("recent");

  const filtered = players
    .filter((p) =>
      search.trim().length === 0
        ? true
        : p.pseudo.toLowerCase().includes(search.trim().toLowerCase()),
    )
    .sort((a, b) => {
      if (sortBy === "played") return b.gamesPlayed - a.gamesPlayed;
      if (sortBy === "won") return b.gamesWon - a.gamesWon;
      // recent
      return (
        new Date(b.lastPlayedAt).getTime() -
        new Date(a.lastPlayedAt).getTime()
      );
    });

  const totalGames = players.reduce((sum, p) => sum + p.gamesPlayed, 0);

  function handleSaveEdit(patch: { pseudo: string; avatarUrl: string | null }) {
    if (!editTarget) return;
    const id = editTarget.id;
    // Optimistic update
    setPlayers((prev) =>
      prev.map((p) =>
        p.id === id
          ? { ...p, pseudo: patch.pseudo, avatarUrl: patch.avatarUrl }
          : p,
      ),
    );
    setError(null);
    setEditTarget(null);
    startTransition(async () => {
      try {
        await updateSavedPlayer(id, patch);
      } catch (e) {
        setError(
          e instanceof Error
            ? `Mise à jour échouée : ${e.message}`
            : "Mise à jour échouée.",
        );
      }
    });
  }

  function handleConfirmDelete() {
    if (!deleteTarget) return;
    const id = deleteTarget.id;
    // Optimistic
    setPlayers((prev) => prev.filter((p) => p.id !== id));
    setError(null);
    setDeleteTarget(null);
    startTransition(async () => {
      try {
        await deleteSavedPlayer(id);
      } catch (e) {
        setError(
          e instanceof Error
            ? `Suppression échouée : ${e.message}`
            : "Suppression échouée.",
        );
      }
    });
  }

  return (
    <main className="mx-auto flex w-full max-w-2xl flex-1 flex-col gap-5 p-4 sm:p-6">
      <div className="flex items-center gap-3">
        <BackButton href="/parametres" label="Paramètres" />
        <div className="flex-1">
          <h1 className="font-display text-2xl font-extrabold text-foreground">
            Mes joueurs sauvegardés
          </h1>
          <p className="text-sm text-foreground/60">
            {players.length === 0
              ? "Aucun joueur enregistré pour l'instant."
              : `${players.length} joueur${players.length > 1 ? "s" : ""} · ${totalGames} parties au total`}
          </p>
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-xl border border-buzz/40 bg-buzz/10 px-3 py-2 text-sm text-buzz"
        >
          <AlertTriangle className="mt-0.5 h-4 w-4" aria-hidden="true" />
          <span className="flex-1">{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="text-xs font-bold uppercase hover:underline"
          >
            OK
          </button>
        </div>
      )}

      {/* Recherche + tri (cachés si liste vide) */}
      {players.length > 1 && (
        <div className="flex flex-col gap-2 rounded-xl border border-border bg-card p-3 sm:flex-row sm:items-center">
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Rechercher un joueur…"
            className="h-9 flex-1 rounded-md border border-border bg-card px-3 text-sm text-foreground focus:border-gold focus:outline-none"
          />
          <select
            value={sortBy}
            onChange={(e) =>
              setSortBy(e.target.value as "recent" | "played" | "won")
            }
            className="h-9 rounded-md border border-border bg-card px-2 text-sm font-semibold text-foreground focus:border-gold focus:outline-none"
          >
            <option value="recent">Plus récents</option>
            <option value="played">Plus joués</option>
            <option value="won">Plus victorieux</option>
          </select>
        </div>
      )}

      {players.length === 0 ? (
        <EmptyState />
      ) : filtered.length === 0 ? (
        <p className="rounded-xl border border-dashed border-border bg-card/40 p-6 text-center text-sm text-foreground/60">
          Aucun joueur ne correspond à « {search} ».
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {filtered.map((p) => (
            <li
              key={p.id}
              className="flex flex-col gap-3 rounded-xl border border-border bg-card p-3 sm:flex-row sm:items-center"
            >
              <div className="flex items-center gap-3 sm:flex-1">
                <div className="flex h-12 w-12 shrink-0 items-center justify-center overflow-hidden rounded-xl bg-gold/15">
                  {p.avatarUrl ? (
                    <Image
                      src={p.avatarUrl}
                      alt=""
                      width={48}
                      height={48}
                      className="h-full w-full object-cover"
                      unoptimized
                    />
                  ) : (
                    <Crown
                      className="h-5 w-5 text-gold-warm"
                      aria-hidden="true"
                    />
                  )}
                </div>
                <div className="flex-1">
                  <p className="font-display font-bold text-foreground">
                    {p.pseudo}
                  </p>
                  <p className="text-xs text-foreground/60">
                    {p.gamesPlayed} parties · {p.gamesWon} victoires
                  </p>
                  <p className="text-[11px] text-foreground/40">
                    Dernière partie :{" "}
                    {new Date(p.lastPlayedAt).toLocaleDateString("fr-FR", {
                      day: "2-digit",
                      month: "short",
                      year: "numeric",
                    })}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 sm:ml-auto">
                <button
                  type="button"
                  onClick={() => setEditTarget(p)}
                  disabled={pending}
                  aria-label={`Modifier ${p.pseudo}`}
                  className="flex h-9 items-center gap-1.5 rounded-md border border-border bg-card px-3 text-sm font-semibold text-foreground hover:border-gold/50 hover:bg-gold/10 disabled:opacity-40"
                >
                  <Pencil className="h-4 w-4" aria-hidden="true" />
                  Modifier
                </button>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(p)}
                  disabled={pending}
                  aria-label={`Supprimer ${p.pseudo}`}
                  className="flex h-9 items-center gap-1.5 rounded-md border border-buzz/30 bg-card px-3 text-sm font-semibold text-buzz hover:border-buzz hover:bg-buzz/10 disabled:opacity-40"
                >
                  <Trash2 className="h-4 w-4" aria-hidden="true" />
                  Supprimer
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {/* Modal édition */}
      <Modal
        open={editTarget !== null}
        onClose={() => setEditTarget(null)}
        title={`Modifier ${editTarget?.pseudo ?? ""}`}
      >
        {editTarget && (
          <EditForm
            player={editTarget}
            onCancel={() => setEditTarget(null)}
            onSave={handleSaveEdit}
          />
        )}
      </Modal>

      {/* Modal confirmation suppression */}
      <Modal
        open={deleteTarget !== null}
        onClose={() => setDeleteTarget(null)}
        title="Supprimer le joueur ?"
        size="sm"
      >
        {deleteTarget && (
          <div className="flex flex-col gap-4">
            <p className="text-sm text-foreground/80">
              Tu vas supprimer <strong>{deleteTarget.pseudo}</strong> de tes
              joueurs sauvegardés. Les stats associées seront perdues.{" "}
              <span className="text-buzz">Cette action est irréversible.</span>
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setDeleteTarget(null)}
                className="flex h-9 items-center gap-1.5 rounded-md border border-border bg-card px-4 text-sm font-semibold text-foreground/70 hover:border-navy/40"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                className="flex h-9 items-center gap-1.5 rounded-md bg-buzz px-4 text-sm font-bold text-white shadow-[0_3px_0_0_#a32634] hover:-translate-y-px"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                Supprimer
              </button>
            </div>
          </div>
        )}
      </Modal>
    </main>
  );
}

function EmptyState() {
  return (
    <div className="flex flex-col items-center gap-3 rounded-2xl border-2 border-dashed border-border bg-card/40 p-8 text-center">
      <div className="flex h-14 w-14 items-center justify-center rounded-full bg-gold/15 text-gold-warm">
        <Users className="h-7 w-7" aria-hidden="true" />
      </div>
      <p className="font-display text-lg font-bold text-foreground">
        Aucun joueur sauvegardé
      </p>
      <p className="max-w-md text-sm text-foreground/60">
        Lance une partie locale du <strong>12 Coups de Midi</strong> avec des
        amis : leurs pseudos et photos seront mémorisés ici automatiquement
        pour les retrouver à la prochaine partie.
      </p>
    </div>
  );
}

// ============================================================================
// EditForm — pseudo + photo dans la modal
// ============================================================================
function EditForm({
  player,
  onCancel,
  onSave,
}: {
  player: SavedPlayer;
  onCancel: () => void;
  onSave: (patch: { pseudo: string; avatarUrl: string | null }) => void;
}) {
  const [pseudo, setPseudo] = useState(player.pseudo);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(
    player.avatarUrl ?? null,
  );
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  async function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploading(true);
    setError(null);
    const res = await uploadAvatarClient(
      file,
      "saved-players-avatars",
      "player",
    );
    setUploading(false);
    if (inputRef.current) inputRef.current.value = "";
    if (res.status === "ok") setAvatarUrl(res.url);
    else setError(res.message);
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-3">
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className={cn(
            "relative flex h-16 w-16 shrink-0 items-center justify-center overflow-hidden rounded-2xl border border-border bg-gold/10",
            "hover:border-gold hover:bg-gold/20",
          )}
          disabled={uploading}
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
              <Loader2
                className="h-5 w-5 animate-spin text-white"
                aria-hidden="true"
              />
            </span>
          )}
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/*"
          onChange={handleFile}
          className="hidden"
        />
        <input
          type="text"
          value={pseudo}
          onChange={(e) => setPseudo(e.target.value)}
          maxLength={24}
          autoFocus
          className="h-11 flex-1 rounded-md border border-border bg-card px-3 text-base text-foreground focus:border-gold focus:outline-none"
        />
      </div>

      {avatarUrl && (
        <button
          type="button"
          onClick={() => setAvatarUrl(null)}
          className="text-left text-xs text-buzz hover:underline"
        >
          Retirer la photo
        </button>
      )}

      {error && (
        <p className="rounded-md border border-buzz/40 bg-buzz/10 px-3 py-2 text-xs text-buzz">
          {error}
        </p>
      )}

      <div className="flex justify-end gap-2">
        <button
          type="button"
          onClick={onCancel}
          className="flex h-9 items-center gap-1.5 rounded-md border border-border bg-card px-4 text-sm font-semibold text-foreground/70 hover:border-navy/40"
        >
          Annuler
        </button>
        <button
          type="button"
          onClick={() => onSave({ pseudo: pseudo.trim(), avatarUrl })}
          disabled={!pseudo.trim() || uploading}
          className="flex h-9 items-center gap-1.5 rounded-md bg-gold px-4 text-sm font-bold text-on-color shadow-[0_3px_0_0_#e89e00] hover:-translate-y-px disabled:opacity-40"
        >
          <Check className="h-4 w-4" aria-hidden="true" />
          Enregistrer
        </button>
      </div>
    </div>
  );
}
