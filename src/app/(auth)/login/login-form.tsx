"use client";

import { useActionState, useState } from "react";
import { Loader2, Lock, LogIn, Mail, UserPlus } from "lucide-react";
import { signIn, signUp, type AuthResult } from "./actions";
import { cn } from "@/lib/utils";

type Mode = "signin" | "signup";

const INITIAL: AuthResult = { status: "ok" };

export function LoginForm() {
  const [mode, setMode] = useState<Mode>("signin");
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

  return (
    <div className="w-full max-w-sm">
      {/* Tabs */}
      <div className="mb-5 grid grid-cols-2 rounded-lg border border-border bg-cream-deep p-1">
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
        />
        <Field
          label="Mot de passe"
          icon={Lock}
          name="password"
          type="password"
          autoComplete={mode === "signin" ? "current-password" : "new-password"}
          placeholder={mode === "signup" ? "Au moins 6 caractères" : "•••••••"}
          minLength={6}
          disabled={isPending}
        />

        <button
          type="submit"
          disabled={isPending}
          className="flex h-12 items-center justify-center gap-2 rounded-md bg-gold font-bold text-navy shadow-[0_4px_0_0_#e89e00] transition-all hover:-translate-y-px hover:shadow-[0_6px_20px_rgba(245,183,0,0.55)] active:translate-y-px active:shadow-[0_2px_0_0_#e89e00] disabled:cursor-not-allowed disabled:opacity-60"
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
          ? "bg-white text-navy shadow-sm"
          : "text-navy/60 hover:text-navy",
      )}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
      {label}
    </button>
  );
}

function Field({
  label,
  icon: Icon,
  ...props
}: {
  label: string;
  icon: typeof Mail;
} & React.InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-1.5 text-sm">
      <span className="font-semibold text-navy">{label}</span>
      <div className="relative">
        <Icon
          className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-navy/40"
          aria-hidden="true"
        />
        <input
          {...props}
          required
          className="h-11 w-full rounded-md border border-border bg-white pl-10 pr-3 text-sm text-navy placeholder-navy/30 focus:border-gold focus:outline-none disabled:opacity-50"
        />
      </div>
    </label>
  );
}
