"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import AdminAvatar from "@/components/admin/shared/AdminAvatar";

export type PeoplePickerPerson = {
  // BACKWARD COMPATIBILITY
  firstName?: string;
  lastName?: string;
  id: string;
  displayName: string;
  email?: string | null;
  phone?: string | null;
  imageSrc?: string | null;
  functionLabel?: string | null;
  teamLabel?: string | null;
  dateOfBirth?: string | null;
  isPlayer?: boolean;
  isTrainer?: boolean;

  // NEW
  playerSuggestion?: {
    tone: "PERFECT" | "YOUNGER_ALLOWED" | "NOT_MATCHING" | "UNKNOWN";
    label: string;
    sortRank: number;
  } | null;
  ratingScore?: number | null;
  ratingLabel?: string | null;
};

type PeoplePickerProps = {
  mode?: "single" | "multiple";
  selected?: PeoplePickerPerson | null;
  selectedItems?: PeoplePickerPerson[];
  onSelect?: (person: PeoplePickerPerson | null) => void;
  onChange?: (people: PeoplePickerPerson[]) => void;
  placeholder?: string;
  searchMode?: "any" | "player" | "trainer" | "vereinsleitung";
  emptyText?: string;
  teamSeasonId?: string;
  disabled?: boolean;
};

export default function PeoplePicker({
  selected,
  onSelect,
  placeholder = "Suchen...",
  searchMode = "any",
  teamSeasonId,
}: PeoplePickerProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<PeoplePickerPerson[]>([]);
  const [open, setOpen] = useState(false);

  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (query.length < 2) return;

    const timeout = setTimeout(async () => {
      const params = new URLSearchParams();
      params.set("q", query);
      params.set("mode", searchMode);
      if (teamSeasonId) params.set("teamSeasonId", teamSeasonId);

      const res = await fetch("/api/people/search?" + params.toString());
      const data = await res.json();
      setResults(data);
      setOpen(true);
    }, 200);

    return () => clearTimeout(timeout);
  }, [query, searchMode, teamSeasonId]);

  function getSuggestionStyle(tone?: string) {
    switch (tone) {
      case "PERFECT":
        return "bg-emerald-50 text-emerald-700 border-emerald-200";
      case "YOUNGER_ALLOWED":
        return "bg-amber-50 text-amber-700 border-amber-200";
      case "NOT_MATCHING":
        return "bg-rose-50 text-rose-700 border-rose-200";
      default:
        return "bg-slate-50 text-slate-500 border-slate-200";
    }
  }

  return (
    <div className="relative">
      <input
        ref={inputRef}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={placeholder}
        className="w-full rounded-xl border px-4 py-3"
      />

      {open && results.length > 0 && (
        <div className="absolute mt-2 w-full rounded-xl border bg-white shadow-xl">
          {results.map((p) => (
            <button
              key={p.id}
              onClick={() => {
                onSelect?.(p);
                setOpen(false);
                setQuery("");
              }}
              className="flex w-full items-center justify-between px-4 py-3 hover:bg-slate-50"
            >
              <div className="flex items-center gap-3">
                <AdminAvatar name={p.displayName} imageSrc={p.imageSrc} size="sm" />
                <div>
                  <div className="font-semibold">{p.displayName}</div>
                  <div className="text-xs text-slate-500">
                    {p.teamLabel || p.email}
                  </div>
                </div>
              </div>

              {searchMode === "player" && p.ratingLabel && (
                <span className="text-[10px] px-2 py-1 rounded-full border font-semibold bg-blue-50 text-blue-700 border-blue-200">
                  {p.ratingLabel} · {p.ratingScore ?? 50}
                </span>
              )}

              {searchMode === "player" && p.playerSuggestion && (
                <span
                  className={`text-[10px] px-2 py-1 rounded-full border font-semibold ${getSuggestionStyle(
                    p.playerSuggestion.tone
                  )}`}
                >
                  {p.playerSuggestion.label}
                </span>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}








