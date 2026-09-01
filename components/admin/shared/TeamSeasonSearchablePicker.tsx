"use client";

/**
 * TeamSeasonSearchablePicker — TRAINING-SERIES-PREMIUM-01
 *
 * Searchable, keyboard-friendly Team / Saison selector reused by
 * TrainingCenter creation. Pattern aligned with WaitingListScopePickers.
 */

import { useMemo, useState } from "react";
import { Search } from "lucide-react";

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

function formatOptionLabel(option: TeamSeasonPickerOption): string {
  return option.teamName;
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
  placeholder = "— Auswählen —",
  emptyLabel = "Kein Team verfügbar.",
  required = false,
  disabled = false,
  testId = "team-season-searchable-picker",
}: Props) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((option) => formatSearchText(option).toLowerCase().includes(q));
  }, [options, query]);

  const grouped = useMemo(() => {
    const buckets = new Map<string, TeamSeasonPickerOption[]>();
    for (const option of filtered) {
      const key = formatCategoryLabel(option.category) ?? "Teams";
      const bucket = buckets.get(key) ?? [];
      bucket.push(option);
      buckets.set(key, bucket);
    }
    return [...buckets.entries()];
  }, [filtered]);

  const selected = options.find((option) => option.id === value) ?? null;

  return (
    <div className="space-y-2" data-testid={testId}>
      <div className="relative">
        <Search
          className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted)]"
          aria-hidden
        />
        <input
          type="search"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          placeholder="Team suchen…"
          disabled={disabled || options.length === 0}
          className="fca-input h-8 w-full pl-8 text-xs"
          data-testid={`${testId}-search`}
        />
      </div>

      {options.length === 0 ? (
        <p className="text-xs italic text-[var(--muted)]">{emptyLabel}</p>
      ) : (
        <select
          value={value}
          onChange={(event) => onChange(event.target.value)}
          disabled={disabled}
          required={required}
          className="fca-select w-full text-sm"
          data-testid={`${testId}-select`}
        >
          <option value="">{placeholder}</option>
          {grouped.map(([groupLabel, groupOptions]) => (
            <optgroup key={groupLabel} label={groupLabel}>
              {groupOptions.map((option) => (
                <option key={option.id} value={option.id}>
                  {formatOptionLabel(option)} — {formatOptionMeta(option)}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      )}

      {selected ? (
        <p className="text-xs text-[var(--text-2)]" data-testid={`${testId}-selected-meta`}>
          {formatOptionMeta(selected)}
        </p>
      ) : null}

      {options.length > 0 && filtered.length === 0 ? (
        <p className="text-xs italic text-[var(--muted)]">Keine Treffer für die Suche.</p>
      ) : null}
    </div>
  );
}
