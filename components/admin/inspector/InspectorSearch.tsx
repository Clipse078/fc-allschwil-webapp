"use client";

/**
 * components/admin/inspector/InspectorSearch.tsx
 *
 * Search input for the inspector panel. Filters visible sections by
 * matching the query against section titles. Scrolls the first match
 * into view using data-inspector-section attributes on InspectorSection.
 *
 * Usage:
 *   <InspectorSearch value={query} onChange={setQuery} />
 */

import { Search, X } from "lucide-react";
import { useCallback } from "react";

// ---------------------------------------------------------------------------
// Props
// ---------------------------------------------------------------------------

export type InspectorSearchProps = {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
};

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export default function InspectorSearch({
  value,
  onChange,
  placeholder = "Einstellung suchen…",
}: InspectorSearchProps) {
  const handleClear = useCallback(() => onChange(""), [onChange]);

  return (
    <div className="relative flex items-center">
      <Search className="pointer-events-none absolute left-2.5 h-3.5 w-3.5 text-[var(--muted)]" />
      <input
        type="search"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="fca-input w-full py-1.5 pl-8 pr-7 text-xs"
      />
      {value && (
        <button
          type="button"
          onClick={handleClear}
          className="absolute right-2 text-[var(--muted)] hover:text-[var(--foreground)] transition"
          aria-label="Suche löschen"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
