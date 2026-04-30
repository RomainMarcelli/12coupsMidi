import { JoinByCodeForm } from "./join-form";

export const metadata = { title: "Rejoindre une partie" };

/**
 * H4.4 — Page de rejoinde une partie TV par code à 4 chiffres.
 * Accessible aux utilisateurs NON connectés (cf. middleware
 * `isPublicPath` : `/play` et `/play/*` sont publics).
 */
export default function JoinPlayPage() {
  return (
    <main className="mx-auto flex w-full max-w-md flex-1 flex-col items-center justify-center gap-6 p-6 text-center">
      <JoinByCodeForm />
    </main>
  );
}
