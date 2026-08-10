"use client";

/**
 * components/admin/tournamentcenter/ExternalClubPicker.tsx
 *
 * MASTERDATA-SELECTOR-CONSISTENCY-03 (BUG 2) — TournamentCenter-local
 * searchable Club Directory picker.
 *
 * Root cause of the truncated club list this replaces: both
 * TournamentCreateForm and TournamentParticipantsEditor eagerly fetched
 * `GET /api/club-directory/clubs` with NO `limit`/`search` query params on
 * mount, so every request silently landed on
 * lib/club-directory/query-service.ts's `CLUB_DIRECTORY_DEFAULT_LIMIT`
 * (50) — the first 50 canonical clubs in alphabetical order, full stop.
 * Every eligible club from roughly "FC Pratteln"/"FC Reinach" onward was
 * simply never in the fetched array, so the old native <select> couldn't
 * offer it no matter how it rendered its options.
 *
 * The fix is NOT "raise the default/limit to a bigger fixed number" (that
 * only moves the same cliff further out — see /dashboard/vereine, which
 * already passes `limit: 200` and would hit the exact same wall past 200
 * clubs). Instead this component never loads the full directory at all:
 * it searches the SAME canonical, tenant-scoped
 * `GET /api/club-directory/clubs?search=...` endpoint /dashboard/vereine's
 * client-side filter already reads its data from (never a second/duplicate
 * Club Directory query or registry), on-demand, per query — so however
 * large the directory grows, every eligible match for a given search term
 * is retrievable, not just whichever 50/200 happened to sort first.
 *
 * Interaction pattern deliberately mirrors the existing
 * components/shared/PeoplePicker.tsx (search-as-you-type, 300 ms debounce,
 * 2-char minimum, keyboard nav, selected chip) instead of introducing a new
 * generic combobox framework — this is the "smallest existing searchable
 * picker pattern already available in the repo", adapted for
 * ExternalClub instead of Person.
 */

import { useEffect, useId, useRef, useState } from "react";
import { Building2, Loader2, Search, X } from "lucide-react";

export type ExternalClubPickerResult = {
  id: string;
  name: string;
  shortName: string | null;
};

export type ExternalClubPickerProps = {
  /** Currently selected club — renders a chip instead of the search input. */
  selected: ExternalClubPickerResult | null;
  /** Called when a club is picked from the results dropdown. */
  onSelect: (club: ExternalClubPickerResult) => void;
  /** Called when the user clears the chip (deselect, so the search input reappears). */
  onClearSelected?: () => void;
  placeholder?: string;
  disabled?: boolean;
  /** Stable identifier prefix for data-testid hooks. */
  testId?: string;
};

const SEARCH_MIN_CHARS = 2;
const SEARCH_DEBOUNCE_MS = 300;

/**
 * Passed explicitly as `limit` on every search request so this picker never
 * silently inherits GET /api/club-directory/clubs's un-searched default
 * (CLUB_DIRECTORY_DEFAULT_LIMIT = 50) — the exact defect this component
 * fixes. 200 is the endpoint's existing accepted maximum (the same value
 * /dashboard/vereine already requests); combined with a real `search` term
 * narrowing the match set at the database level, this is not "the cap that
 * hides valid matches" the way an un-searched full-directory fetch was —
 * a single tenant's Club Directory realistically never has 200+ distinct
 * clubs matching one 2+ character search term.
 */
const SEARCH_RESULT_LIMIT = 200;

function getClubLabel(club: ExternalClubPickerResult): string {
  return club.name;
}

function ClubAvatar() {
  return (
    <div
      aria-hidden
      className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full border border-slate-200 bg-gradient-to-br from-white to-slate-100 text-[var(--sce-info)]"
    >
      <Building2 className="h-4 w-4" />
    </div>
  );
}

export function ExternalClubPicker({
  selected,
  onSelect,
  onClearSelected,
  placeholder = "Verein suchen…",
  disabled = false,
  testId,
}: ExternalClubPickerProps) {
  const instanceId = useId();
  const listboxId = `external-club-picker-listbox-${instanceId}`;

  const [query, setQuery] = useState("");
  const [results, setResults] = useState<ExternalClubPickerResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [open, setOpen] = useState(false);
  const [focusedIndex, setFocusedIndex] = useState(0);

  const inputRef = useRef<HTMLInputElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  useEffect(() => {
    clearTimeout(debounceRef.current);
    setError(null);

    if (query.trim().length < SEARCH_MIN_CHARS) {
      setResults([]);
      setOpen(false);
      return;
    }

    debounceRef.current = setTimeout(async () => {
      setLoading(true);
      try {
        const params = new URLSearchParams({
          search: query.trim(),
          limit: String(SEARCH_RESULT_LIMIT),
        });
        const res = await fetch(`/api/club-directory/clubs?${params.toString()}`, {
          cache: "no-store",
        });
        const data = (await res.json().catch(() => null)) as
          | { clubs?: ExternalClubPickerResult[]; error?: string }
          | null;
        if (!res.ok) throw new Error(data?.error ?? "Vereinssuche fehlgeschlagen.");

        const clubs = Array.isArray(data?.clubs) ? data.clubs : [];
        setResults(clubs);
        // Only "open" the dropdown when there is something to show — a
        // zero-result search must surface the "Keine Vereine gefunden"
        // state below instead of an empty, still-"open" dropdown.
        setOpen(clubs.length > 0);
        setFocusedIndex(0);
      } catch (err) {
        setError(err instanceof Error ? err.message : "Fehler bei der Suche.");
        setResults([]);
        setOpen(false);
      } finally {
        setLoading(false);
      }
    }, SEARCH_DEBOUNCE_MS);

    return () => clearTimeout(debounceRef.current);
  }, [query]);

  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    }
    document.addEventListener("mousedown", handleOutside);
    return () => document.removeEventListener("mousedown", handleOutside);
  }, []);

  function handleSelect(club: ExternalClubPickerResult) {
    onSelect(club);
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
    <div ref={containerRef} className="relative w-full" data-testid={testId}>
      {selected ? (
        <div className="flex items-center gap-3 rounded-[var(--radius-lg)] border border-[var(--border-strong)] bg-[var(--surface-2)] px-3 py-2.5">
          <ClubAvatar />
          <div className="min-w-0 flex-1">
            <p className="truncate text-sm font-semibold text-[var(--foreground)]">
              {getClubLabel(selected)}
            </p>
            {selected.shortName ? (
              <p className="truncate text-xs text-[var(--muted)]">{selected.shortName}</p>
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
              data-testid={testId ? `${testId}-clear` : undefined}
            >
              <X className="h-3.5 w-3.5" />
            </button>
          ) : null}
        </div>
      ) : (
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
            aria-controls={listboxId}
            role="combobox"
            data-testid={testId ? `${testId}-input` : undefined}
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

      {!selected && !loading && query.length > 0 && query.length < SEARCH_MIN_CHARS ? (
        <p className="mt-1.5 text-[11px] text-[var(--muted)]">Mindestens 2 Zeichen eingeben.</p>
      ) : null}

      {error ? <p className="mt-1.5 text-xs text-rose-600">{error}</p> : null}

      {!loading && !error && !open && query.trim().length >= SEARCH_MIN_CHARS && results.length === 0 ? (
        <p className="mt-1.5 text-xs italic text-[var(--muted)]" data-testid={testId ? `${testId}-no-results` : undefined}>
          Keine Vereine gefunden.
        </p>
      ) : null}

      {open && results.length > 0 ? (
        <ul
          id={listboxId}
          role="listbox"
          className="absolute left-0 right-0 top-full z-50 mt-1.5 max-h-64 overflow-y-auto rounded-[var(--radius-xl)] border border-[var(--border-strong)] bg-[var(--surface)] py-1 shadow-[var(--shadow-lg)]"
          data-testid={testId ? `${testId}-results` : undefined}
        >
          {results.map((club, index) => {
            const isFocused = index === focusedIndex;
            return (
              <li key={club.id} role="option" aria-selected={isFocused}>
                <button
                  type="button"
                  onMouseDown={(e) => {
                    // Prevent input blur before click registers.
                    e.preventDefault();
                    handleSelect(club);
                  }}
                  onMouseEnter={() => setFocusedIndex(index)}
                  data-testid={testId ? `${testId}-option-${club.id}` : undefined}
                  className={`flex w-full items-center gap-3 px-4 py-2.5 text-left transition-colors${
                    isFocused ? " bg-[var(--surface-2)]" : " hover:bg-[var(--surface-2)]"
                  }`}
                >
                  <Building2 className="h-4 w-4 flex-shrink-0 text-[var(--sce-info)]" aria-hidden />
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-[var(--foreground)]">{club.name}</p>
                    {club.shortName ? (
                      <p className="truncate text-xs text-[var(--muted)]">{club.shortName}</p>
                    ) : null}
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      ) : null}
    </div>
  );
}

export default ExternalClubPicker;
