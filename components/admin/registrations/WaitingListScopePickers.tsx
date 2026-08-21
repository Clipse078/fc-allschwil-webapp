"use client";

/**
 * WaitingListScopePickers — REG-WAIT-01D
 *
 * Human-readable OrgUnit and TeamSeason selectors for waiting-list scope UX.
 */

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import type { OrgUnitOption, TeamSeasonOption } from "@/lib/registrations/workflow-types";

function formatTeamSeasonLabel(option: TeamSeasonOption) {
  return `${option.teamName} · ${option.seasonName}`;
}

type SearchableSelectProps<T> = {
  options: T[];
  value: string;
  onChange: (value: string) => void;
  getOptionValue: (option: T) => string;
  getOptionLabel: (option: T) => string;
  getSearchText?: (option: T) => string;
  placeholder: string;
  emptyLabel: string;
  required?: boolean;
  disabled?: boolean;
};

function SearchableSelect<T>({
  options,
  value,
  onChange,
  getOptionValue,
  getOptionLabel,
  getSearchText,
  placeholder,
  emptyLabel,
  required = false,
  disabled = false,
}: SearchableSelectProps<T>) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return options;
    return options.filter((option) => {
      const haystack = (getSearchText ?? getOptionLabel)(option).toLowerCase();
      return haystack.includes(q);
    });
  }, [options, query, getOptionLabel, getSearchText]);

  return (
    <div className="space-y-2">
      <div className="relative">
        <Search className="absolute left-2.5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-[var(--muted)]" aria-hidden />
        <input
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Suchen…"
          disabled={disabled}
          className="fca-input h-8 w-full pl-8 text-xs"
        />
      </div>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        required={required}
        className="fca-select text-sm w-full"
      >
        <option value="">{placeholder}</option>
        {filtered.map((option) => (
          <option key={getOptionValue(option)} value={getOptionValue(option)}>
            {getOptionLabel(option)}
          </option>
        ))}
      </select>
      {options.length === 0 ? (
        <p className="text-xs italic text-[var(--muted)]">{emptyLabel}</p>
      ) : filtered.length === 0 ? (
        <p className="text-xs italic text-[var(--muted)]">Keine Treffer für die Suche.</p>
      ) : null}
    </div>
  );
}

export function OrgUnitScopePicker({
  orgUnits,
  value,
  onChange,
  disabled = false,
}: {
  orgUnits: OrgUnitOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}) {
  return (
    <SearchableSelect
      options={orgUnits}
      value={value}
      onChange={onChange}
      getOptionValue={(option) => option.id}
      getOptionLabel={(option) => option.name}
      getSearchText={(option) => `${option.name} ${option.key} ${option.type}`}
      placeholder="— Abteilung wählen —"
      emptyLabel="Keine Abteilungen für diesen Mandanten hinterlegt."
      required
      disabled={disabled}
    />
  );
}

export function TeamSeasonScopePicker({
  teamSeasons,
  value,
  onChange,
  disabled = false,
  placeholder = "— Team / Saison wählen —",
}: {
  teamSeasons: TeamSeasonOption[];
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
  placeholder?: string;
}) {
  return (
    <SearchableSelect
      options={teamSeasons}
      value={value}
      onChange={onChange}
      getOptionValue={(option) => option.id}
      getOptionLabel={formatTeamSeasonLabel}
      getSearchText={(option) => `${option.teamName} ${option.seasonName}`}
      placeholder={placeholder}
      emptyLabel="Keine Team-Saisons für diesen Mandanten verfügbar."
      required
      disabled={disabled}
    />
  );
}

export { formatTeamSeasonLabel };
