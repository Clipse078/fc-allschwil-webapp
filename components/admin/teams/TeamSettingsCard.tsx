"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { SectionCard } from "@/components/ui/page";
import { SwitchToggle } from "@/components/ui/SwitchToggle";
import { resolveInfoboardTeamDisplayName } from "@/lib/publishing/presentation/infoboard-team-display-name";

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
  id: string | null;
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
  infoboardDisplayName: string | null;
  infoboardTrainingDisplayName: string | null;
  infoboardMatchDisplayName: string | null;
  infoboardTournamentDisplayName: string | null;
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
   * competition/orgUnit editing is disabled in that case (TEAMCENTER-UX-01C).
   */
  currentTeamSeasonId: string | null;
  /** participationType of the current-season TeamSeason, if any. */
  currentParticipationType: string | null;
  /**
   * TEAM-SEASON-ORGUNIT-01: primary OrgUnit of the current-season TeamSeason.
   * Null when no primary OrgUnit is assigned for the current season.
   */
  currentSeasonOrgUnit: OrgUnitOption | null;
  currentSeasonPublication: {
    seasonName: string;
    showNextMatch: boolean;
    showNextTournament: boolean;
  } | null;
  canManage: boolean;
  onSaved?: (team: Team) => void;
  onCancelEdit?: () => void;
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
  currentSeasonOrgUnit,
  currentSeasonPublication,
  canManage,
  onSaved,
  onCancelEdit,
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

  // TEAM-SEASON-ORGUNIT-01: season-scoped OrgUnit state (separate save action).
  const [seasonOrgUnitId, setSeasonOrgUnitId] = useState<string>(currentSeasonOrgUnit?.id ?? "");
  const [seasonOrgUnitSaving, setSeasonOrgUnitSaving] = useState(false);
  const [seasonOrgUnitMessage, setSeasonOrgUnitMessage] = useState<string | null>(null);
  const [seasonOrgUnitError, setSeasonOrgUnitError] = useState<string | null>(null);

  const [showNextMatch, setShowNextMatch] = useState(
    currentSeasonPublication?.showNextMatch ?? true,
  );
  const [showNextTournament, setShowNextTournament] = useState(
    currentSeasonPublication?.showNextTournament ?? false,
  );

  useEffect(() => {
    setShowNextMatch(currentSeasonPublication?.showNextMatch ?? true);
    setShowNextTournament(
      currentSeasonPublication?.showNextTournament ?? false,
    );
  }, [currentTeamSeasonId, currentSeasonPublication]);

  const genderGroupOptions =
    form.genderGroup && !GENDER_GROUP_OPTIONS.includes(form.genderGroup)
      ? [form.genderGroup, ...GENDER_GROUP_OPTIONS]
      : GENDER_GROUP_OPTIONS;

  const competitionLabel =
    form.competition?.shortName ?? form.competition?.name ?? null;

  const effectiveTrainingDisplayName = resolveInfoboardTeamDisplayName(
    {
      infoboardTrainingDisplayName: form.infoboardTrainingDisplayName,
      infoboardDisplayName: form.infoboardDisplayName,
      alternativeName: form.alternativeName,
      shortName: form.shortName,
      name: form.name,
    },
    "TRAINING",
  );
  const effectiveMatchDisplayName = resolveInfoboardTeamDisplayName(
    {
      infoboardMatchDisplayName: form.infoboardMatchDisplayName,
      infoboardDisplayName: form.infoboardDisplayName,
      alternativeName: form.alternativeName,
      shortName: form.shortName,
      name: form.name,
    },
    "MATCH",
  );
  const effectiveTournamentDisplayName = resolveInfoboardTeamDisplayName(
    {
      infoboardTournamentDisplayName: form.infoboardTournamentDisplayName,
      infoboardDisplayName: form.infoboardDisplayName,
      alternativeName: form.alternativeName,
      shortName: form.shortName,
      name: form.name,
    },
    "TOURNAMENT",
  );

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

  async function handleSeasonOrgUnitChange(nextOrgUnitId: string) {
    if (!canManage || !currentTeamSeasonId) {
      return;
    }

    const previousOrgUnitId = seasonOrgUnitId;
    setSeasonOrgUnitId(nextOrgUnitId);
    setSeasonOrgUnitSaving(true);
    setSeasonOrgUnitMessage(null);
    setSeasonOrgUnitError(null);

    try {
      const response = await fetch(
        `/api/teams/${form.id}/team-seasons/${currentTeamSeasonId}/org-units`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orgUnitId: nextOrgUnitId || null }),
        },
      );

      const data = await response.json().catch(() => null);

      if (!response.ok) {
        throw new Error(data?.error ?? "Organisationseinheit konnte nicht gespeichert werden.");
      }

      setSeasonOrgUnitMessage(data?.message ?? "Organisationseinheit erfolgreich gespeichert.");
      router.refresh();
    } catch (err) {
      setSeasonOrgUnitId(previousOrgUnitId);
      setSeasonOrgUnitError(
        err instanceof Error ? err.message : "Ein Fehler ist aufgetreten.",
      );
    } finally {
      setSeasonOrgUnitSaving(false);
    }
  }

  function updatePublicationField(
    field: "showNextMatch" | "showNextTournament",
    nextValue: boolean,
  ) {
    if (!canManage || !currentSeasonPublication) {
      return;
    }

    if (field === "showNextMatch") {
      setShowNextMatch(nextValue);
      return;
    }

    setShowNextTournament(nextValue);
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
      if (isTeamDirty) {
        const response = await fetch("/api/teams/" + form.id, {
          method: "PATCH",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            name: form.name,
            shortName: form.shortName,
            alternativeName: form.alternativeName,
            infoboardDisplayName: form.infoboardDisplayName,
            infoboardTrainingDisplayName: form.infoboardTrainingDisplayName,
            infoboardMatchDisplayName: form.infoboardMatchDisplayName,
            infoboardTournamentDisplayName: form.infoboardTournamentDisplayName,
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
      }

      if (isPublicationDirty && currentTeamSeasonId && currentSeasonPublication) {
        const publicationBody: {
          showNextMatch?: boolean;
          showNextTournament?: boolean;
        } = {};

        if (showNextMatch !== currentSeasonPublication.showNextMatch) {
          publicationBody.showNextMatch = showNextMatch;
        }
        if (showNextTournament !== currentSeasonPublication.showNextTournament) {
          publicationBody.showNextTournament = showNextTournament;
        }

        const publicationResponse = await fetch(
          `/api/teams/${form.id}/team-seasons/${currentTeamSeasonId}/publication`,
          {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(publicationBody),
          },
        );
        const publicationData = await publicationResponse.json().catch(() => null);

        if (!publicationResponse.ok) {
          throw new Error(
            publicationData?.error ??
              "Website-Veröffentlichung konnte nicht gespeichert werden.",
          );
        }
      }

      router.refresh();
      setMessage(
        isPublicationDirty && !isTeamDirty
          ? "Website-Veröffentlichung wurde gespeichert."
          : "Team erfolgreich gespeichert.",
      );
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Ein Fehler ist aufgetreten."
      );
    } finally {
      setSubmitting(false);
    }
  }

  const isTeamDirty =
    form.name !== team.name ||
    form.shortName !== team.shortName ||
    form.alternativeName !== team.alternativeName ||
    form.infoboardDisplayName !== team.infoboardDisplayName ||
    form.infoboardTrainingDisplayName !== team.infoboardTrainingDisplayName ||
    form.infoboardMatchDisplayName !== team.infoboardMatchDisplayName ||
    form.infoboardTournamentDisplayName !== team.infoboardTournamentDisplayName ||
    form.category !== team.category ||
    form.genderGroup !== team.genderGroup ||
    form.sortOrder !== team.sortOrder;

  const isPublicationDirty =
    currentSeasonPublication !== null &&
    (showNextMatch !== currentSeasonPublication.showNextMatch ||
      showNextTournament !== currentSeasonPublication.showNextTournament);

  const isDirty = isTeamDirty || isPublicationDirty;

  return (
    <SectionCard
      title="Team-Einstellungen"
      description={`Slug: ${form.slug}`}
    >
      {canManage ? (
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3">
          <p className="text-sm text-[var(--text-2)]">
            {isDirty ? "Änderungen noch nicht gespeichert." : "Teamdaten bearbeiten."}
          </p>
          <div className="flex flex-wrap items-center gap-2">
            {onCancelEdit ? (
              <button
                type="button"
                onClick={onCancelEdit}
                className="rounded-lg border border-[var(--border-strong)] bg-[var(--surface)] px-3.5 py-2 text-sm font-semibold text-[var(--text-2)] transition hover:bg-[var(--surface-2)]"
              >
                Abbrechen
              </button>
            ) : null}
            <button
              type="button"
              onClick={handleSave}
              disabled={submitting || !isDirty}
              className="fca-button-primary"
            >
              {submitting ? "Speichern..." : "Team speichern"}
            </button>
          </div>
        </div>
      ) : null}

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

        <FormSection
          title="Infoboard-Anzeigenamen"
          description="Optionale Namen für die Anzeige auf dem Infoboard. Der allgemeine Anzeigename gilt als Fallback für Training, Match und Turnier, sofern kein spezifischer Name gesetzt ist."
        >
          <label className="block space-y-1.5 md:col-span-2">
            <span className={labelClass}>Allgemein</span>
            <input
              type="text"
              value={form.infoboardDisplayName ?? ""}
              disabled={!canManage}
              maxLength={120}
              onChange={(event) =>
                updateField("infoboardDisplayName", event.target.value || null)
              }
              className={fieldClass}
              placeholder="z. B. FCA E1"
            />
            <p className="text-xs text-[var(--text-2)]">
              Allgemeiner Infoboard-Fallback. Wenn leer, verwendet SCE
              automatisch den alternativen Anzeigenamen, Kurznamen oder
              Teamnamen.
            </p>
          </label>

          <label className="block space-y-1.5">
            <span className={labelClass}>Training</span>
            <input
              type="text"
              value={form.infoboardTrainingDisplayName ?? ""}
              disabled={!canManage}
              maxLength={120}
              onChange={(event) =>
                updateField("infoboardTrainingDisplayName", event.target.value || null)
              }
              className={fieldClass}
              placeholder="z. B. Junioren E1"
            />
            {effectiveTrainingDisplayName ? (
              <p className="text-xs font-medium text-[var(--foreground)]">
                Effektive Training-Anzeige: {effectiveTrainingDisplayName}
              </p>
            ) : null}
          </label>

          <label className="block space-y-1.5">
            <span className={labelClass}>Match</span>
            <input
              type="text"
              value={form.infoboardMatchDisplayName ?? ""}
              disabled={!canManage}
              maxLength={120}
              onChange={(event) =>
                updateField("infoboardMatchDisplayName", event.target.value || null)
              }
              className={fieldClass}
              placeholder="z. B. FC Allschwil E1"
            />
            {effectiveMatchDisplayName ? (
              <p className="text-xs font-medium text-[var(--foreground)]">
                Effektive Match-Anzeige: {effectiveMatchDisplayName}
              </p>
            ) : null}
          </label>

          <label className="block space-y-1.5">
            <span className={labelClass}>Turnier</span>
            <input
              type="text"
              value={form.infoboardTournamentDisplayName ?? ""}
              disabled={!canManage}
              maxLength={120}
              onChange={(event) =>
                updateField("infoboardTournamentDisplayName", event.target.value || null)
              }
              className={fieldClass}
              placeholder="z. B. FCA E1"
            />
            {effectiveTournamentDisplayName ? (
              <p className="text-xs font-medium text-[var(--foreground)]">
                Effektive Turnier-Anzeige: {effectiveTournamentDisplayName}
              </p>
            ) : null}
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

        {/* TEAM-SEASON-ORGUNIT-01: season-scoped OrgUnit assignment.
            Persisted as TeamSeasonOrgUnit (not Team.orgUnitId).
            Saved immediately on change — mirrors the competition pattern. */}
        <FormSection
          title="Organisation"
          description={
            !currentTeamSeasonId
              ? "Keine aktuelle Saison — Organisationseinheit kann erst nach Saisonzuordnung gepflegt werden."
              : undefined
          }
        >
          <div className="md:col-span-2 space-y-1.5">
            <span className={labelClass}>
              Organisationseinheit
              {currentTeamSeasonId ? (
                <span className="ml-1.5 font-normal text-[var(--muted)] normal-case tracking-normal">
                  (saisonal)
                </span>
              ) : null}
            </span>
            {canManage && currentTeamSeasonId ? (
              <>
                <select
                  value={seasonOrgUnitId}
                  disabled={seasonOrgUnitSaving}
                  onChange={(event) => handleSeasonOrgUnitChange(event.target.value)}
                  className={fieldClass}
                >
                  <option value="">— keine Zuordnung —</option>
                  {availableOrgUnits.map((ou) => (
                    <option key={ou.id} value={ou.id}>
                      {ou.name} ({ou.key})
                    </option>
                  ))}
                </select>
                {seasonOrgUnitMessage ? (
                  <p className="text-xs font-medium text-emerald-600">{seasonOrgUnitMessage}</p>
                ) : null}
                {seasonOrgUnitError ? (
                  <p className="text-xs font-medium text-[var(--sce-danger)]">{seasonOrgUnitError}</p>
                ) : null}
              </>
            ) : (
              <p className="text-sm text-[var(--foreground)]">
                {currentSeasonOrgUnit ? (
                  `${currentSeasonOrgUnit.name} (${currentSeasonOrgUnit.key})`
                ) : (
                  <span className="text-[var(--muted)]">Keine Einheit zugeordnet</span>
                )}
              </p>
            )}
          </div>
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

        <FormSection
          title="Website-Veröffentlichung"
          description={
            currentSeasonPublication
              ? `Einstellungen für ${currentSeasonPublication.seasonName}. Änderungen werden mit «Team speichern» übernommen. Wenn beide aktiviert sind, wird zuerst das nächste Spiel angezeigt. Ist kein kommendes Spiel vorhanden, wird das nächste Turnier angezeigt.`
              : "Keine aktuelle Saison — Veröffentlichung kann erst nach Saisonzuordnung gepflegt werden."
          }
        >
          <div
            className="space-y-3 md:col-span-2"
            data-testid="team-season-next-event-controls"
          >
            <SwitchToggle
              id="show-next-match"
              label="Nächstes Spiel anzeigen"
              checked={showNextMatch}
              onChange={(checked) =>
                updatePublicationField("showNextMatch", checked)
              }
              disabled={!canManage || !currentSeasonPublication || submitting}
            />
            <SwitchToggle
              id="show-next-tournament"
              label="Nächstes Turnier anzeigen"
              checked={showNextTournament}
              onChange={(checked) =>
                updatePublicationField("showNextTournament", checked)
              }
              disabled={!canManage || !currentSeasonPublication || submitting}
            />
          </div>
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
            disabled={submitting || !isDirty}
            className="fca-button-primary"
          >
            {submitting ? "Speichern..." : "Team speichern"}
          </button>
        </div>
      ) : null}
    </SectionCard>
  );
}
