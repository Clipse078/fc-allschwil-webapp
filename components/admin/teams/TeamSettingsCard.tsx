"use client";

import { useMemo, useState } from "react";
import AdminSurfaceCard from "@/components/admin/shared/AdminSurfaceCard";
import { getCurrentSwissFootballSeason } from "@/lib/seasons/season-logic";
import {
  getAllowedBirthYearsForSeason,
  getCanonicalSeasonLabel,
} from "@/lib/teams/jahrgang-rules";

type Team = {
  id: string;
  name: string;
  slug: string;
  category: string;
  genderGroup: string | null;
  ageGroup: string | null;
  sortOrder: number;
  isActive: boolean;
  websiteVisible: boolean;
  infoboardVisible: boolean;
  teamSeasons?: Array<{
    id: string;
    season: {
      id: string;
      key: string;
      name: string;
      startDate: string;
      endDate: string;
      isActive: boolean;
    };
  }>;
};

type Props = {
  team: Team;
  canManage: boolean;
  onSaved?: (team: Team) => void;
};

const CATEGORY_OPTIONS = [
  { value: "KINDERFUSSBALL", label: "Kinderfussball" },
  { value: "JUNIOREN", label: "Junioren" },
  { value: "AKTIVE", label: "Aktive" },
  { value: "FRAUEN", label: "Frauen" },
  { value: "SENIOREN", label: "Senioren" },
  { value: "TRAININGSGRUPPE", label: "Trainingsgruppe" },
];

const TEAM_STAGE_OPTIONS = [
  { value: "G", label: "G-Junioren" },
  { value: "F", label: "F-Junioren" },
  { value: "E", label: "E-Junioren" },
  { value: "D7", label: "D7-Junioren" },
  { value: "D9", label: "D9-Junioren" },
  { value: "C", label: "C-Junioren" },
  { value: "B", label: "B-Junioren" },
  { value: "A", label: "A-Junioren" },
];

function getCategoryLabel(category: string) {
  const option = CATEGORY_OPTIONS.find((entry) => entry.value === category);
  return option?.label ?? category;
}

export default function TeamSettingsCard({
  team,
  canManage,
  onSaved,
}: Props) {
  const [form, setForm] = useState<Team>(team);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const currentSeasonKey = useMemo(() => {
    return getCurrentSwissFootballSeason()?.key ?? null;
  }, []);

  const activeSeason = useMemo(() => {
    return (
      form.teamSeasons?.find((entry) => entry.season.key === currentSeasonKey) ??
      form.teamSeasons?.find((entry) => entry.season.isActive) ??
      form.teamSeasons?.[0] ??
      null
    );
  }, [form.teamSeasons, currentSeasonKey]);

  const saisonLabel = useMemo(() => {
    if (!activeSeason) {
      return null;
    }

    return (
      getCanonicalSeasonLabel(activeSeason.season.startDate) ??
      activeSeason.season.name
    );
  }, [activeSeason]);

  const jahrgaenge = useMemo(() => {
    if (!activeSeason) {
      return [];
    }

    return getAllowedBirthYearsForSeason(
      form.ageGroup,
      activeSeason.season.startDate
    );
  }, [form.ageGroup, activeSeason]);

  function updateField<K extends keyof Team>(field: K, value: Team[K]) {
    if (!canManage) {
      return;
    }

    setForm((current) => ({
      ...current,
      [field]: value,
    }));
  }

  async function handleSave() {
    if (!canManage) {
      return;
    }

    setSubmitting(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/teams/" + form.id, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: form.name,
          category: form.category,
          genderGroup: form.genderGroup,
          ageGroup: form.ageGroup,
          sortOrder: form.sortOrder,
          isActive: form.isActive,
          websiteVisible: form.websiteVisible,
          infoboardVisible: form.infoboardVisible,
        }),
      });

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error ?? "Team konnte nicht gespeichert werden.");
      }

      const updatedTeam = (data?.team as Team | undefined) ?? form;

      setForm((current) => ({
        ...current,
        ...updatedTeam,
      }));

      onSaved?.(updatedTeam);
      setMessage(data?.message ?? "Team erfolgreich gespeichert.");
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Ein Fehler ist aufgetreten."
      );
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <AdminSurfaceCard className="p-6">
      <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
        <div>
          <p className="fca-eyebrow">Team Details</p>
          <h3 className="fca-heading mt-2">{form.name}</h3>
          <p className="mt-3 text-sm text-slate-500">Slug: {form.slug}</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <span className="fca-pill">{getCategoryLabel(form.category)}</span>
          {form.ageGroup ? <span className="fca-pill">Stufe: {form.ageGroup}</span> : null}
          {saisonLabel ? <span className="fca-pill">Saison: {saisonLabel}</span> : null}
        </div>
      </div>

      {!canManage ? (
        <div className="fca-status-box fca-status-box-warn mt-5">
          Diese Teamdaten sind aktuell nur lesbar. Bearbeitung ist nur mit
          Team-Verwaltung erlaubt.
        </div>
      ) : null}

      {message ? (
        <div className="fca-status-box fca-status-box-success mt-5">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="fca-status-box fca-status-box-error mt-5">
          {error}
        </div>
      ) : null}

      <div className="mt-6 grid gap-4 md:grid-cols-2">
        <label className="block space-y-2">
          <span className="fca-label">Teamname</span>
          <input
            type="text"
            value={form.name}
            disabled={!canManage}
            onChange={(event) => updateField("name", event.target.value)}
            className="fca-input"
          />
        </label>

        <label className="block space-y-2">
          <span className="fca-label">Kategorie</span>
          <select
            value={form.category}
            disabled={!canManage}
            onChange={(event) => updateField("category", event.target.value)}
            className="fca-select"
          >
            {CATEGORY_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <label className="block space-y-2">
          <span className="fca-label">Geschlechtergruppe</span>
          <input
            type="text"
            value={form.genderGroup ?? ""}
            disabled={!canManage}
            onChange={(event) =>
              updateField("genderGroup", event.target.value || null)
            }
            className="fca-input"
            placeholder="z. B. Boys, Girls, Mixed"
          />
        </label>

        <label className="block space-y-2">
          <span className="fca-label">Teamstufe</span>
          <select
            value={form.ageGroup ?? ""}
            disabled={!canManage}
            onChange={(event) => updateField("ageGroup", event.target.value || null)}
            className="fca-select"
          >
            <option value="">Bitte wählen</option>
            {TEAM_STAGE_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </label>

        <div className="block space-y-2 md:col-span-2">
          <span className="fca-label">
            Jahrgänge {saisonLabel ? "für " + saisonLabel : "der aktuellen Saison"}
          </span>
          <div className="fca-section-card flex min-h-[62px] flex-wrap items-center gap-2 px-4 py-3">
            {jahrgaenge.length === 0 ? (
              <span className="fca-body-muted">
                Keine automatische Jahrgangslogik verfügbar. Bitte Teamstufe und Saison prüfen.
              </span>
            ) : (
              jahrgaenge.map((year) => (
                <span key={year} className="fca-pill-year">
                  {year}
                </span>
              ))
            )}
          </div>
        </div>

        <label className="block space-y-2 md:max-w-[220px]">
          <span className="fca-label">Sortierung</span>
          <input
            type="number"
            value={form.sortOrder}
            disabled={!canManage}
            onChange={(event) =>
              updateField("sortOrder", Number(event.target.value))
            }
            className="fca-input"
          />
        </label>
      </div>

      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <Toggle
          label="Aktiv"
          value={form.isActive}
          disabled={!canManage}
          onChange={(value) => updateField("isActive", value)}
        />

        <Toggle
          label="Website sichtbar"
          value={form.websiteVisible}
          disabled={!canManage}
          onChange={(value) => updateField("websiteVisible", value)}
        />

        <Toggle
          label="Infoboard sichtbar"
          value={form.infoboardVisible}
          disabled={!canManage}
          onChange={(value) => updateField("infoboardVisible", value)}
        />
      </div>

      {canManage ? (
        <div className="mt-6 flex items-center justify-end gap-3">
          <button
            type="button"
            onClick={handleSave}
            disabled={submitting}
            className="fca-button-primary"
          >
            {submitting ? "Speichern..." : "Team speichern"}
          </button>
        </div>
      ) : null}
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
