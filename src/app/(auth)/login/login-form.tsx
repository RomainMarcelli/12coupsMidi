"use client";

import { forwardRef, useActionState, useEffect, useRef, useState } from "react";
import { Eye, EyeOff, Loader2, Lock, LogIn, Mail, UserPlus } from "lucide-react";
import { signIn, signUp, type AuthResult } from "./actions";
import { cn } from "@/lib/utils";

type Mode = "signin" | "signup";

const INITIAL: AuthResult = { status: "ok" };

/**
 * N1.1 — Le formulaire de login conserve l'email saisi quand
 * l'authentification échoue, vide uniquement le mot de passe et le
 * focus dessus. Évite à l'utilisateur de retaper son email à chaque
 * tentative.
 *
 * Implémentation :
 *   - email : state contrôlé (`useState`) → préservé au re-render
 *   - password : input non-contrôlé, manipulé via un ref → reset
 *     après un retour `state.status === "error"` du server action,
 *     puis focus + sélection (au cas où l'utilisateur veut taper
 *     par-dessus immédiatement).
 */
export function LoginForm() {
  const [mode, setMode] = useState<Mode>("signin");
  const [email, setEmail] = useState("");
  const passwordRef = useRef<HTMLInputElement>(null);

  const [signInState, signInAction, signInPending] = useActionState(
    signIn,
    INITIAL,
  );
  const [signUpState, signUpAction, signUpPending] = useActionState(
    signUp,
    INITIAL,
  );

  const state = mode === "signin" ? signInState : signUpState;
  const isPending = mode === "signin" ? signInPending : signUpPending;
  const action = mode === "signin" ? signInAction : signUpAction;

  // N1.1 — Quand on reçoit une erreur, vide le password et focus dessus.
  useEffect(() => {
    if (state.status === "error" && passwordRef.current) {
      passwordRef.current.value = "";
      passwordRef.current.focus();
    }
  }, [state]);

  return (
    <div className="w-full max-w-sm">
      {/* Tabs */}
      <div className="mb-5 grid grid-cols-2 rounded-lg border border-border bg-muted p-1">
        <TabButton
          active={mode === "signin"}
          onClick={() => setMode("signin")}
          icon={LogIn}
          label="Connexion"
        />
        <TabButton
          active={mode === "signup"}
          onClick={() => setMode("signup")}
          icon={UserPlus}
          label="Inscription"
        />
      </div>

      <form action={action} className="flex flex-col gap-4">
        <Field
          label="Email"
          icon={Mail}
          name="email"
          type="email"
          autoComplete="email"
          placeholder="toi@exemple.fr"
          disabled={isPending}
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <Field
          label="Mot de passe"
          icon={Lock}
          name="password"
          type="password"
          ref={passwordRef}
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          placeholder={mode === "signup" ? "Au moins 6 caractères" : "•••••••"}
          minLength={6}
          disabled={isPending}
        />

        <button
          type="submit"
          disabled={isPending}
          className="flex h-12 items-center justify-center gap-2 rounded-md bg-gold font-bold text-on-color shadow-[0_4px_0_0_#e89e00] transition-all hover:-translate-y-px hover:shadow-[0_6px_20px_rgba(245,183,0,0.55)] active:translate-y-px active:shadow-[0_2px_0_0_#e89e00] disabled:cursor-not-allowed disabled:opacity-60"
        >
          {isPending ? (
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
          ) : mode === "signin" ? (
            <LogIn className="h-4 w-4" aria-hidden="true" />
          ) : (
            <UserPlus className="h-4 w-4" aria-hidden="true" />
          )}
          {isPending
            ? "…"
            : mode === "signin"
              ? "Se connecter"
              : "Créer mon compte"}
        </button>

        {state.status === "error" && (
          <p
            className="rounded-md border border-buzz/40 bg-buzz/10 p-3 text-sm text-buzz"
            role="alert"
          >
            {state.message}
          </p>
        )}
      </form>
    </div>
  );
}

// ---------------------------------------------------------------------------

function TabButton({
  active,
  onClick,
  icon: Icon,
  label,
}: {
  active: boolean;
  onClick: () => void;
  icon: typeof LogIn;
  label: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "flex items-center justify-center gap-1.5 rounded-md py-2 text-sm font-semibold transition-all",
        active
          ? "bg-card text-foreground shadow-sm"
          : "text-foreground/60 hover:text-foreground",
      )}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {label}
    </button>
  );
}

interface FieldProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label: string;
  icon: typeof Mail;
}

const Field = forwardRef<HTMLInputElement, FieldProps>(function Field(
  { label, icon: Icon, ...props },
  ref,
) {
  // M2.1 — Pour les champs password, on gère le toggle œil ici
  // directement (pas via le composant PasswordInput) car on a déjà
  // une icône à gauche dans le wrapper relatif.
  const isPassword = props.type === "password";
  const [visible, setVisible] = useState(false);
  const effectiveType = isPassword && visible ? "text" : props.type;

  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-semibold text-foreground">{label}</span>
      <div className="relative">
        <Icon
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-foreground/40"
          aria-hidden="true"
        />
        <input
          {...props}
          ref={ref}
          type={effectiveType}
          required
          className={cn(
            "h-11 w-full rounded-md border border-border bg-card pl-10 text-sm text-foreground placeholder-foreground/30 focus:border-gold focus:outline-none disabled:opacity-50",
            isPassword ? "pr-10" : "pr-3",
          )}
        />
        {isPassword && (
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            tabIndex={-1}
            aria-label={
              visible
                ? "Masquer le mot de passe"
                : "Afficher le mot de passe"
            }
            aria-pressed={visible}
            className="absolute right-3 top-1/2 -translate-y-1/2 text-foreground/50 transition-colors hover:text-foreground"
          >
            {visible ? (
              <EyeOff className="h-4 w-4" aria-hidden="true" />
            ) : (
              <Eye className="h-4 w-4" aria-hidden="true" />
            )}
          </button>
        )}
      </div>
    </label>
  );
});
