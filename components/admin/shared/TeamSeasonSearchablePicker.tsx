"use client";

/**
 * TeamSeasonSearchablePicker — TRAINING-CENTER-PREMIUM-02
 *
 * Single authoritative Team / Saison combobox for TrainingCenter creation.
 * Search, keyboard navigation, and selection in one control — no duplicate
 * native select underneath the search field.
 */

import { useCallback, useEffect, useId, useMemo, useRef, useState } from "react";
import { Check, ChevronDown, Search } from "lucide-react";
import { cn } from "@/lib/cn";

export type TeamSeasonPickerOption = {
  id: string;
  teamId: string;
  teamName: string;
  seasonName: string;
  category?: string;
  genderGroup?: string | null;
};

const CATEGORY_LABELS: Record<string, string> = {
  AKTIVE: "Aktive",
  FRAUEN: "Frauen",
  SENIOREN: "Senioren",
  TRAININGSGRUPPE: "Trainingsgruppe",
  JUNIOREN: "Junioren",
  JUNIORINNEN: "Juniorinnen",
};

function formatCategoryLabel(category: string | undefined): string | null {
  if (!category) return null;
  return CATEGORY_LABELS[category] ?? category;
}

function formatOptionMeta(option: TeamSeasonPickerOption): string {
  const categoryLabel = formatCategoryLabel(option.category);
  const parts = [categoryLabel, `Saison ${option.seasonName}`].filter(Boolean);
  return parts.join(" · ");
}

function formatSearchText(option: TeamSeasonPickerOption): string {
  return [option.teamName, option.seasonName, option.category, option.genderGroup]
    .filter(Boolean)
    .join(" ");
}

type FlatOption = TeamSeasonPickerOption & {
  groupLabel: string;
};

type Props = {
  options: TeamSeasonPickerOption[];
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  emptyLabel?: string;
  required?: boolean;
  disabled?: boolean;
  testId?: string;
};

export default function TeamSeasonSearchablePicker({
  options,
  value,
  onChange,
  placeholder = "Team / Saison auswählen…",
  emptyLabel = "Kein Team verfügbar.",
  required = false,
  disabled = false,
  testId = "team-season-searchable-picker",
}: Props) {
  const listboxId = useId();
  const containerRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState("");
  const [open, setOpen] = useState(false);
  const [highlightIndex, setHighlightIndex] = useState(0);

  const selected = options.find((option) => option.id === value) ?? null;

  const flatOptions = useMemo(() => {
    const q = query.trim().toLowerCase();
    const filtered = q
      ? options.filter((option) => formatSearchText(option).toLowerCase().includes(q))
      : options;

    const buckets = new Map<string, TeamSeasonPickerOption[]>();
    for (const option of filtered) {
      const key = formatCategoryLabel(option.category) ?? "Teams";
      const bucket = buckets.get(key) ?? [];
      bucket.push(option);
      buckets.set(key, bucket);
    }

    const flat: FlatOption[] = [];
    for (const [groupLabel, groupOptions] of buckets.entries()) {
      for (const option of groupOptions) {
        flat.push({ ...option, groupLabel });
      }
    }
    return flat;
  }, [options, query]);

  const selectOption = useCallback(
    (option: TeamSeasonPickerOption) => {
      onChange(option.id);
      setQuery("");
      setOpen(false);
      setHighlightIndex(0);
    },
    [onChange],
  );

  const clearSelection = useCallback(() => {
    onChange("");
    setQuery("");
    setOpen(true);
    requestAnimationFrame(() => inputRef.current?.focus());
  }, [onChange]);

  useEffect(() => {
    if (!open) return;
    const handlePointerDown = (event: MouseEvent) => {
      if (!containerRef.current?.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("mousedown", handlePointerDown);
    return () => document.removeEventListener("mousedown", handlePointerDown);
  }, [open]);

  useEffect(() => {
    if (highlightIndex >= flatOptions.length) {
      setHighlightIndex(Math.max(0, flatOptions.length - 1));
    }
  }, [flatOptions.length, highlightIndex]);

  const handleInputKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setOpen(true);
      setHighlightIndex((prev) => Math.min(prev + 1, Math.max(flatOptions.length - 1, 0)));
      return;
    }
    if (event.key === "ArrowUp") {
      event.preventDefault();
      setOpen(true);
      setHighlightIndex((prev) => Math.max(prev - 1, 0));
      return;
    }
    if (event.key === "Enter") {
      event.preventDefault();
      if (!open) {
        setOpen(true);
        return;
      }
      if (flatOptions[highlightIndex]) {
        selectOption(flatOptions[highlightIndex]);
      }
      return;
    }
    if (event.key === "Escape") {
      event.preventDefault();
      setOpen(false);
      return;
    }
    if (event.key === "Backspace" && selected && !query) {
      clearSelection();
    }
  };

  const showListbox = open && options.length > 0;
  let lastGroupLabel: string | null = null;

  return (
    <div ref={containerRef} className="space-y-2" data-testid={testId}>
      {selected && !open ? (
        <div
          className="flex items-start justify-between gap-2 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-3 py-2"
          data-testid={`${testId}-selected`}
        >
          <div className="min-w-0">
            <p className="text-sm font-semibold text-[var(--foreground)]">{selected.teamName}</p>
            <p className="text-xs text-[var(--text-2)]" data-testid={`${testId}-selected-meta`}>
              {formatOptionMeta(selected)}
            </p>
          </div>
          <button
            type="button"
            onClick={() => {
              setOpen(true);
              requestAnimationFrame(() => inputRef.current?.focus());
            }}
            disabled={disabled}
            className="shrink-0 text-xs font-medium text-[var(--sce-primary)] hover:underline"
            data-testid={`${testId}-change`}
          >
            Ändern
          </button>
        </div>
      ) : (
        <div className="relative">
          <Search
            className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted)]"
            aria-hidden
          />
          <input
            ref={inputRef}
            type="search"
            role="combobox"
            aria-expanded={showListbox}
            aria-controls={listboxId}
            aria-autocomplete="list"
            aria-required={required}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              setOpen(true);
              setHighlightIndex(0);
            }}
            onFocus={() => setOpen(true)}
            onClick={() => setOpen(true)}
            onKeyDown={handleInputKeyDown}
            placeholder={placeholder}
            disabled={disabled || options.length === 0}
            className="fca-input h-9 w-full pl-8 pr-8 text-sm"
            data-testid={`${testId}-search`}
          />
          <ChevronDown
            className="pointer-events-none absolute right-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted)]"
            aria-hidden
          />
        </div>
      )}

      {/* Hidden input for native form validation when required */}
      {required ? (
        <input
          type="text"
          tabIndex={-1}
          aria-hidden
          value={value}
          required
          onChange={() => {}}
          className="sr-only"
          data-testid={`${testId}-value`}
        />
      ) : null}

      {options.length === 0 ? (
        <p className="text-xs italic text-[var(--muted)]">{emptyLabel}</p>
      ) : null}

      {showListbox ? (
        <ul
          id={listboxId}
          role="listbox"
          className="max-h-56 overflow-y-auto rounded-lg border border-[var(--border)] bg-[var(--surface)] shadow-md"
          data-testid={`${testId}-listbox`}
        >
          {flatOptions.length === 0 ? (
            <li className="px-3 py-2 text-xs italic text-[var(--muted)]">Keine Treffer für die Suche.</li>
          ) : (
            flatOptions.map((option, index) => {
              const showGroupHeader = option.groupLabel !== lastGroupLabel;
              lastGroupLabel = option.groupLabel;
              const isHighlighted = index === highlightIndex;
              const isSelected = option.id === value;

              return (
                <li key={option.id} role="presentation">
                  {showGroupHeader ? (
                    <p className="px-3 pb-1 pt-2 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">
                      {option.groupLabel}
                    </p>
                  ) : null}
                  <button
                    type="button"
                    role="option"
                    aria-selected={isSelected}
                    onMouseEnter={() => setHighlightIndex(index)}
                    onClick={() => selectOption(option)}
                    className={cn(
                      "flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm transition-colors",
                      isHighlighted ? "bg-[var(--surface-2)]" : "hover:bg-[var(--surface-2)]",
                      isSelected && "font-medium text-[var(--sce-primary)]",
                    )}
                    data-testid={`${testId}-option-${option.id}`}
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-[var(--foreground)]">{option.teamName}</span>
                      <span className="block truncate text-xs text-[var(--text-2)]">{formatOptionMeta(option)}</span>
                    </span>
                    {isSelected ? <Check className="h-3.5 w-3.5 shrink-0" aria-hidden /> : null}
                  </button>
                </li>
              );
            })
          )}
        </ul>
      ) : null}

      {options.length > 0 && query && !open && flatOptions.length === 0 ? (
        <p className="text-xs italic text-[var(--muted)]">Keine Treffer für die Suche.</p>
      ) : null}
    </div>
  );
}
