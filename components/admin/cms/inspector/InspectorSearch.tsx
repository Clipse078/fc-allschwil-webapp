"use client";

import { Search, X } from "lucide-react";

type Props = {
  value: string;
  onChange: (q: string) => void;
  placeholder?: string;
};

/**
 * Inspector search input with clear button.
 * Filters/highlights inspector sections while typing.
 */
export default function InspectorSearch({
  value,
  onChange,
  placeholder = "Suchen…",
}: Props) {
  return (
    <div className="relative">
      <Search className="pointer-events-none absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted)]" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-md border border-[var(--border)] bg-[var(--surface)] py-1.5 pl-7.5 pr-7 text-[12px] text-[var(--foreground)] placeholder:text-[var(--muted)] focus:border-[var(--brand-primary,#f97316)] focus:outline-none focus:ring-1 focus:ring-[var(--brand-primary,#f97316)] transition"
        style={{ paddingLeft: "1.875rem" }}
      />
      {value && (
        <button
          type="button"
          onClick={() => onChange("")}
          className="absolute right-2 top-1/2 -translate-y-1/2 rounded p-0.5 text-[var(--muted)] hover:text-[var(--foreground)] transition-colors"
          aria-label="Suche löschen"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
