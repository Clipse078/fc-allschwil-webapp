"use client";

import { Search } from "lucide-react";

type Props = {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  ariaLabel: string;
  className?: string;
};

/**
 * Canonical compact search field for registration lifecycle workspaces
 * (Registrierungen, Warteliste, Archiv).
 */
export function RegistrationWorkspaceSearchInput({
  value,
  onChange,
  placeholder,
  ariaLabel,
  className,
}: Props) {
  return (
    <div className={className ?? "relative min-w-[220px] flex-1"}>
      <Search
        className="pointer-events-none absolute left-3 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted)]"
        aria-hidden
      />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="fca-input fca-search-input h-8 w-full text-xs"
        aria-label={ariaLabel}
      />
    </div>
  );
}
