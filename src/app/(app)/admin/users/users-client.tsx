"use client";

import { useEffect, useState, useTransition } from "react";
import {
  Crown,
  Pencil,
  Search,
  Shield,
  Trash2,
  User as UserIcon,
  X,
} from "lucide-react";
import Image from "next/image";
import { AnimatePresence, motion } from "framer-motion";
import { Button } from "@/components/ui/button";
import {
  deleteUserAccount,
  fetchAllUsers,
  updateUserRole,
  type AdminUserRow,
  type UserFilter,
  type UserSortKey,
} from "@/lib/admin/users/actions";
import { cn } from "@/lib/utils";

interface Props {
  initialUsers: AdminUserRow[];
  callerId: string;
  initialError: string | null;
}

export function UsersClient({ initialUsers, callerId, initialError }: Props) {
  const [users, setUsers] = useState<AdminUserRow[]>(initialUsers);
  const [search, setSearch] = useState("");
  const [filter, setFilter] = useState<UserFilter>("all");
  const [sort, setSort] = useState<UserSortKey>("last_seen_at");
  const [error, setError] = useState<string | null>(initialError);
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState<AdminUserRow | null>(null);
  const [deleting, setDeleting] = useState<AdminUserRow | null>(null);

  // Re-fetch quand search/filter/sort change (avec debounce search)
  useEffect(() => {
    const t = window.setTimeout(() => {
      startTransition(async () => {
        const res = await fetchAllUsers({
          search,
          filter,
          sort,
          sortDir: sort === "pseudo" ? "asc" : "desc",
        });
        if (res.status === "ok") {
          setUsers(res.users);
          setError(null);
        } else setError(res.message);
      });
    }, 250);
    return () => window.clearTimeout(t);
  }, [search, filter, sort]);

  const adminCount = users.filter((u) => u.role === "admin").length;

  return (
    <main className="mx-auto flex w-full max-w-6xl flex-1 flex-col gap-5 p-4 sm:p-6 lg:p-8">
      <header className="flex flex-col gap-2">
        <div className="inline-flex w-fit items-center gap-2 rounded-full bg-buzz/15 px-3 py-1 text-xs font-bold uppercase tracking-widest text-buzz">
          <Shield className="h-3.5 w-3.5" aria-hidden="true" />
          Admin
        </div>
        <h1 className="font-display text-3xl font-extrabold text-foreground">
          Gestion des utilisateurs
        </h1>
        <p className="text-sm text-foreground/65">
          {users.length} user{users.length > 1 ? "s" : ""} ·{" "}
          {adminCount} admin{adminCount > 1 ? "s" : ""}
        </p>
      </header>

      {error && (
        <p className="rounded-md border border-buzz/40 bg-buzz/10 px-3 py-2 text-sm text-buzz">
          {error}
        </p>
      )}

      {/* Recherche + filtres + tri */}
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40"
            aria-hidden="true"
          />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Recherche par pseudo ou email…"
            className="h-10 w-full rounded-md border border-border bg-card pl-9 pr-3 text-sm text-foreground focus:border-gold focus:outline-none"
          />
        </div>
        <select
          value={filter}
          onChange={(e) => setFilter(e.target.value as UserFilter)}
          className="h-10 rounded-md border border-border bg-card px-2 text-sm font-bold text-foreground focus:border-gold focus:outline-none"
        >
          <option value="all">Tous</option>
          <option value="admins">Admins</option>
          <option value="users">Joueurs</option>
          <option value="inactive">Inactifs (&gt;30j)</option>
        </select>
        <select
          value={sort}
          onChange={(e) => setSort(e.target.value as UserSortKey)}
          className="h-10 rounded-md border border-border bg-card px-2 text-sm font-bold text-foreground focus:border-gold focus:outline-none"
        >
          <option value="last_seen_at">Dernière activité</option>
          <option value="created_at">Date inscription</option>
          <option value="games_played">Parties jouées</option>
          <option value="xp">XP</option>
          <option value="pseudo">Pseudo</option>
        </select>
      </div>

      {/* Tableau (desktop) / Cards (mobile) */}
      <div className="overflow-x-auto rounded-2xl border border-border bg-card">
        <table className="w-full text-sm">
          <thead className="border-b border-border bg-card text-xs uppercase tracking-wider text-foreground/55">
            <tr>
              <th className="p-3 text-left">Joueur</th>
              <th className="hidden p-3 text-left sm:table-cell">Email</th>
              <th className="p-3 text-left">Rôle</th>
              <th className="hidden p-3 text-right sm:table-cell">Parties</th>
              <th className="hidden p-3 text-right md:table-cell">XP / Niv.</th>
              <th className="hidden p-3 text-left lg:table-cell">
                Dernière activité
              </th>
              <th className="p-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody>
            {users.length === 0 ? (
              <tr>
                <td
                  colSpan={7}
                  className="p-6 text-center text-foreground/55"
                >
                  {isPending ? "Chargement…" : "Aucun utilisateur trouvé."}
                </td>
              </tr>
            ) : (
              users.map((u) => (
                <UserRow
                  key={u.id}
                  user={u}
                  isSelf={u.id === callerId}
                  onEdit={() => setEditing(u)}
                  onDelete={() => setDeleting(u)}
                />
              ))
            )}
          </tbody>
        </table>
      </div>

      <EditUserModal
        user={editing}
        isSelfEdit={editing?.id === callerId}
        onClose={() => setEditing(null)}
        onSaved={(updated) => {
          setUsers((prev) =>
            prev.map((u) => (u.id === updated.id ? updated : u)),
          );
          setEditing(null);
        }}
      />

      <DeleteUserModal
        user={deleting}
        onClose={() => setDeleting(null)}
        onDeleted={(id) => {
          setUsers((prev) => prev.filter((u) => u.id !== id));
          setDeleting(null);
        }}
      />
    </main>
  );
}

function UserRow({
  user,
  isSelf,
  onEdit,
  onDelete,
}: {
  user: AdminUserRow;
  isSelf: boolean;
  onEdit: () => void;
  onDelete: () => void;
}) {
  return (
    <tr className="border-b border-border last:border-b-0 hover:bg-foreground/5">
      <td className="p-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center overflow-hidden rounded-lg border border-border bg-gold/10">
            {user.avatar_url ? (
              <Image
                src={user.avatar_url}
                alt=""
                width={36}
                height={36}
                className="h-full w-full object-cover"
                unoptimized
              />
            ) : (
              <Crown
                className="h-4 w-4 text-gold-warm"
                aria-hidden="true"
              />
            )}
          </div>
          <div className="flex flex-col leading-tight">
            <span className="font-bold text-foreground">
              {user.pseudo ?? "(sans pseudo)"}
              {isSelf && (
                <span className="ml-1 text-[10px] text-gold-warm">
                  (toi)
                </span>
              )}
            </span>
            <span className="text-xs text-foreground/55 sm:hidden">
              {user.email}
            </span>
          </div>
        </div>
      </td>
      <td className="hidden p-3 text-foreground/70 sm:table-cell">
        {user.email}
      </td>
      <td className="p-3">
        {user.role === "admin" ? (
          <span className="inline-flex items-center gap-1 rounded-full bg-gold/15 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-gold-warm">
            <Shield className="h-3 w-3" aria-hidden="true" />
            Admin
          </span>
        ) : (
          <span className="inline-flex items-center gap-1 rounded-full bg-foreground/10 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wider text-foreground/65">
            <UserIcon className="h-3 w-3" aria-hidden="true" />
            Joueur
          </span>
        )}
      </td>
      <td className="hidden p-3 text-right tabular-nums text-foreground/70 sm:table-cell">
        {user.games_played}
      </td>
      <td className="hidden p-3 text-right tabular-nums text-foreground/70 md:table-cell">
        {user.xp} / {user.niveau}
      </td>
      <td className="hidden p-3 text-foreground/65 lg:table-cell">
        {user.last_seen_at
          ? new Date(user.last_seen_at).toLocaleDateString("fr-FR")
          : "—"}
      </td>
      <td className="p-3 text-right">
        <div className="inline-flex items-center gap-1">
          <button
            type="button"
            onClick={onEdit}
            aria-label="Modifier"
            className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card text-foreground/70 transition-colors hover:border-gold/50 hover:bg-gold/10 hover:text-gold-warm"
          >
            <Pencil className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
          <button
            type="button"
            onClick={onDelete}
            disabled={isSelf}
            aria-label="Supprimer"
            className="flex h-8 w-8 items-center justify-center rounded-md border border-border bg-card text-buzz transition-colors hover:border-buzz/40 hover:bg-buzz/10 disabled:cursor-not-allowed disabled:opacity-30"
          >
            <Trash2 className="h-3.5 w-3.5" aria-hidden="true" />
          </button>
        </div>
      </td>
    </tr>
  );
}

// =============================================================================
// Modal édition (rôle uniquement pour l'instant)
// =============================================================================

function EditUserModal({
  user,
  isSelfEdit,
  onClose,
  onSaved,
}: {
  user: AdminUserRow | null;
  isSelfEdit: boolean;
  onClose: () => void;
  onSaved: (u: AdminUserRow) => void;
}) {
  const [role, setRole] = useState<"user" | "admin">("user");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setRole(user.role);
      setError(null);
    }
  }, [user]);

  if (!user) return null;

  function save() {
    if (!user) return;
    setError(null);
    startTransition(async () => {
      const res = await updateUserRole(user.id, role);
      if (res.status === "ok") {
        onSaved({ ...user, role });
      } else setError(res.message);
    });
  }

  return (
    <AnimatePresence>
      {user && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-foreground/60 p-4"
          role="dialog"
          aria-modal="true"
        >
          <motion.div
            initial={{ scale: 0.95, y: 10 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 10 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md rounded-2xl border border-border bg-card p-6 shadow-2xl"
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer"
              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-md text-foreground/60 hover:bg-foreground/10 hover:text-foreground"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
            <h2 className="font-display text-xl font-extrabold text-foreground">
              Modifier {user.pseudo ?? user.email}
            </h2>
            <p className="mt-1 text-sm text-foreground/65">
              Tu peux changer le rôle de cet utilisateur.
            </p>

            <div className="mt-4 flex flex-col gap-2">
              <label className="text-xs font-bold uppercase tracking-wider text-foreground/55">
                Rôle
              </label>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setRole("user")}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-md border-2 px-3 py-2 text-sm font-bold transition-colors",
                    role === "user"
                      ? "border-foreground bg-foreground/5 text-foreground"
                      : "border-border bg-card text-foreground/55 hover:border-foreground/40",
                  )}
                >
                  <UserIcon className="h-4 w-4" aria-hidden="true" />
                  Joueur
                </button>
                <button
                  type="button"
                  onClick={() => setRole("admin")}
                  className={cn(
                    "flex items-center justify-center gap-2 rounded-md border-2 px-3 py-2 text-sm font-bold transition-colors",
                    role === "admin"
                      ? "border-gold bg-gold/15 text-gold-warm"
                      : "border-border bg-card text-foreground/55 hover:border-gold/40",
                  )}
                >
                  <Shield className="h-4 w-4" aria-hidden="true" />
                  Admin
                </button>
              </div>
              {isSelfEdit && role !== "admin" && (
                <p className="rounded-md border border-buzz/40 bg-buzz/10 px-3 py-2 text-xs text-buzz">
                  Tu ne peux pas te rétrograder toi-même (sécurité :
                  l&apos;app deviendrait sans admin).
                </p>
              )}
            </div>

            {error && (
              <p className="mt-3 rounded-md border border-buzz/40 bg-buzz/10 px-3 py-2 text-sm text-buzz">
                {error}
              </p>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="h-10 rounded-md border border-border bg-card px-4 text-sm font-bold text-foreground/70 hover:border-foreground/30"
              >
                Annuler
              </button>
              <Button
                variant="gold"
                size="lg"
                onClick={save}
                disabled={
                  isPending ||
                  role === user.role ||
                  (isSelfEdit && role !== "admin")
                }
              >
                {isPending ? "Enregistrement…" : "Enregistrer"}
              </Button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

// =============================================================================
// Modal suppression
// =============================================================================

function DeleteUserModal({
  user,
  onClose,
  onDeleted,
}: {
  user: AdminUserRow | null;
  onClose: () => void;
  onDeleted: (id: string) => void;
}) {
  const [confirm, setConfirm] = useState("");
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (user) {
      setConfirm("");
      setError(null);
    }
  }, [user]);

  if (!user) return null;

  function doDelete() {
    if (!user) return;
    setError(null);
    startTransition(async () => {
      const res = await deleteUserAccount(user.id);
      if (res.status === "ok") onDeleted(user.id);
      else setError(res.message);
    });
  }

  const expectedConfirm = user.pseudo ?? user.email;
  const canDelete = confirm.trim() === expectedConfirm;

  return (
    <AnimatePresence>
      {user && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
          className="fixed inset-0 z-[200] flex items-center justify-center bg-foreground/60 p-4"
          role="dialog"
          aria-modal="true"
        >
          <motion.div
            initial={{ scale: 0.95, y: 10 }}
            animate={{ scale: 1, y: 0 }}
            exit={{ scale: 0.95, y: 10 }}
            onClick={(e) => e.stopPropagation()}
            className="relative w-full max-w-md rounded-2xl border border-buzz/40 bg-card p-6 shadow-2xl"
          >
            <button
              type="button"
              onClick={onClose}
              aria-label="Fermer"
              className="absolute right-3 top-3 flex h-8 w-8 items-center justify-center rounded-md text-foreground/60 hover:bg-foreground/10 hover:text-foreground"
            >
              <X className="h-4 w-4" aria-hidden="true" />
            </button>
            <h2 className="inline-flex items-center gap-2 font-display text-xl font-extrabold text-buzz">
              <Trash2 className="h-5 w-5" aria-hidden="true" />
              Supprimer {user.pseudo ?? user.email}
            </h2>
            <p className="mt-2 text-sm text-foreground/80">
              Cette action est <strong>irréversible</strong>. Le compte
              de <strong>{expectedConfirm}</strong> sera supprimé avec
              toutes ses données (parties, favoris, joueurs sauvegardés…).
            </p>
            <p className="mt-3 text-xs text-foreground/65">
              Pour confirmer, tape <strong>{expectedConfirm}</strong>{" "}
              ci-dessous :
            </p>
            <input
              type="text"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="mt-2 h-10 w-full rounded-md border border-border bg-card px-3 text-sm text-foreground focus:border-buzz focus:outline-none"
              placeholder={expectedConfirm}
              autoFocus
            />

            {error && (
              <p className="mt-3 rounded-md border border-buzz/40 bg-buzz/10 px-3 py-2 text-sm text-buzz">
                {error}
              </p>
            )}

            <div className="mt-5 flex justify-end gap-2">
              <button
                type="button"
                onClick={onClose}
                className="h-10 rounded-md border border-border bg-card px-4 text-sm font-bold text-foreground/70 hover:border-foreground/30"
              >
                Annuler
              </button>
              <button
                type="button"
                onClick={doDelete}
                disabled={!canDelete || isPending}
                className="inline-flex h-10 items-center gap-2 rounded-md bg-buzz px-5 text-sm font-bold text-white shadow-[0_4px_0_0_#a82531] transition-all hover:-translate-y-px disabled:cursor-not-allowed disabled:opacity-40"
              >
                <Trash2 className="h-4 w-4" aria-hidden="true" />
                {isPending ? "Suppression…" : "Supprimer définitivement"}
              </button>
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
