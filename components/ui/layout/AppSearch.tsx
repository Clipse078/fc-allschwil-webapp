"use client";

import { Search, X } from "lucide-react";
import { cn } from "@/lib/cn";

type AppSearchProps = {
  /** Current search query value. */
  value: string;
  /** Called on every keystroke with the new value. */
  onChange: (value: string) => void;
  /** Input placeholder text. Defaults to "Suchen…". */
  placeholder?: string;
  /** Additional className applied to the outer wrapper. */
  className?: string;
};

/**
 * AppSearch
 *
 * Standardised search input for admin module toolbars.
 * Includes a leading search icon and an inline clear (×) button when a
 * value is present.
 *
 * Client component — manages uncontrolled input interaction only.
 * All state lives in the parent (typically the list/table component).
 *
 * Usage inside AppToolbar:
 *   <AppToolbar
 *     search={<AppSearch value={query} onChange={setQuery} placeholder="Team suchen…" />}
 *   />
 */
export function AppSearch({
  value,
  onChange,
  placeholder = "Suchen…",
  className,
}: AppSearchProps) {
  return (
    <div className={cn("relative flex items-center", className)}>
      <Search
        className="pointer-events-none absolute left-3 h-4 w-4 text-[var(--muted)]"
        aria-hidden="true"
      />

      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className={cn(
          "h-9 w-full min-w-[200px] max-w-xs rounded-lg border border-[var(--border)]",
          "bg-[var(--surface)] pl-9 pr-8 text-sm text-[var(--foreground)]",
          "placeholder:text-[var(--muted)]",
          "transition-colors",
          "focus-visible:border-[var(--tenant-primary)]",
          "focus-visible:outline-none focus-visible:ring-2",
          "focus-visible:ring-[color-mix(in_srgb,var(--tenant-primary)_20%,transparent)]",
        )}
      />

      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className={cn(
            "absolute right-2.5 flex h-4 w-4 items-center justify-center rounded",
            "text-[var(--muted)] transition-colors hover:text-[var(--foreground)]",
          )}
          aria-label="Suche löschen"
        >
          <X className="h-3.5 w-3.5" aria-hidden="true" />
        </button>
      )}
    </div>
  );
}
