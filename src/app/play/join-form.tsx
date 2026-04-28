"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { Gamepad2, Loader2 } from "lucide-react";

/**
 * H4.4 — Formulaire de rejoinde par code à 4 chiffres.
 *
 * - Auto-focus sur l'input à l'arrivée.
 * - Validation : 4 chiffres uniquement.
 * - Submit Entrée OU clic bouton.
 * - Redirige vers `/play/<code>` qui prendra en charge le check du
 *   code (page existante).
 */
export function JoinByCodeForm() {
  const router = useRouter();
  const inputRef = useRef<HTMLInputElement>(null);
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    inputRef.current?.focus();
  }, []);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    if (!/^\d{4}$/.test(code)) {
      setError("Le code doit contenir 4 chiffres.");
      return;
    }
    setError(null);
    setSubmitting(true);
    router.push(`/play/${code}`);
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="flex w-full flex-col items-center gap-5 rounded-3xl border border-gold/30 bg-card p-8 shadow-[0_8px_40px_rgba(245,183,0,0.18)]"
    >
      <div className="flex h-20 w-20 items-center justify-center rounded-3xl bg-gold/15 text-gold-warm">
        <Gamepad2 className="h-10 w-10" aria-hidden="true" />
      </div>
      <div className="flex flex-col gap-1">
        <p className="text-xs font-bold uppercase tracking-widest text-gold-warm">
          Mode TV Soirée
        </p>
        <h1 className="font-display text-3xl font-extrabold text-foreground">
          Rejoindre une partie
        </h1>
        <p className="text-foreground/65">
          Entre le code à 4 chiffres affiché sur la TV.
        </p>
      </div>
      <input
        ref={inputRef}
        type="text"
        inputMode="numeric"
        pattern="[0-9]*"
        maxLength={4}
        autoComplete="off"
        placeholder="0000"
        value={code}
        onChange={(e) => {
          // Filtre les non-chiffres au fil de la frappe.
          const digits = e.target.value.replace(/\D/g, "").slice(0, 4);
          setCode(digits);
          if (error) setError(null);
        }}
        className="h-16 w-48 rounded-2xl border-2 border-border bg-card text-center font-display text-4xl font-extrabold tracking-[0.4em] text-foreground focus:border-gold focus:outline-none"
      />
      {error && (
        <p
          role="alert"
          className="rounded-md border border-buzz/40 bg-buzz/10 px-3 py-2 text-sm text-buzz"
        >
          {error}
        </p>
      )}
      <button
        type="submit"
        disabled={code.length !== 4 || submitting}
        className="inline-flex h-12 items-center gap-2 rounded-md bg-gold px-8 font-bold text-on-color shadow-[0_4px_0_0_#e89e00] transition-all hover:-translate-y-px disabled:opacity-50"
      >
        {submitting ? (
          <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
        ) : null}
        Rejoindre
      </button>
    </form>
  );
}
