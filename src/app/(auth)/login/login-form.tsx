"use client";

import { useActionState } from "react";
import { Loader2, Mail, Send } from "lucide-react";
import { sendMagicLink, type LoginState } from "./actions";

const INITIAL: LoginState = { status: "idle", message: "" };

export function LoginForm() {
  const [state, formAction, isPending] = useActionState(sendMagicLink, INITIAL);

  return (
    <form action={formAction} className="flex w-full max-w-sm flex-col gap-4">
      <label className="flex flex-col gap-2 text-sm">
        <span className="font-medium">Email</span>
        <div className="relative">
          <Mail
            className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 opacity-60"
            aria-hidden="true"
          />
          <input
            name="email"
            type="email"
            required
            autoComplete="email"
            disabled={state.status === "sent" || isPending}
            placeholder="toi@exemple.fr"
            className="w-full rounded-md border border-white/20 bg-white/10 py-3 pl-10 pr-3 text-[#F1FAEE] placeholder-white/40 focus:border-[#F5C518] focus:outline-none disabled:opacity-50"
          />
        </div>
      </label>

      <button
        type="submit"
        disabled={isPending || state.status === "sent"}
        className="flex items-center justify-center gap-2 rounded-md bg-[#F5C518] px-4 py-3 font-semibold text-[#0B1F4D] transition-colors hover:bg-[#e6b900] disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? (
          <>
            <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
            Envoi…
          </>
        ) : (
          <>
            <Send className="h-4 w-4" aria-hidden="true" />
            Recevoir le lien
          </>
        )}
      </button>

      {state.status === "error" && (
        <p className="text-sm text-[#E63946]" role="alert">
          {state.message}
        </p>
      )}
      {state.status === "sent" && (
        <p className="text-sm text-[#2ECC71]" role="status">
          {state.message}
        </p>
      )}
    </form>
  );
}
