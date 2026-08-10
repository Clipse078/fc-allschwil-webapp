"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { SectionCard } from "@/components/ui/page";

type OrgUnitOption = {
  id: string;
  name: string;
  key: string;
  type: string;
};

type ProviderMappingInfo = {
  provider: string;
  teamName: string | null;
  isActive: boolean;
  lastSyncedAt: string;
} | null;

type CompetitionInfo = {
  id: string;
  name: string | null;
  shortName: string | null;
} | null;

type CompetitionOption = {
  id: string;
  officialName: string;
  shortName: string | null;
};

type Team = {
  id: string;
  name: string;
  // TEAM-IDENTITY-01: tenant-owned SHORT NAME / ALTERNATIVE NAME.
  // Optional. Never written by provider sync.
  shortName: string | null;
  alternativeName: string | null;
  slug: string;
  category: string;
  genderGroup: string | null;
  ageGroup: string | null;
  sortOrder: number;
  isActive: boolean;
  websiteVisible: boolean;
  infoboardVisible: boolean;
  orgUnitId: string | null;
  // TEAM-IDENTITY-01: read-only provider identity/name. Never edited here.
  providerMapping?: ProviderMappingInfo;
  // TEAMCENTER-UX-01B/C: Liga/Wettbewerb, sourced strictly from the
  // canonical TeamSeasonCompetition -> Competition relation of the current
  // season. Editable below via its own dedicated save action (competitionId
  // lives on TeamSeason, not Team — see currentTeamSeasonId).
  competition?: CompetitionInfo;
};

type Props = {
  team: Team;
  availableOrgUnits: OrgUnitOption[];
  availableCompetitions: CompetitionOption[];
  /**
   * The canonical current-season TeamSeason id (lib/teams/current-season.ts).
   * Null when this Team has no TeamSeason in the canonical current season —
   * competition editing is disabled in that case (TEAMCENTER-UX-01C: never
   * target a stale/historical TeamSeason from this surface).
   */
  currentTeamSeasonId: string | null;
  /** participationType of the current-season TeamSeason, if any. */
  currentParticipationType: string | null;
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

// TEAMCENTER-UX-01B (E): Geschlechtergruppe is a String column with no DB
// enum (see prisma/schema.prisma Team.genderGroup). Rather than add a
// migration purely for UX, this is a controlled dropdown over the values
// already observed in the domain (seed data / registration flow: "Mixed",
// "Men"), extended with the Boys/Girls/Women distinctions the Teams module
// otherwise implies (Junioren/Frauen categories). Any pre-existing stored
// value that isn't in this list is preserved and injected as an extra
// option so it never silently disappears or gets overwritten on save.
const GENDER_GROUP_OPTIONS = ["Boys", "Girls", "Mixed", "Men", "Women"];

const fieldClass =
  "w-full rounded-[12px] border border-[var(--border)] bg-white px-3.5 py-2.5 text-sm text-[var(--foreground)] placeholder-[var(--muted)] focus:outline-none focus:ring-2 focus:ring-[var(--blue)]/30 disabled:bg-[var(--surface-2)] disabled:text-[var(--muted)] disabled:cursor-not-allowed";
const labelClass = "block text-[12px] font-semibold uppercase tracking-[0.06em] text-[var(--muted)] mb-1.5";

function FormSection({
  title,
  description,
  children,
}: {
  title: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="border-t border-[var(--border)] pt-5 first:border-t-0 first:pt-0">
      <h4 className="text-sm font-semibold text-[var(--foreground)]">{title}</h4>
      {description && (
        <p className="mt-0.5 text-xs text-[var(--text-2)]">{description}</p>
      )}
      <div className="mt-4 grid gap-4 md:grid-cols-2">{children}</div>
    </div>
  );
}

export default function TeamSettingsCard({
  team,
  availableOrgUnits,
  availableCompetitions,
  currentTeamSeasonId,
  currentParticipationType,
  canManage,
  onSaved,
}: Props) {
  const router = useRouter();
  const [form, setForm] = useState<Team>(team);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const [competitionId, setCompetitionId] = useState<string>(team.competition?.id ?? "");
  const [competitionSaving, setCompetitionSaving] = useState(false);
  const [competitionMessage, setCompetitionMessage] = useState<string | null>(null);
  const [competitionError, setCompetitionError] = useState<string | null>(null);

  const genderGroupOptions =
    form.genderGroup && !GENDER_GROUP_OPTIONS.includes(form.genderGroup)
      ? [form.genderGroup, ...GENDER_GROUP_OPTIONS]
      : GENDER_GROUP_OPTIONS;

  const competitionLabel =
    form.competition?.shortName ?? form.competition?.name ?? null;

  const isCompetitionTeamSeason = currentParticipationType === "COMPETITION";

  async function handleCompetitionChange(nextCompetitionId: string) {
    if (!canManage || !currentTeamSeasonId) {
      return;
    }

    const previousCompetitionId = competitionId;
    setCompetitionId(nextCompetitionId);
    setCompetitionSaving(true);
    setCompetitionMessage(null);
    setCompetitionError(null);

    try {
      const response = await fetch(
        `/api/teams/${form.id}/team-seasons/${currentTeamSeasonId}/competition`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ competitionId: nextCompetitionId || null }),
        },
      );

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error ?? "Wettbewerb konnte nicht zugeordnet werden.");
      }

      setCompetitionMessage(data?.message ?? "Wettbewerb erfolgreich gespeichert.");
      router.refresh();
    } catch (err) {
      setCompetitionId(previousCompetitionId);
      setCompetitionError(
        err instanceof Error ? err.message : "Ein Fehler ist aufgetreten.",
      );
    } finally {
      setCompetitionSaving(false);
    }
  }

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
          shortName: form.shortName,
          alternativeName: form.alternativeName,
          category: form.category,
          genderGroup: form.genderGroup,
          // TEAMCENTER-UX-01B (F): Teamstufe (ageGroup) is no longer editable
          // in this UX — its stored value is preserved as-is, never cleared
          // or overwritten by a settings save.
          ageGroup: form.ageGroup,
          sortOrder: form.sortOrder,
          isActive: form.isActive,
          websiteVisible: form.websiteVisible,
          infoboardVisible: form.infoboardVisible,
          orgUnitId: form.orgUnitId,
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
    <SectionCard
      title="Team-Einstellungen"
      description={`Slug: ${form.slug}`}
    >
      {!canManage ? (
        <div className="fca-status-box fca-status-box-warn mb-5">
          Diese Teamdaten sind aktuell nur lesbar. Bearbeitung ist nur mit
          Team-Verwaltung erlaubt.
        </div>
      ) : null}

      {message ? (
        <div className="fca-status-box fca-status-box-success mb-5">
          {message}
        </div>
      ) : null}

      {error ? (
        <div className="fca-status-box fca-status-box-error mb-5">
          {error}
        </div>
      ) : null}

      <div className="space-y-5">
        <FormSection
          title="Identität"
          description="Gehört dem Verein — wird nie durch eine Verbandsanbindung (z. B. SFV) überschrieben."
        >
          <label className="block space-y-1.5">
            <span className={labelClass}>Langname</span>
            <input
              type="text"
              value={form.name}
              disabled={!canManage}
              onChange={(event) => updateField("name", event.target.value)}
              className={fieldClass}
              placeholder="z. B. FC Allschwil Junioren B2"
            />
          </label>

          <label className="block space-y-1.5">
            <span className={labelClass}>Kurzname</span>
            <input
              type="text"
              value={form.shortName ?? ""}
              disabled={!canManage}
              onChange={(event) =>
                updateField("shortName", event.target.value || null)
              }
              className={fieldClass}
              placeholder="z. B. B2"
            />
          </label>

          <label className="block space-y-1.5 md:col-span-2">
            <span className={labelClass}>Alternativname</span>
            <input
              type="text"
              value={form.alternativeName ?? ""}
              disabled={!canManage}
              onChange={(event) =>
                updateField("alternativeName", event.target.value || null)
              }
              className={fieldClass}
              placeholder="z. B. Junioren B2"
            />
          </label>
        </FormSection>

        <FormSection title="Klassifikation">
          <label className="block space-y-1.5">
            <span className={labelClass}>Kategorie</span>
            <select
              value={form.category}
              disabled={!canManage}
              onChange={(event) => updateField("category", event.target.value)}
              className={fieldClass}
            >
              {CATEGORY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1.5">
            <span className={labelClass}>Geschlechtergruppe</span>
            <select
              value={form.genderGroup ?? ""}
              disabled={!canManage}
              onChange={(event) =>
                updateField("genderGroup", event.target.value || null)
              }
              className={fieldClass}
            >
              <option value="">— keine Angabe —</option>
              {genderGroupOptions.map((option) => (
                <option key={option} value={option}>
                  {option}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-1.5 md:max-w-[220px]">
            <span className={labelClass}>Sortierung</span>
            <input
              type="number"
              value={form.sortOrder}
              disabled={!canManage}
              onChange={(event) =>
                updateField("sortOrder", Number(event.target.value))
              }
              className={fieldClass}
            />
          </label>
        </FormSection>

        <FormSection title="Organisation">
          <label className="block space-y-1.5 md:col-span-2">
            <span className={labelClass}>Organisationseinheit</span>
            <select
              value={form.orgUnitId ?? ""}
              disabled={!canManage}
              onChange={(event) =>
                updateField("orgUnitId", event.target.value || null)
              }
              className={fieldClass}
            >
              <option value="">— keine Verknüpfung —</option>
              {availableOrgUnits.map((ou) => (
                <option key={ou.id} value={ou.id}>
                  {ou.name} ({ou.key})
                </option>
              ))}
            </select>
            <p className="text-xs text-[var(--muted)]">
              Optionale Verknüpfung mit einer Organisationseinheit des aktiven Mandanten.
            </p>
          </label>
        </FormSection>

        {/* TEAMCENTER-UX-01B/C: Liga/Wettbewerb — strictly sourced from
            TeamSeasonCompetition -> Competition of the current season. Never
            a fabricated/manual duplicate field; saved via its own dedicated
            action (lib/teams/team-season-service.ts#setTeamSeasonCompetition)
            since it lives on TeamSeason, not Team. */}
        <FormSection
          title="Wettbewerb"
          description={
            !currentTeamSeasonId
              ? "Keine aktuelle Saison — Wettbewerb kann erst nach Saisonzuordnung gepflegt werden."
              : !isCompetitionTeamSeason
                ? "Nur für Wettkampfteams verfügbar (Teilnahmetyp der aktuellen Saison)."
                : undefined
          }
        >
          <div className="md:col-span-2 space-y-1.5">
            <span className={labelClass}>Liga / Wettkampf</span>
            {canManage && currentTeamSeasonId && isCompetitionTeamSeason ? (
              <>
                <select
                  value={competitionId}
                  disabled={competitionSaving}
                  onChange={(event) => handleCompetitionChange(event.target.value)}
                  className={fieldClass}
                >
                  <option value="">— Kein Wettbewerb —</option>
                  {availableCompetitions.map((competitionOption) => (
                    <option key={competitionOption.id} value={competitionOption.id}>
                      {competitionOption.shortName ?? competitionOption.officialName}
                    </option>
                  ))}
                </select>
                {competitionMessage ? (
                  <p className="text-xs font-medium text-emerald-600">{competitionMessage}</p>
                ) : null}
                {competitionError ? (
                  <p className="text-xs font-medium text-[var(--sce-danger)]">{competitionError}</p>
                ) : null}
              </>
            ) : (
              <p className="text-sm text-[var(--foreground)]">
                {competitionLabel ?? (
                  <span className="text-[var(--muted)]">Kein Wettbewerb</span>
                )}
              </p>
            )}
          </div>
        </FormSection>

        <FormSection title="Sichtbarkeit">
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
        </FormSection>
      </div>

      {/* TEAM-IDENTITY-01: provider identity is read-only and clearly separate
          from the tenant-owned naming fields above. Never editable here —
          providerTeamName is refreshed exclusively by provider sync /
          the provider-mapping workflow. */}
      {form.providerMapping ? (
        <div className="mt-5 rounded-[12px] border border-[var(--border)] bg-[var(--surface-2)] p-4">
          <p className="text-xs font-semibold uppercase tracking-[0.06em] text-[var(--muted)]">
            Anbieter (nur lesbar)
          </p>
          <div className="mt-3 grid gap-3 md:grid-cols-2">
            <div>
              <span className={labelClass}>Anbieter</span>
              <span className="text-sm font-semibold text-[var(--foreground)]">
                {form.providerMapping.provider}
              </span>
            </div>
            <div>
              <span className={labelClass}>Anbieter-Teamname</span>
              <span className="text-sm text-[var(--text-2)]">
                {form.providerMapping.teamName ?? "—"}
              </span>
            </div>
          </div>
          <p className="mt-3 text-xs text-[var(--muted)]">
            Diese Angaben stammen aus der Synchronisation und werden hier nicht
            bearbeitet. Sie überschreiben nie Langname, Kurzname oder
            Alternativname.
          </p>
        </div>
      ) : null}

      {canManage ? (
        <div className="mt-5 flex items-center justify-end gap-3">
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
    </SectionCard>
  );
}

/**
 * Compact ON/OFF toggle switch (TEAMCENTER-UX-01B, letter G).
 *
 * Replaces the previous raw checkbox presentation with a proper switch
 * control. Same underlying boolean field + onChange contract — no new
 * publication architecture.
 */
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
    <div className="flex items-center justify-between gap-3 rounded-[12px] border border-[var(--border)] bg-white px-3.5 py-2.5">
      <span className="text-sm font-medium text-[var(--foreground)]">{label}</span>
      <button
        type="button"
        role="switch"
        aria-checked={value}
        aria-label={label}
        disabled={disabled}
        onClick={() => onChange(!value)}
        className={`relative inline-flex h-6 w-11 flex-shrink-0 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-[var(--blue)]/30 disabled:cursor-not-allowed disabled:opacity-50 ${
          value ? "bg-emerald-500" : "bg-[var(--border-strong)]"
        }`}
      >
        <span
          className={`inline-block h-4.5 w-4.5 transform rounded-full bg-white shadow transition-transform ${
            value ? "translate-x-[22px]" : "translate-x-[3px]"
          }`}
        />
      </button>
    </div>
  );
}
