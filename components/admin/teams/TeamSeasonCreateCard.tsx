"use client";

import { useEffect, useMemo, useState } from "react";
import AdminSurfaceCard from "@/components/admin/shared/AdminSurfaceCard";

type TeamSeasonStatus = "ACTIVE" | "INACTIVE" | "ARCHIVED";

type TeamSeasonItem = {
  id: string;
  season: {
    id: string;
  };
};

type SeasonOption = {
  id: string;
  key: string;
  name: string;
  isActive: boolean;
  startDate: Date | string;
  endDate: Date | string;
};

type CreatedTeamSeason = {
  id: string;
  displayName: string;
  shortName: string | null;
  status: TeamSeasonStatus;
  websiteVisible: boolean;
  infoboardVisible: boolean;
  season: {
    id: string;
    key: string;
    name: string;
    startDate: string;
    endDate: string;
    isActive: boolean;
  };
};

type Props = {
  teamId: string;
  teamName: string;
  canManage: boolean;
  availableSeasons: SeasonOption[];
  existingTeamSeasons: TeamSeasonItem[];
  onCreated?: (createdTeamSeason: CreatedTeamSeason) => void;
};

const TEAM_SEASON_STATUS_OPTIONS: Array<{
  value: TeamSeasonStatus;
  label: string;
}> = [
  { value: "ACTIVE", label: "Aktiv" },
  { value: "INACTIVE", label: "Inaktiv" },
  { value: "ARCHIVED", label: "Archiviert" },
];

export default function TeamSeasonCreateCard({
  teamId,
  teamName,
  canManage,
  availableSeasons,
  existingTeamSeasons,
  onCreated,
}: Props) {
  const [seasonFormSubmitting, setSeasonFormSubmitting] = useState(false);
  const [seasonFormError, setSeasonFormError] = useState<string | null>(null);
  const [seasonFormMessage, setSeasonFormMessage] = useState<string | null>(null);

  const [selectedSeasonId, setSelectedSeasonId] = useState("");
  const [seasonDisplayName, setSeasonDisplayName] = useState("");
  const [seasonShortName, setSeasonShortName] = useState("");
  const [seasonStatus, setSeasonStatus] = useState<TeamSeasonStatus>("ACTIVE");
  const [seasonWebsiteVisible, setSeasonWebsiteVisible] = useState(true);
  const [seasonInfoboardVisible, setSeasonInfoboardVisible] = useState(true);

  const selectableSeasons = useMemo(() => {
    const usedSeasonIds = new Set(existingTeamSeasons.map((entry) => entry.season.id));
    return (availableSeasons ?? []).filter((season) => !usedSeasonIds.has(season.id));
  }, [availableSeasons, existingTeamSeasons]);

  useEffect(() => {
    const activeSeason =
      selectableSeasons.find((season) => season.isActive) ??
      selectableSeasons[0] ??
      null;

    setSelectedSeasonId((current) => {
      if (current && selectableSeasons.some((season) => season.id === current)) {
        return current;
      }

      return activeSeason?.id ?? "";
    });
  }, [selectableSeasons]);

  useEffect(() => {
    setSeasonDisplayName((current) =>
      current ? current : "FC Allschwil " + teamName
    );
    setSeasonShortName((current) => (current ? current : teamName));
  }, [teamName]);

  async function handleCreateTeamSeason() {
    if (!canManage) {
      return;
    }

    setSeasonFormSubmitting(true);
    setSeasonFormError(null);
    setSeasonFormMessage(null);

    try {
      const response = await fetch("/api/teams/" + teamId + "/team-seasons", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          seasonId: selectedSeasonId,
          displayName: seasonDisplayName,
          shortName: seasonShortName || null,
          status: seasonStatus,
          websiteVisible: seasonWebsiteVisible,
          infoboardVisible: seasonInfoboardVisible,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error ?? "Team-Saison konnte nicht erstellt werden.");
      }

      const createdEntry = data?.teamSeason as CreatedTeamSeason | undefined;

      if (createdEntry) {
        onCreated?.(createdEntry);
      }

      setSeasonFormMessage(data?.message ?? "Team-Saison erfolgreich erstellt.");
      setSeasonDisplayName("FC Allschwil " + teamName);
      setSeasonShortName(teamName);
      setSeasonStatus("ACTIVE");
      setSeasonWebsiteVisible(true);
      setSeasonInfoboardVisible(true);

      const nextSelectableSeasons = selectableSeasons.filter(
        (season) => season.id !== selectedSeasonId
      );

      const nextSeason =
        nextSelectableSeasons.find((season) => season.isActive) ??
        nextSelectableSeasons[0] ??
        null;

      setSelectedSeasonId(nextSeason?.id ?? "");
    } catch (err) {
      setSeasonFormError(
        err instanceof Error ? err.message : "Ein Fehler ist aufgetreten."
      );
    } finally {
      setSeasonFormSubmitting(false);
    }
  }

  return (
    <AdminSurfaceCard className="p-6">
      <div>
        <p className="fca-eyebrow">Saison Verwaltung</p>
        <h3 className="fca-subheading mt-2">Team-Saison hinzufügen</h3>
        <p className="mt-3 text-sm text-slate-600">
          Lege einen weiteren Saison-Eintrag für dieses Team an.
        </p>
      </div>

      {!canManage ? (
        <div className="fca-status-box fca-status-box-warn mt-4">
          Nur Benutzer mit Team-Verwaltung dürfen Team-Saisons anlegen.
        </div>
      ) : selectableSeasons.length === 0 ? (
        <div className="fca-status-box fca-status-box-muted mt-4">
          Es sind keine weiteren verfügbaren Saisons mehr übrig.
        </div>
      ) : (
        <div className="mt-6 space-y-5">
          {seasonFormError ? (
            <div className="fca-status-box fca-status-box-error">
              {seasonFormError}
            </div>
          ) : null}

          {seasonFormMessage ? (
            <div className="fca-status-box fca-status-box-success">
              {seasonFormMessage}
            </div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-2">
            <label className="block space-y-2">
              <span className="fca-label">Saison</span>
              <select
                value={selectedSeasonId}
                onChange={(event) => setSelectedSeasonId(event.target.value)}
                className="fca-select"
              >
                <option value="">Bitte wählen</option>
                {selectableSeasons.map((season) => (
                  <option key={season.id} value={season.id}>
                    {season.name}
                    {season.isActive ? " (aktiv)" : ""}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-2">
              <span className="fca-label">Status</span>
              <select
                value={seasonStatus}
                onChange={(event) =>
                  setSeasonStatus(event.target.value as TeamSeasonStatus)
                }
                className="fca-select"
              >
                {TEAM_SEASON_STATUS_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </label>

            <label className="block space-y-2">
              <span className="fca-label">Display Name</span>
              <input
                type="text"
                value={seasonDisplayName}
                onChange={(event) => setSeasonDisplayName(event.target.value)}
                className="fca-input"
              />
            </label>

            <label className="block space-y-2">
              <span className="fca-label">Short Name</span>
              <input
                type="text"
                value={seasonShortName}
                onChange={(event) => setSeasonShortName(event.target.value)}
                className="fca-input"
              />
            </label>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            <Toggle
              label="Website sichtbar"
              value={seasonWebsiteVisible}
              disabled={false}
              onChange={setSeasonWebsiteVisible}
            />

            <Toggle
              label="Infoboard sichtbar"
              value={seasonInfoboardVisible}
              disabled={false}
              onChange={setSeasonInfoboardVisible}
            />
          </div>

          <div className="flex items-center gap-3">
            <button
              type="button"
              onClick={handleCreateTeamSeason}
              disabled={seasonFormSubmitting || !selectedSeasonId}
              className="fca-button-primary"
            >
              {seasonFormSubmitting ? "Erstellen..." : "Team-Saison erstellen"}
            </button>
          </div>
        </div>
      )}
    </AdminSurfaceCard>
  );
}

function Toggle({
  label,
  value,
  disabled,
  onChange,
}: {
  label: string;
  value: boolean;
  disabled: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div className="fca-toggle-row">
      <span className="fca-label">{label}</span>
      <input
        type="checkbox"
        checked={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="fca-toggle-checkbox disabled:opacity-50"
      />
    </div>
  );
}
