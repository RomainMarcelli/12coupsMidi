"use client";

import { Eye, EyeOff } from "lucide-react";
import { forwardRef, useState } from "react";
import { cn } from "@/lib/utils";

/**
 * M2.1 — Champ mot de passe avec toggle œil pour afficher/masquer
 * la valeur saisie. Wrappe un `<input>` natif et conserve toutes les
 * props HTML standard (name, value, defaultValue, autoComplete,
 * placeholder, required, etc.).
 *
 * Le bouton œil :
 *   - est `tabIndex={-1}` pour ne pas casser la navigation clavier
 *     (Tab → champ → bouton submit, sans interception)
 *   - utilise `type="button"` pour ne pas soumettre le form au clic
 *   - a un `aria-label` qui change selon l'état (a11y)
 *
 * Usage :
 *
 *     <PasswordInput
 *       name="password"
 *       autoComplete="current-password"
 *       required
 *       className="..."
 *     />
 */
export type PasswordInputProps = Omit<
  React.InputHTMLAttributes<HTMLInputElement>,
  "type"
>;

export const PasswordInput = forwardRef<HTMLInputElement, PasswordInputProps>(
  function PasswordInput({ className, ...props }, ref) {
    const [visible, setVisible] = useState(false);

    return (
      <div className="relative">
        <input
          {...props}
          ref={ref}
          type={visible ? "text" : "password"}
          className={cn("pr-10", className)}
        />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          tabIndex={-1}
          aria-label={
            visible ? "Masquer le mot de passe" : "Afficher le mot de passe"
          }
          aria-pressed={visible}
          className="absolute right-2 top-1/2 -translate-y-1/2 text-foreground/50 transition-colors hover:text-foreground"
        >
          {visible ? (
            <EyeOff className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Eye className="h-4 w-4" aria-hidden="true" />
          )}
        </button>
      </div>
    );
  },
);
