"use client";

import { useState, useTransition } from "react";
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

const visibilityOptions: Array<{ key: VisibilityKey; label: string }> = [
  { key: "teamPageWebsiteVisible", label: "Teamseite" },
  { key: "squadWebsiteVisible", label: "Kader" },
  { key: "trainerTeamWebsiteVisible", label: "Trainer" },
  { key: "trainingsWebsiteVisible", label: "Trainingszeiten" },
  { key: "upcomingMatchesWebsiteVisible", label: "Spiele" },
  { key: "resultsWebsiteVisible", label: "Resultate" },
  { key: "standingsWebsiteVisible", label: "Rangliste" },
];

export default function TeamDisplaySettingsEditor({ teams }: Props) {
  const [items, setItems] = useState(teams);
  const [savingId, setSavingId] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

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
  }

  function saveItem(teamSeasonId: string) {
    const item = items.find((candidate) => candidate.teamSeasonId === teamSeasonId);
    if (!item) return;

    setSavingId(teamSeasonId);
    setMessage(null);

    startTransition(async () => {
      try {
        const response = await fetch(`/api/team-seasons/${teamSeasonId}/website-visibility`, {
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
          throw new Error(payload?.error ?? "Anzeige konnte nicht gespeichert werden.");
        }

        setMessage(`✅ ${item.teamName} gespeichert.`);
      } catch (error) {
        setMessage(error instanceof Error ? `❌ ${error.message}` : "❌ Anzeige konnte nicht gespeichert werden.");
      } finally {
        setSavingId(null);
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
    <div className="mt-5 space-y-3">
      {items.map((team) => (
        <div key={team.teamSeasonId} className="rounded-[24px] border border-slate-200 bg-slate-50 p-5">
          <div className="flex flex-col gap-4 xl:flex-row xl:items-center xl:justify-between">
            <div className="min-w-[180px]">
              <p className="text-xs font-black uppercase tracking-[0.12em] text-slate-400">{team.seasonName}</p>
              <h3 className="mt-1 font-black text-slate-900">{team.teamName}</h3>
            </div>

            <div className="grid flex-1 gap-2 sm:grid-cols-2 lg:grid-cols-4">
              {visibilityOptions.map((option) => (
                <label
                  key={option.key}
                  className="flex h-11 items-center justify-between gap-3 rounded-2xl border border-slate-200 bg-white px-3 text-xs font-black text-slate-600"
                >
                  <span>{option.label}</span>
                  <input
                    type="checkbox"
                    checked={team[option.key]}
                    onChange={(event) => updateValue(team.teamSeasonId, option.key, event.target.checked)}
                    className="h-4 w-4 accent-[#0b4aa2]"
                  />
                </label>
              ))}
            </div>

            <button
              type="button"
              onClick={() => saveItem(team.teamSeasonId)}
              disabled={isPending || savingId === team.teamSeasonId}
              className="inline-flex h-11 items-center justify-center gap-2 rounded-full border border-red-200 bg-white px-5 text-sm font-black text-red-600 shadow-sm transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
            >
              <Save className="h-4 w-4" />
              {savingId === team.teamSeasonId ? "Speichert..." : "Speichern"}
            </button>
          </div>
        </div>
      ))}

      {message ? (
        <div className="rounded-[22px] border border-slate-200 bg-white px-4 py-3 text-sm font-black text-slate-700">
          {message}
        </div>
      ) : null}
    </div>
  );
}