"use client";

import { useMemo, useState, useTransition } from "react";
import { useRouter } from "next/navigation";

type TeamSeasonStatus = "ACTIVE" | "INACTIVE" | "ARCHIVED";

type TeamSeasonSnapshot = {
  displayName: string;
  shortName: string;
  status: TeamSeasonStatus;
  websiteVisible: boolean;
  infoboardVisible: boolean;
};

type TeamSeasonEditFormProps = {
  teamId: string;
  canManage: boolean;
  teamSeason: {
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
      isActive: boolean;
    };
  };
  onSaved?: (updatedTeamSeason: {
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
      isActive: boolean;
    };
  }) => void;
};

function createSnapshot(
  teamSeason: TeamSeasonEditFormProps["teamSeason"],
): TeamSeasonSnapshot {
  return {
    displayName: teamSeason.displayName,
    shortName: teamSeason.shortName ?? "",
    status: teamSeason.status,
    websiteVisible: teamSeason.websiteVisible,
    infoboardVisible: teamSeason.infoboardVisible,
  };
}

export default function TeamSeasonEditForm({
  teamId,
  canManage,
  teamSeason,
  onSaved,
}: TeamSeasonEditFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const baseSnapshot = useMemo(() => createSnapshot(teamSeason), [teamSeason]);

  const [displayName, setDisplayName] = useState(baseSnapshot.displayName);
  const [shortName, setShortName] = useState(baseSnapshot.shortName);
  const [status, setStatus] = useState<TeamSeasonStatus>(baseSnapshot.status);
  const [websiteVisible, setWebsiteVisible] = useState(baseSnapshot.websiteVisible);
  const [infoboardVisible, setInfoboardVisible] = useState(baseSnapshot.infoboardVisible);

  const [savedSnapshot, setSavedSnapshot] = useState<TeamSeasonSnapshot>(baseSnapshot);

  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const hasServerChange = useMemo(() => {
    return (
      baseSnapshot.displayName !== savedSnapshot.displayName ||
      baseSnapshot.shortName !== savedSnapshot.shortName ||
      baseSnapshot.status !== savedSnapshot.status ||
      baseSnapshot.websiteVisible !== savedSnapshot.websiteVisible ||
      baseSnapshot.infoboardVisible !== savedSnapshot.infoboardVisible
    );
  }, [baseSnapshot, savedSnapshot]);

  const effectiveSnapshot = hasServerChange ? baseSnapshot : savedSnapshot;

  const hasUnsavedChanges = useMemo(() => {
    return (
      displayName !== effectiveSnapshot.displayName ||
      shortName !== effectiveSnapshot.shortName ||
      status !== effectiveSnapshot.status ||
      websiteVisible !== effectiveSnapshot.websiteVisible ||
      infoboardVisible !== effectiveSnapshot.infoboardVisible
    );
  }, [
    displayName,
    shortName,
    status,
    websiteVisible,
    infoboardVisible,
    effectiveSnapshot,
  ]);

  function handleReset() {
    setDisplayName(effectiveSnapshot.displayName);
    setShortName(effectiveSnapshot.shortName);
    setStatus(effectiveSnapshot.status);
    setWebsiteVisible(effectiveSnapshot.websiteVisible);
    setInfoboardVisible(effectiveSnapshot.infoboardVisible);
    setError(null);
    setSuccess(null);
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canManage) {
      setError("Keine Berechtigung zum Bearbeiten.");
      setSuccess(null);
      return;
    }

    setError(null);
    setSuccess(null);

    const payload = {
      displayName: displayName.trim(),
      shortName: shortName.trim(),
      status,
      websiteVisible,
      infoboardVisible,
    };

    const response = await fetch(
      "/api/teams/" + teamId + "/team-seasons/" + teamSeason.id,
      {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(payload),
      },
    );

    let data: {
      error?: string;
      message?: string;
      teamSeason?: TeamSeasonEditFormProps["teamSeason"];
    } | null = null;

    try {
      data = await response.json();
    } catch {
      data = null;
    }

    if (!response.ok) {
      setError(data?.error ?? "Team-Saison konnte nicht gespeichert werden.");
      setSuccess(null);
      return;
    }

    if (data?.teamSeason) {
      const nextSnapshot = createSnapshot(data.teamSeason);

      setDisplayName(nextSnapshot.displayName);
      setShortName(nextSnapshot.shortName);
      setStatus(nextSnapshot.status);
      setWebsiteVisible(nextSnapshot.websiteVisible);
      setInfoboardVisible(nextSnapshot.infoboardVisible);
      setSavedSnapshot(nextSnapshot);
      onSaved?.(data.teamSeason);
    }

    setSuccess(data?.message ?? "Team-Saison erfolgreich gespeichert.");

    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[28px] border border-slate-200 bg-white p-5 shadow-sm"
    >
      <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
        <div>
          <p className="text-xs uppercase tracking-[0.18em] text-red-600">
            Saison-Eintrag
          </p>
          <h3 className="mt-2 text-lg font-bold text-slate-900">
            {teamSeason.season.name}
          </h3>
          <p className="mt-1 text-sm text-slate-500">{teamSeason.season.key}</p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {hasUnsavedChanges ? (
            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
              Ungespeicherte Aenderungen
            </span>
          ) : (
            <span className="rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600">
              Synchronisiert
            </span>
          )}

          {!canManage ? (
            <span className="rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-medium text-amber-800">
              Nur lesen
            </span>
          ) : null}
        </div>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <label className="block space-y-2 md:col-span-2">
          <span className="text-sm font-medium text-slate-700">Display Name</span>
          <input
            type="text"
            value={displayName}
            onChange={(event) => setDisplayName(event.target.value)}
            disabled={!canManage || isPending}
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-red-300 disabled:bg-slate-50"
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">Short Name</span>
          <input
            type="text"
            value={shortName}
            onChange={(event) => setShortName(event.target.value)}
            disabled={!canManage || isPending}
            className="w-full rounded-2xl border border-slate-200 px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-red-300 disabled:bg-slate-50"
          />
        </label>

        <label className="block space-y-2">
          <span className="text-sm font-medium text-slate-700">Status</span>
          <select
            value={status}
            onChange={(event) => setStatus(event.target.value as TeamSeasonStatus)}
            disabled={!canManage || isPending}
            className="w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-900 outline-none transition focus:border-red-300 disabled:bg-slate-50"
          >
            <option value="ACTIVE">Aktiv</option>
            <option value="INACTIVE">Inaktiv</option>
            <option value="ARCHIVED">Archiviert</option>
          </select>
        </label>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <Toggle
          label="Website sichtbar"
          value={websiteVisible}
          disabled={!canManage || isPending}
          onChange={setWebsiteVisible}
        />

        <Toggle
          label="Infoboard sichtbar"
          value={infoboardVisible}
          disabled={!canManage || isPending}
          onChange={setInfoboardVisible}
        />
      </div>

      {error ? (
        <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      {success ? (
        <div className="mt-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {success}
        </div>
      ) : null}

      {canManage ? (
        <div className="mt-5 flex flex-wrap justify-end gap-3">
          <button
            type="button"
            onClick={handleReset}
            disabled={isPending || !hasUnsavedChanges}
            className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Zuruecksetzen
          </button>

          <button
            type="submit"
            disabled={isPending || !hasUnsavedChanges}
            className="rounded-full border border-red-200 bg-white px-5 py-2.5 text-sm font-semibold text-red-600 transition hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {isPending ? "Speichern..." : "Speichern"}
          </button>
        </div>
      ) : null}
    </form>
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
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between rounded-2xl border border-slate-200 px-4 py-3">
      <span className="text-sm font-medium text-slate-700">{label}</span>
      <input
        type="checkbox"
        checked={value}
        disabled={disabled}
        onChange={(event) => onChange(event.target.checked)}
        className="h-5 w-5 accent-red-600 disabled:opacity-50"
      />
    </div>
  );
}
