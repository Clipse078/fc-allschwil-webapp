"use client";

import { useMemo, useState, useTransition } from "react";
import { Save } from "lucide-react";

type TeamDisplaySettingsItem = {
  teamId: string;
  teamName: string;
  teamSeasonId: string;
  seasonName: string;
  teamPageWebsiteVisible: boolean;
  squadWebsiteVisible: boolean;
  trainerTeamWebsiteVisible: boolean;
  trainingsWebsiteVisible: boolean;
  upcomingMatchesWebsiteVisible: boolean;
  resultsWebsiteVisible: boolean;
  standingsWebsiteVisible: boolean;
};

type Props = {
  teams: TeamDisplaySettingsItem[];
};

type VisibilityKey =
  | "teamPageWebsiteVisible"
  | "squadWebsiteVisible"
  | "trainerTeamWebsiteVisible"
  | "trainingsWebsiteVisible"
  | "upcomingMatchesWebsiteVisible"
  | "resultsWebsiteVisible"
  | "standingsWebsiteVisible";

const columns: Array<{ key: VisibilityKey; label: string }> = [
  { key: "teamPageWebsiteVisible", label: "Seite" },
  { key: "squadWebsiteVisible", label: "Kader" },
  { key: "trainerTeamWebsiteVisible", label: "Trainer" },
  { key: "trainingsWebsiteVisible", label: "Training" },
  { key: "upcomingMatchesWebsiteVisible", label: "Spiele" },
  { key: "resultsWebsiteVisible", label: "Resultate" },
  { key: "standingsWebsiteVisible", label: "Rangliste" },
];

function ToggleCell({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <button
      type="button"
      onClick={() => onChange(!checked)}
      className={`relative h-6 w-11 rounded-full transition ${
        checked ? "bg-[#0b4aa2]" : "bg-slate-300"
      }`}
      aria-pressed={checked}
    >
      <span
        className={`absolute top-1 h-4 w-4 rounded-full bg-white shadow transition ${
          checked ? "left-6" : "left-1"
        }`}
      />
    </button>
  );
}

export default function TeamDisplaySettingsEditor({ teams }: Props) {
  const [items, setItems] = useState(teams);
  const [savedSnapshot, setSavedSnapshot] = useState(teams);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  const dirtyItems = useMemo(() => {
    return items.filter((item) => {
      const saved = savedSnapshot.find((candidate) => candidate.teamSeasonId === item.teamSeasonId);
      if (!saved) return true;

      return columns.some((column) => saved[column.key] !== item[column.key]);
    });
  }, [items, savedSnapshot]);

  function updateValue(teamSeasonId: string, key: VisibilityKey, value: boolean) {
    setItems((current) =>
      current.map((item) =>
        item.teamSeasonId === teamSeasonId
          ? {
              ...item,
              [key]: value,
            }
          : item
      )
    );
    setMessage(null);
  }

  function saveAll() {
    if (dirtyItems.length === 0) return;

    setMessage(null);

    startTransition(async () => {
      try {
        await Promise.all(
          dirtyItems.map(async (item) => {
            const response = await fetch(`/api/team-seasons/${item.teamSeasonId}/website-visibility`, {
              method: "PATCH",
              headers: {
                "Content-Type": "application/json",
              },
              body: JSON.stringify({
                teamId: item.teamId,
                teamPageWebsiteVisible: item.teamPageWebsiteVisible,
                squadWebsiteVisible: item.squadWebsiteVisible,
                trainerTeamWebsiteVisible: item.trainerTeamWebsiteVisible,
                trainingsWebsiteVisible: item.trainingsWebsiteVisible,
                upcomingMatchesWebsiteVisible: item.upcomingMatchesWebsiteVisible,
                resultsWebsiteVisible: item.resultsWebsiteVisible,
                standingsWebsiteVisible: item.standingsWebsiteVisible,
              }),
            });

            const payload = await response.json().catch(() => null);

            if (!response.ok) {
              throw new Error(payload?.error ?? `${item.teamName} konnte nicht gespeichert werden.`);
            }
          })
        );

        setSavedSnapshot(items);
        setMessage(`✅ ${dirtyItems.length} Änderung${dirtyItems.length === 1 ? "" : "en"} gespeichert.`);
      } catch (error) {
        setMessage(error instanceof Error ? `❌ ${error.message}` : "❌ Anzeige konnte nicht gespeichert werden.");
      }
    });
  }

  if (items.length === 0) {
    return (
      <div className="mt-5 rounded-[24px] border border-slate-200 bg-slate-50 p-5 text-sm font-bold text-slate-500">
        Keine Teams für die aktive Saison gefunden.
      </div>
    );
  }

  return (
    <div className="mt-5 space-y-4">
      <div className="flex flex-col gap-3 rounded-[24px] border border-slate-200 bg-slate-50 p-4 lg:flex-row lg:items-center lg:justify-between">
        <div>
          <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">
            Saison {items[0]?.seasonName}
          </p>
          <p className="mt-1 text-sm font-bold text-slate-700">
            {items.length} Teams · {dirtyItems.length} offen
          </p>
        </div>

        <button
          type="button"
          onClick={saveAll}
          disabled={isPending || dirtyItems.length === 0}
          className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-red-200 bg-white px-5 text-sm font-black text-red-600 shadow-sm transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
        >
          <Save className="h-4 w-4" />
          {isPending ? "Speichert..." : "Alle speichern"}
        </button>
      </div>

      <div className="overflow-x-auto rounded-[24px] border border-slate-200 bg-white">
        <div className="grid min-w-[820px] grid-cols-[minmax(130px,1.2fr)_repeat(7,minmax(68px,0.65fr))] border-b border-slate-200 bg-slate-50 px-4 py-3 text-xs font-black uppercase tracking-[0.1em] text-slate-400">
          <div>Team</div>
          {columns.map((column) => (
            <div key={column.key} className="text-center">
              {column.label}
            </div>
          ))}
        </div>

        <div className="divide-y divide-slate-100">
          {items.map((team) => (
            <div
              key={team.teamSeasonId}
              className="grid min-w-[820px] grid-cols-[minmax(130px,1.2fr)_repeat(7,minmax(68px,0.65fr))] items-center px-4 py-3"
            >
              <div>
                <p className="font-black text-slate-900">{team.teamName}</p>
                <p className="mt-1 text-[11px] font-bold uppercase tracking-[0.1em] text-slate-400">
                  Website / Mobile
                </p>
              </div>

              {columns.map((column) => (
                <div key={column.key} className="flex justify-center">
                  <ToggleCell
                    checked={team[column.key]}
                    onChange={(value) => updateValue(team.teamSeasonId, column.key, value)}
                  />
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {message ? (
        <div className="rounded-[22px] border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700">
          {message}
        </div>
      ) : null}
    </div>
  );
}