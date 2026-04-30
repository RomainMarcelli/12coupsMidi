"use client";

import { cn } from "@/lib/utils";

interface ToggleSwitchProps {
  checked: boolean;
  onChange: (next: boolean) => void;
  disabled?: boolean;
  label?: string;
  className?: string;
}

/**
 * Petit toggle ON/OFF (style iOS), accessible (role="switch").
 *
 * Dimensions :
 *  - Track : 44 × 24 (w-11 h-6)
 *  - Thumb : 20 × 20 (h-5 w-5)
 *  - Padding : 2 px de chaque côté (thumb centré vertical via flex items-center)
 *  - Déplacement : 20 px (translate-x-5)
 */
export function ToggleSwitch({
  checked,
  onChange,
  disabled = false,
  label,
  className,
}: ToggleSwitchProps) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={() => onChange(!checked)}
      className={cn(
        "relative inline-flex h-6 w-11 shrink-0 cursor-pointer items-center rounded-full border-2 px-0.5 transition-colors",
        checked
          ? "border-gold bg-gold/80"
          : "border-navy/20 bg-navy/15",
        disabled && "cursor-not-allowed opacity-50",
        className,
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "pointer-events-none inline-block h-4 w-4 transform rounded-full bg-white dark:bg-white shadow-md transition-transform duration-200",
          checked ? "translate-x-5" : "translate-x-0",
        )}
      />
    </button>
  );
}
