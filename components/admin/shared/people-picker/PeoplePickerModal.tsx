"use client";

import { X } from "lucide-react";
import { useEffect, useState } from "react";

type Mode = "trainer" | "player";

type Person = {
  id: string;
  name: string;
  functionLabel?: string;
  teamLabel?: string;
  currentTeam?: string | null;
  isInThisTeam?: boolean;
  imageUrl?: string | null;
};

type Props = {
  open: boolean;
  onClose: () => void;
  mode: Mode;
  teamId?: string;
  teamSeasonId?: string;
  onAssigned?: () => void;

  // NEW SYSTEM PROPS
  title?: string;
  placeholder?: string;
  excludeIds?: string[];
  onSelect?: (person: Person) => Promise<void> | void;
};

export default function PeoplePickerModal({
  open,
  onClose,
  mode,
  teamId,
  teamSeasonId,
  onAssigned,
  title,
  placeholder,
  excludeIds,
  onSelect,
}: Props) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Person[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;

    const timeout = setTimeout(async () => {
      setLoading(true);
      try {
        const res = await fetch(
          `/api/people/search?mode=${mode}&teamSeasonId=${teamSeasonId}&q=${encodeURIComponent(query)}`
        );
        let data: Person[] = await res.json();

        // Exclude already selected
        if (excludeIds?.length) {
          data = data.filter((p) => !excludeIds.includes(p.id));
        }

        setResults(data || []);
      } catch {
        setResults([]);
      } finally {
        setLoading(false);
      }
    }, 250);

    return () => clearTimeout(timeout);
  }, [query, open, mode, teamSeasonId, excludeIds]);

  const handleAssign = async (person: Person, disabled?: boolean) => {
    if (disabled) return;

    // Custom override
    if (onSelect) {
      await onSelect(person);
      onAssigned?.();
      onClose();
      return;
    }

    // Default team assignment flow
    if (!teamId || !teamSeasonId) return;

    const endpoint =
      mode === "trainer"
        ? `/api/teams/${teamId}/team-seasons/${teamSeasonId}/trainer-members`
        : `/api/teams/${teamId}/team-seasons/${teamSeasonId}/squad-members`;

    await fetch(endpoint, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ personId: person.id }),
    });

    onAssigned?.();
    onClose();
  };

  useEffect(() => {
    if (!open) return;

    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center bg-black/40 backdrop-blur-sm pt-32" onMouseDown={onClose}>
      <div className="w-full max-w-xl rounded-2xl bg-white shadow-2xl p-4" onMouseDown={(event) => event.stopPropagation()}>
        <div className="mb-3 flex justify-end">
          <button type="button" onClick={onClose} className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 hover:bg-slate-50 hover:text-slate-900" aria-label="Schliessen">
            <X className="h-4 w-4" />
          </button>
        </div>

        {title && (
          <div className="text-sm font-medium text-gray-600 mb-2 px-1">
            {title}
          </div>
        )}

        <input
          autoFocus
          placeholder={
            placeholder ||
            (mode === "trainer"
              ? "Trainer suchen..."
              : "Spieler suchen...")
          }
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          className="w-full rounded-xl border border-gray-200 px-4 py-3 outline-none focus:ring-2 focus:ring-red-200"
        />

        <div className="mt-4 max-h-80 overflow-y-auto">
          {loading && (
            <div className="text-sm text-gray-400 px-2 py-2">Suche...</div>
          )}

          {!loading && results.length === 0 && (
            <div className="text-sm text-gray-400 px-2 py-2">
              Keine Ergebnisse
            </div>
          )}

          {!loading &&
            results.map((p) => {
              const isSameTeam = p.isInThisTeam;

              return (
                <button
                  key={p.id}
                  onClick={() => handleAssign(p, isSameTeam)}
                  disabled={isSameTeam}
                  className={`w-full text-left px-3 py-3 rounded-xl transition ${
                    isSameTeam
                      ? "opacity-60 cursor-not-allowed"
                      : "hover:bg-red-50"
                  }`}
                >
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <div className="w-9 h-9 rounded-full bg-gray-200 overflow-hidden">
                        {p.imageUrl && (
                          <img
                            src={p.imageUrl}
                            alt={p.name}
                            className="w-full h-full object-cover"
                          />
                        )}
                      </div>

                      <div>
                        <div className="font-medium">{p.name}</div>
                        <div className="text-xs text-gray-400">
                          {p.functionLabel || ""}{" "}
                          {p.teamLabel ? "• " + p.teamLabel : ""}
                        </div>
                      </div>
                    </div>

                    {isSameTeam ? (
                      <div className="text-[10px] px-2 py-1 rounded-full bg-green-100 text-green-700">
                        Bereits im Team
                      </div>
                    ) : p.currentTeam ? (
                      <div className="text-[10px] px-2 py-1 rounded-full bg-amber-100 text-amber-700">
                        {p.currentTeam}
                      </div>
                    ) : null}
                  </div>
                </button>
              );
            })}
        </div>
      </div>
    </div>
  );
}

