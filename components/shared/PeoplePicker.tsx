"use client";

/**
 * PeoplePicker — reusable person search + select widget.
 *
 * Features:
 * - Search-as-you-type (300 ms debounce, min 2 chars)
 * - Keyboard navigation (↑ ↓ Enter Escape)
 * - Avatar/initials
 * - Person name + email/phone subtitle
 * - Role badges (Spieler / Trainer)
 * - Single-select: shows selected chip with X to clear
 * - Multi-select: calls onSelect per pick; caller manages chip list + passes excludeIds
 * - Loading, empty, and error states
 * - SCE design tokens only
 */

import { useEffect, useRef, useState } from "react";
import { Loader2, Search, X } from "lucide-react";

export type PersonPickerResult = {
  id: string;
  firstName: string;
  lastName: string;
  displayName: string | null;
  email: string | null;
  phone: string | null;
  dateOfBirth?: string | null;
  isPlayer?: boolean;
  isTrainer?: boolean;
};

export type PeoplePickerProps = {
  /** Search mode forwarded to /api/people/search */
  mode?: "any" | "player" | "trainer";
  /** Passed to API to filter by team season (birth year, existing members) */
  teamSeasonId?: string;
  /** IDs to exclude from results (already-selected / already-added persons) */
  excludeIds?: string[];
  /** Currently selected person — renders a chip instead of the input */
  selected?: PersonPickerResult | null;
  /** Called when a person is picked from the dropdown */
  onSelect: (person: PersonPickerResult) => void;
  /** Called when the user clears the chip (single-select deselect) */
  onClearSelected?: () => void;
  placeholder?: string;
  disabled?: boolean;
};

function getPersonLabel(p: PersonPickerResult): string {
  return p.displayName || `${p.firstName} ${p.lastName}`;
}

function getInitials(name: string): string {
  return name
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((w) => w.charAt(0).toUpperCase())
    .join("");
}

function PersonAvatar({ name }: { name: string }) {
  return (
    <div
      aria-hidden
      className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-slate-200 bg-gradient-to-br from-white to-slate-100 text-[0.65rem] font-bold uppercase tracking-wide text-[var(--blue)]"
    >
      {getInitials(name) || "?"}
    </div>
  );
}

export function PeoplePicker({
  mode = "any",
  teamSeasonId,
  excludeIds = [],
  selected = null,
  onSelect,
  onClearSelected,
  placeholder = "Person suchen…",
  disabled = false,
}: PeoplePickerProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PersonPickerResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  // Use ref so excludeIds changes don't re-run the search effect
  const excludeRef = useRef(excludeIds);
  excludeRef.current = excludeIds;

  // Debounced search effect
  useEffect(() => {
    clearTimeout(debounceRef.current);
    setError(null);

    if (query.trim().length < 2) {
      setResults([]);
      setOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        let url = `/api/people/search?q=${encodeURIComponent(query.trim())}&mode=${mode}`;
        if (teamSeasonId) url += `&teamSeasonId=${encodeURIComponent(teamSeasonId)}`;

        const res = await fetch(url, { cache: "no-store" });
        const data = await res.json().catch(() => null);
        if (!res.ok) throw new Error(data?.error ?? "Personensuche fehlgeschlagen.");

        const all = Array.isArray(data) ? (data as PersonPickerResult[]) : [];
        const filtered = all.filter((p) => !excludeRef.current.includes(p.id));

        setResults(filtered);
        setOpen(true);
        setFocusedIndex(0);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Fehler bei der Suche.");
        setResults([]);
        setOpen(false);
      } finally {
        setLoading(false);
      }
    }, 300);

    return () => clearTimeout(debounceRef.current);
  }, [query, mode, teamSeasonId]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  function handleSelect(person: PersonPickerResult) {
    onSelect(person);
    setQuery("");
    setResults([]);
    setOpen(false);
    setFocusedIndex(0);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (!open && results.length > 0) {
          setOpen(true);
        } else {
          setFocusedIndex((prev) => Math.min(prev + 1, results.length - 1));
        }
        break;
      case "ArrowUp":
        e.preventDefault();
        setFocusedIndex((prev) => Math.max(prev - 1, 0));
        break;
      case "Enter":
        e.preventDefault();
        if (open && results[focusedIndex]) {
          handleSelect(results[focusedIndex]);
        }
        break;
      case "Escape":
        e.preventDefault();
        setOpen(false);
        setQuery("");
        setResults([]);
        break;
    }
  }

  return (
    <div ref={containerRef} className="relative w-full">
      {/* Single-select chip */}
      {selected ? (
        <div className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--surface-2)] px-3 py-2.5">
          <PersonAvatar name={getPersonLabel(selected)} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-[var(--foreground)]">
              {getPersonLabel(selected)}
            </p>
            {selected.email ? (
              <p className="truncate text-xs text-[var(--muted)]">{selected.email}</p>
            ) : selected.phone ? (
              <p className="truncate text-xs text-[var(--muted)]">{selected.phone}</p>
            ) : null}
          </div>
          {onClearSelected ? (
            <button
              type="button"
              onClick={() => {
                onClearSelected();
                setTimeout(() => inputRef.current?.focus(), 0);
              }}
              className="flex h-6 w-6 flex-shrink-0 items-center justify-center rounded-full text-[var(--muted)] transition hover:bg-slate-200 hover:text-[var(--foreground)]"
              aria-label="Auswahl aufheben"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      ) : (
        /* Search input */
        <div
          className={`sce-page-search${disabled ? " pointer-events-none opacity-50" : ""}`}
          onClick={() => !disabled && inputRef.current?.focus()}
        >
          {loading ? (
            <Loader2 className="h-4 w-4 flex-shrink-0 animate-spin text-[var(--muted)]" />
          ) : (
            <Search className="h-4 w-4 flex-shrink-0 text-[var(--muted)]" />
          )}
          <input
            ref={inputRef}
            type="text"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={handleKeyDown}
            onFocus={() => {
              if (results.length > 0) setOpen(true);
            }}
            placeholder={placeholder}
            disabled={disabled}
            autoComplete="off"
            spellCheck={false}
            aria-expanded={open}
            aria-haspopup="listbox"
            aria-autocomplete="list"
            aria-controls="people-picker-listbox"
            role="combobox"
          />
          {query.length > 0 ? (
            <button
              type="button"
              tabIndex={-1}
              onClick={() => {
                setQuery("");
                setResults([]);
                setOpen(false);
                inputRef.current?.focus();
              }}
              className="flex h-5 w-5 flex-shrink-0 items-center justify-center rounded-full text-[var(--muted)] transition hover:bg-slate-200"
              aria-label="Suche leeren"
            >
              <X className="h-3 w-3" />
            </button>
          ) : null}
        </div>
      )}

      {/* Hint */}
      {!selected && !loading && query.length > 0 && query.length < 2 ? (
        <p className="mt-1.5 text-[11px] text-[var(--muted)]">
          Mindestens 2 Zeichen eingeben.
        </p>
      ) : null}

      {/* Error */}
      {error ? (
        <p className="mt-1.5 text-xs text-rose-600">{error}</p>
      ) : null}

      {/* Empty state */}
      {!loading && !error && !open && query.trim().length >= 2 && results.length === 0 ? (
        <p className="mt-1.5 text-xs italic text-[var(--muted)]">
          Keine Personen gefunden.
        </p>
      ) : null}

      {/* Results dropdown */}
      {open && results.length > 0 ? (
        <ul
          id="people-picker-listbox"
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-64 overflow-y-auto rounded-[var(--radius-xl)] border border-[var(--border-strong)] bg-[var(--surface)] py-1 shadow-[var(--shadow-lg)]"
        >
          {results.map((person, index) => {
            const label = getPersonLabel(person);
            const subtitle = person.email || person.phone || null;
            const isFocused = index === focusedIndex;

            return (
              <li key={person.id} role="option" aria-selected={isFocused}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    // Prevent input blur before click registers
                    e.preventDefault();
                    handleSelect(person);
                  }}
                  onMouseEnter={() => setFocusedIndex(index)}
                  className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors${
                    isFocused ? " bg-[var(--surface-2)]" : " hover:bg-[var(--surface-2)]"
                  }`}
                >
                  <PersonAvatar name={label} />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[var(--foreground)]">
                      {label}
                    </p>
                    {subtitle ? (
                      <p className="truncate text-xs text-[var(--muted)]">{subtitle}</p>
                    ) : null}
                  </div>
                  {person.isPlayer || person.isTrainer ? (
                    <div className="flex flex-shrink-0 items-center gap-1">
                      {person.isPlayer ? (
                        <span className="sce-role-badge sce-role-badge-player">S</span>
                      ) : null}
                      {person.isTrainer ? (
                        <span className="sce-role-badge sce-role-badge-trainer">T</span>
                      ) : null}
                    </div>
                  ) : null}
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}
