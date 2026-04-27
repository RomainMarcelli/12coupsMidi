import { requireAdmin } from "@/lib/auth/admin-guard";
import { fetchAllUsers } from "@/lib/admin/users/actions";
import { UsersClient } from "./users-client";

export const metadata = { title: "Admin — Utilisateurs" };
export const dynamic = "force-dynamic";

export default async function AdminUsersPage() {
  const { user: caller } = await requireAdmin();
  const initial = await fetchAllUsers({ sort: "last_seen_at", sortDir: "desc" });
  const users = initial.status === "ok" ? initial.users : [];
  const error = initial.status === "error" ? initial.message : null;

  return (
    <UsersClient
      initialUsers={users}
      callerId={caller.id}
      initialError={error}
    />
  );
}
