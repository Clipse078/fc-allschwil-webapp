"use client";

/**
 * components/admin/tournamentcenter/TournamentCreateForm.tsx
 *
 * TOURNAMENTCENTER-01D — dedicated TournamentCenter creation workflow.
 *
 * Replaces the generic TournamentEventCreateForm on
 * /dashboard/tournamentcenter/new with a form that captures the canonical
 * multi-team participation, Spielfeld/Halle allocation, and per-team
 * Garderobe allocation (TOURNAMENTCENTER-01B architecture) directly during
 * creation — instead of forcing a second "edit tournament" trip.
 *
 * Participants / resources / dressing rooms are collected as local drafts
 * (no tournamentId exists yet). On submit, the drafts are sent through
 * lib/tournaments/create-tournament-orchestration.ts, which sequences the
 * EXISTING, already-reviewed API calls:
 *   1. POST /api/events (type=TOURNAMENT)
 *   2. POST /api/tournaments/:id/participants (per participant)
 *   3. POST /api/tournaments/:id/resource-allocations (HOME only)
 *   4. POST /api/tournaments/:id/participants/:id/dressing-room-allocations (HOME only)
 *
 * This is orchestration, not a new transaction/job framework — if a later
 * step fails, the Event and everything already created remain real and
 * editable via the existing TournamentCenter edit flow (see the inline
 * partial-failure banner below).
 */

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Building2, Loader2, Plus, Shirt, Trash2, UserRound, UsersRound } from "lucide-react";
import { SectionCard } from "@/components/ui/page/SectionCard";
import { FacilityResourceSelector, type FacilityGroup } from "@/components/admin/training/FacilityResourceSelector";
import {
  orchestrateTournamentCreation,
  type TournamentCreationOrchestrationResult,
  type TournamentDressingRoomAllocationDraft,
  type TournamentParticipantDraft,
  type TournamentParticipantDraftKind,
  type TournamentResourceAllocationDraft,
} from "@/lib/tournaments/create-tournament-orchestration";

// ── Types ──────────────────────────────────────────────────────────────────

type SeasonItem = {
  id: string;
  key: string;
  name: string;
  isActive: boolean;
};

type TeamOption = {
  id: string;
  name: string;
  ageGroup: string | null;
  genderGroup: string | null;
  isActive: boolean;
};

type ExternalTeamOption = {
  id: string;
  name: string;
  categoryLabel: string | null;
  externalClub: { id: string; name: string };
};

type ParticipantDraftRow = {
  localId: string;
  kind: TournamentParticipantDraftKind;
  teamId?: string;
  externalTeamId?: string;
  manualLabel?: string;
  displayName: string;
  subLabel: string | null;
  dressingRooms: Array<{ facilityResourceId: string; facilityResourceName: string; facilityName: string }>;
};

type ResourceDraftRow = {
  localId: string;
  facilityResourceId: string;
  facilityResourceName: string;
  facilityName: string;
};

type TournamentCreateFormProps = {
  pitchHallFacilityGroups: FacilityGroup[];
  dressingRoomFacilityGroups: FacilityGroup[];
};

function formatTeamLabel(team: { name: string; ageGroup: string | null; genderGroup: string | null }): string {
  const suffix = [team.ageGroup, team.genderGroup].filter(Boolean).join(" / ");
  return suffix ? `${team.name} · ${suffix}` : team.name;
}

function resolveResourceDisplay(
  facilityGroups: FacilityGroup[],
  facilityResourceId: string,
): { name: string; facilityName: string } {
  for (const group of facilityGroups) {
    const resource = group.resources.find((r) => r.id === facilityResourceId);
    if (resource) {
      return { name: resource.name, facilityName: group.facilityName };
    }
  }
  return { name: facilityResourceId, facilityName: "" };
}

let localIdCounter = 0;
function nextLocalId(prefix: string): string {
  localIdCounter += 1;
  return `${prefix}-${localIdCounter}`;
}

export default function TournamentCreateForm({
  pitchHallFacilityGroups,
  dressingRoomFacilityGroups,
}: TournamentCreateFormProps) {
  const router = useRouter();
  const formId = useId();

  // ── Turnier fields ─────────────────────────────────────────────────────
  const [seasonId, setSeasonId] = useState("");
  const [title, setTitle] = useState("Turnier");
  const [organizerName, setOrganizerName] = useState("");
  const [competitionLabel, setCompetitionLabel] = useState("");
  const [location, setLocation] = useState("");
  const [homeAway, setHomeAway] = useState<"HOME" | "AWAY">("HOME");
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");
  const [meetingTime, setMeetingTime] = useState("");
  const [resultLabel, setResultLabel] = useState("");
  const [description, setDescription] = useState("");
  const [remarks, setRemarks] = useState("");

  // ── Sichtbarkeit ───────────────────────────────────────────────────────
  const [websiteVisible, setWebsiteVisible] = useState(true);
  const [infoboardVisible, setInfoboardVisible] = useState(true);
  const [homepageVisible, setHomepageVisible] = useState(true);
  const [wochenplanVisible, setWochenplanVisible] = useState(true);
  const [teamPageVisible, setTeamPageVisible] = useState(true);

  // ── Reference data ─────────────────────────────────────────────────────
  const [seasonOptions, setSeasonOptions] = useState<SeasonItem[]>([]);
  const [teamOptions, setTeamOptions] = useState<TeamOption[]>([]);
  const [externalTeamOptions, setExternalTeamOptions] = useState<ExternalTeamOption[]>([]);
  const [loadingSeasons, setLoadingSeasons] = useState(true);
  const [loadingTeams, setLoadingTeams] = useState(true);
  const [loadingExternalTeams, setLoadingExternalTeams] = useState(true);

  // ── Teilnehmende Teams (draft, pre-creation) ──────────────────────────
  const [participants, setParticipants] = useState<ParticipantDraftRow[]>([]);
  const [selectedTeamId, setSelectedTeamId] = useState("");
  const [selectedExternalTeamId, setSelectedExternalTeamId] = useState("");
  const [manualLabel, setManualLabel] = useState("");
  const [showManualEntry, setShowManualEntry] = useState(false);

  // ── Ressourcen · Spielfeld/Halle (draft, pre-creation) ────────────────
  const [resources, setResources] = useState<ResourceDraftRow[]>([]);

  // ── Submission ─────────────────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [partialResult, setPartialResult] = useState<TournamentCreationOrchestrationResult | null>(null);

  useEffect(() => {
    let active = true;

    async function loadSeasons() {
      setLoadingSeasons(true);
      try {
        const res = await fetch("/api/seasons", { cache: "no-store" });
        const data = (await res.json().catch(() => null)) as { seasons?: SeasonItem[] } | null;
        if (!res.ok) throw new Error((data as { error?: string } | null)?.error ?? "Saisons konnten nicht geladen werden.");
        if (!active || !data) return;
        const seasons = Array.isArray(data.seasons) ? data.seasons : [];
        setSeasonOptions(seasons);
        setSeasonId((seasons.find((s) => s.isActive) ?? seasons[0])?.id ?? "");
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Ein Fehler ist aufgetreten.");
      } finally {
        if (active) setLoadingSeasons(false);
      }
    }

    async function loadTeams() {
      setLoadingTeams(true);
      try {
        const res = await fetch("/api/teams", { cache: "no-store" });
        const data = (await res.json().catch(() => null)) as TeamOption[] | { error?: string } | null;
        if (!res.ok) throw new Error((data as { error?: string } | null)?.error ?? "Teams konnten nicht geladen werden.");
        if (!active) return;
        setTeamOptions(Array.isArray(data) ? data.filter((t) => t.isActive) : []);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Ein Fehler ist aufgetreten.");
      } finally {
        if (active) setLoadingTeams(false);
      }
    }

    async function loadExternalTeams() {
      setLoadingExternalTeams(true);
      try {
        const res = await fetch("/api/club-directory/teams", { cache: "no-store" });
        const data = (await res.json().catch(() => null)) as { teams?: ExternalTeamOption[] } | null;
        if (!res.ok) throw new Error((data as { error?: string } | null)?.error ?? "Externe Teams konnten nicht geladen werden.");
        if (!active) return;
        setExternalTeamOptions(data?.teams ?? []);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Ein Fehler ist aufgetreten.");
      } finally {
        if (active) setLoadingExternalTeams(false);
      }
    }

    loadSeasons();
    loadTeams();
    loadExternalTeams();

    return () => {
      active = false;
    };
  }, []);

  const assignedTeamIds = useMemo(
    () => new Set(participants.map((p) => p.teamId).filter((id): id is string => !!id)),
    [participants],
  );
  const assignedExternalTeamIds = useMemo(
    () => new Set(participants.map((p) => p.externalTeamId).filter((id): id is string => !!id)),
    [participants],
  );

  const availableTeams = teamOptions.filter((t) => !assignedTeamIds.has(t.id));
  const availableExternalTeams = externalTeamOptions.filter((t) => !assignedExternalTeamIds.has(t.id));

  const externalTeamsByClub = useMemo(() => {
    const groups = new Map<string, { clubName: string; teams: ExternalTeamOption[] }>();
    for (const t of availableExternalTeams) {
      const group = groups.get(t.externalClub.id) ?? { clubName: t.externalClub.name, teams: [] };
      group.teams.push(t);
      groups.set(t.externalClub.id, group);
    }
    return Array.from(groups.values());
  }, [availableExternalTeams]);

  const addTeamParticipant = useCallback(() => {
    if (!selectedTeamId) return;
    const team = teamOptions.find((t) => t.id === selectedTeamId);
    if (!team) return;
    setParticipants((prev) => [
      ...prev,
      {
        localId: nextLocalId("participant"),
        kind: "TEAM",
        teamId: team.id,
        displayName: team.name,
        subLabel: [team.ageGroup, team.genderGroup].filter(Boolean).join(" / ") || null,
        dressingRooms: [],
      },
    ]);
    setSelectedTeamId("");
  }, [selectedTeamId, teamOptions]);

  const addExternalTeamParticipant = useCallback(() => {
    if (!selectedExternalTeamId) return;
    const externalTeam = externalTeamOptions.find((t) => t.id === selectedExternalTeamId);
    if (!externalTeam) return;
    setParticipants((prev) => [
      ...prev,
      {
        localId: nextLocalId("participant"),
        kind: "EXTERNAL_TEAM",
        externalTeamId: externalTeam.id,
        displayName: externalTeam.name,
        subLabel: [externalTeam.externalClub.name, externalTeam.categoryLabel].filter(Boolean).join(" · ") || null,
        dressingRooms: [],
      },
    ]);
    setSelectedExternalTeamId("");
  }, [selectedExternalTeamId, externalTeamOptions]);

  const addManualParticipant = useCallback(() => {
    const trimmed = manualLabel.trim();
    if (!trimmed) return;
    setParticipants((prev) => [
      ...prev,
      {
        localId: nextLocalId("participant"),
        kind: "MANUAL",
        manualLabel: trimmed,
        displayName: trimmed,
        subLabel: "Manuell erfasst — kein kanonisches Team verknüpft",
        dressingRooms: [],
      },
    ]);
    setManualLabel("");
  }, [manualLabel]);

  const removeParticipant = useCallback((localId: string) => {
    setParticipants((prev) => prev.filter((p) => p.localId !== localId));
  }, []);

  const addDressingRoomDraft = useCallback(async (participantLocalId: string, facilityResourceId: string) => {
    const display = resolveResourceDisplay(dressingRoomFacilityGroups, facilityResourceId);
    setParticipants((prev) =>
      prev.map((p) =>
        p.localId === participantLocalId
          ? {
              ...p,
              dressingRooms: [
                ...p.dressingRooms,
                { facilityResourceId, facilityResourceName: display.name, facilityName: display.facilityName },
              ],
            }
          : p,
      ),
    );
  }, [dressingRoomFacilityGroups]);

  const removeDressingRoomDraft = useCallback((participantLocalId: string, facilityResourceId: string) => {
    setParticipants((prev) =>
      prev.map((p) =>
        p.localId === participantLocalId
          ? { ...p, dressingRooms: p.dressingRooms.filter((d) => d.facilityResourceId !== facilityResourceId) }
          : p,
      ),
    );
  }, []);

  const allocatedResourceIds = useMemo(() => new Set(resources.map((r) => r.facilityResourceId)), [resources]);

  const addResourceDraft = useCallback(async (facilityResourceId: string) => {
    const display = resolveResourceDisplay(pitchHallFacilityGroups, facilityResourceId);
    setResources((prev) => [
      ...prev,
      { localId: nextLocalId("resource"), facilityResourceId, facilityResourceName: display.name, facilityName: display.facilityName },
    ]);
  }, [pitchHallFacilityGroups]);

  const removeResourceDraft = useCallback((localId: string) => {
    setResources((prev) => prev.filter((r) => r.localId !== localId));
  }, []);

  const canSubmit =
    !submitting && !!seasonId && !!title.trim() && !!startAt && participants.length > 0;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setPartialResult(null);

    if (participants.length === 0) {
      setError("Mindestens ein teilnehmendes Team ist erforderlich.");
      return;
    }

    setSubmitting(true);

    // The legacy Event.teamId "Hauptteam" compatibility field is derived
    // from the first FCA Team participant (if any) — never a second,
    // parallel single-team model. See TOURNAMENTCENTER-01D task notes.
    const primaryTeamId = participants.find((p) => p.kind === "TEAM")?.teamId ?? null;

    try {
      const result = await orchestrateTournamentCreation(
        {
          homeAway,
          participants: participants.map<TournamentParticipantDraft>((p) => ({
            localId: p.localId,
            kind: p.kind,
            teamId: p.teamId,
            externalTeamId: p.externalTeamId,
            manualLabel: p.manualLabel,
          })),
          resourceAllocations: resources.map<TournamentResourceAllocationDraft>((r) => ({
            localId: r.localId,
            facilityResourceId: r.facilityResourceId,
          })),
          dressingRoomAllocations: participants.flatMap<TournamentDressingRoomAllocationDraft>((p) =>
            p.dressingRooms.map((d) => ({ participantLocalId: p.localId, facilityResourceId: d.facilityResourceId })),
          ),
        },
        {
          createEvent: async () => {
            const res = await fetch("/api/events", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                type: "TOURNAMENT",
                source: "MANUAL",
                seasonId,
                teamId: primaryTeamId,
                title: title.trim(),
                description: description.trim() || null,
                location: location.trim() || null,
                startAt,
                endAt: endAt || null,
                meetingTime: meetingTime || null,
                organizerName: organizerName.trim() || null,
                competitionLabel: competitionLabel.trim() || null,
                homeAway,
                resultLabel: resultLabel.trim() || null,
                remarks: remarks.trim() || null,
                websiteVisible,
                infoboardVisible,
                homepageVisible,
                wochenplanVisible,
                trainingsplanVisible: false,
                teamPageVisible,
              }),
            });
            const data = await res.json().catch(() => null);
            if (!res.ok) {
              throw new Error(data?.error ?? "Turnier konnte nicht erstellt werden.");
            }
            const tournamentId = data?.eventIds?.[0];
            if (!tournamentId) {
              throw new Error("Turnier wurde erstellt, aber es wurde keine ID zurückgegeben.");
            }
            return tournamentId as string;
          },
          addParticipant: async (tournamentId, draft) => {
            const body =
              draft.kind === "TEAM"
                ? { teamId: draft.teamId }
                : draft.kind === "EXTERNAL_TEAM"
                  ? { externalTeamId: draft.externalTeamId }
                  : { manualLabel: draft.manualLabel };
            const res = await fetch(`/api/tournaments/${tournamentId}/participants`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify(body),
            });
            const data = (await res.json().catch(() => null)) as { participant?: { id: string }; error?: string } | null;
            if (!res.ok || !data?.participant) {
              throw new Error(data?.error ?? "Teilnehmer konnte nicht angelegt werden.");
            }
            return data.participant.id;
          },
          addResourceAllocation: async (tournamentId, draft) => {
            const res = await fetch(`/api/tournaments/${tournamentId}/resource-allocations`, {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ facilityResourceId: draft.facilityResourceId }),
            });
            const data = (await res.json().catch(() => null)) as { allocation?: unknown; error?: string } | null;
            if (!res.ok || !data?.allocation) {
              throw new Error(data?.error ?? "Ressource konnte nicht zugewiesen werden.");
            }
          },
          addDressingRoomAllocation: async (tournamentId, participantId, draft) => {
            const res = await fetch(
              `/api/tournaments/${tournamentId}/participants/${participantId}/dressing-room-allocations`,
              {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ facilityResourceId: draft.facilityResourceId }),
              },
            );
            const data = (await res.json().catch(() => null)) as { allocation?: unknown; error?: string } | null;
            if (!res.ok || !data?.allocation) {
              throw new Error(data?.error ?? "Garderobe konnte nicht zugewiesen werden.");
            }
          },
        },
      );

      if (result.ok) {
        router.push("/dashboard/tournamentcenter?submitted=1");
        router.refresh();
        return;
      }

      // The Event (and whatever succeeded) is real — keep the admin on this
      // page with a clear path to finish up, instead of pretending nothing
      // happened or silently dropping the failed pieces.
      setPartialResult(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Turnier konnte nicht erstellt werden.");
    } finally {
      setSubmitting(false);
    }
  }

  const totalStepErrors = partialResult
    ? partialResult.participantErrors.length +
      partialResult.resourceAllocationErrors.length +
      partialResult.dressingRoomAllocationErrors.length
    : 0;

  return (
    <form onSubmit={handleSubmit} className="space-y-5" data-testid="tournament-create-form">
      <SectionCard title="Turnier" description="Titel, Zeitrahmen und Rahmendaten">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block space-y-2 md:col-span-2">
            <span className="fca-label">Titel</span>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="fca-input"
              required
              data-testid="tournament-create-title"
            />
          </label>

          <label className="block space-y-2">
            <span className="fca-label">Saison</span>
            <select
              value={seasonId}
              onChange={(e) => setSeasonId(e.target.value)}
              className="fca-select"
              required
              disabled={loadingSeasons}
              data-testid="tournament-create-season-select"
            >
              <option value="">{loadingSeasons ? "Saisons laden..." : "Bitte wählen"}</option>
              {seasonOptions.map((season) => (
                <option key={season.id} value={season.id}>
                  {season.name}
                  {season.isActive ? " (aktuell)" : ""}
                </option>
              ))}
            </select>
          </label>

          <label className="block space-y-2">
            <span className="fca-label">Wettbewerb / Label</span>
            <input
              type="text"
              value={competitionLabel}
              onChange={(e) => setCompetitionLabel(e.target.value)}
              className="fca-input"
              placeholder="z. B. Hallenturnier / Playmore Turnier"
            />
          </label>

          <label className="block space-y-2">
            <span className="fca-label">Organisator</span>
            <input
              type="text"
              value={organizerName}
              onChange={(e) => setOrganizerName(e.target.value)}
              className="fca-input"
              placeholder="z. B. FC Aesch"
            />
          </label>

          <label className="block space-y-2">
            <span className="fca-label">Ort</span>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="fca-input"
              placeholder="z. B. Turnhalle Binningen"
            />
          </label>

          <label className="block space-y-2">
            <span className="fca-label">Heim / Auswärts</span>
            <select
              value={homeAway}
              onChange={(e) => setHomeAway(e.target.value === "AWAY" ? "AWAY" : "HOME")}
              className="fca-select"
              data-testid="tournament-create-home-away-select"
            >
              <option value="HOME">Heim (FC Allschwil ausrichtend)</option>
              <option value="AWAY">Auswärts (extern ausgerichtet)</option>
            </select>
          </label>

          <label className="block space-y-2">
            <span className="fca-label">Start</span>
            <input
              type="datetime-local"
              value={startAt}
              onChange={(e) => setStartAt(e.target.value)}
              className="fca-input"
              required
              data-testid="tournament-create-start-at"
            />
          </label>

          <label className="block space-y-2">
            <span className="fca-label">Ende</span>
            <input type="datetime-local" value={endAt} onChange={(e) => setEndAt(e.target.value)} className="fca-input" />
          </label>

          <label className="block space-y-2">
            <span className="fca-label">Treffpunkt Zeit</span>
            <input
              type="datetime-local"
              value={meetingTime}
              onChange={(e) => setMeetingTime(e.target.value)}
              className="fca-input"
            />
          </label>

          <label className="block space-y-2">
            <span className="fca-label">Resultat / Rang</span>
            <input
              type="text"
              value={resultLabel}
              onChange={(e) => setResultLabel(e.target.value)}
              className="fca-input"
              placeholder="z. B. 2. Platz"
            />
          </label>

          <label className="block space-y-2 md:col-span-2">
            <span className="fca-label">Beschreibung</span>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              className="fca-textarea min-h-[100px]"
            />
          </label>

          <label className="block space-y-2 md:col-span-2">
            <span className="fca-label">Bemerkungen</span>
            <input type="text" value={remarks} onChange={(e) => setRemarks(e.target.value)} className="fca-input" />
          </label>
        </div>
      </SectionCard>

      <SectionCard
        title="Teilnehmende Teams"
        description="Mindestens ein Team erforderlich — FC Allschwil Teams und externe Teams aus dem Vereinsverzeichnis, in beliebiger Mischung und Anzahl."
      >
        <div className="space-y-4">
          {participants.length === 0 ? (
            <div className="rounded-lg border-2 border-dashed border-[var(--border)] py-8 text-center">
              <UsersRound className="mx-auto mb-2 h-6 w-6 text-[var(--muted)]" aria-hidden />
              <p className="text-sm text-[var(--text-2)]">Noch keine Teams zugeordnet.</p>
            </div>
          ) : (
            <ul className="space-y-2" data-testid="tournament-create-participant-list">
              {participants.map((participant) => (
                <li
                  key={participant.localId}
                  data-testid={`tournament-create-participant-row-${participant.localId}`}
                  className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
                >
                  <div className="flex items-start justify-between gap-3">
                    <div className="flex min-w-0 items-start gap-2.5">
                      {participant.kind === "TEAM" ? (
                        <UsersRound className="mt-0.5 h-4 w-4 shrink-0 text-[var(--sce-primary)]" aria-hidden />
                      ) : participant.kind === "EXTERNAL_TEAM" ? (
                        <Building2 className="mt-0.5 h-4 w-4 shrink-0 text-[var(--sce-info)]" aria-hidden />
                      ) : (
                        <UserRound className="mt-0.5 h-4 w-4 shrink-0 text-[var(--muted)]" aria-hidden />
                      )}
                      <div className="min-w-0">
                        <p className="truncate text-sm font-semibold text-[var(--foreground)]">{participant.displayName}</p>
                        {participant.subLabel ? (
                          <p className="mt-0.5 text-xs text-[var(--text-2)]">{participant.subLabel}</p>
                        ) : null}
                      </div>
                    </div>

                    <button
                      type="button"
                      onClick={() => removeParticipant(participant.localId)}
                      aria-label={`${participant.displayName} entfernen`}
                      data-testid={`tournament-create-participant-remove-${participant.localId}`}
                      className="shrink-0 rounded p-1 text-[var(--muted)] transition hover:bg-rose-50 hover:text-rose-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </div>

                  {homeAway === "HOME" && (
                    <div className="mt-3 border-t border-[var(--border)] pt-3">
                      <p className="mb-1.5 flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
                        <Shirt className="h-3.5 w-3.5" aria-hidden />
                        Garderobe
                      </p>

                      {participant.dressingRooms.length > 0 && (
                        <ul className="mb-2 flex flex-wrap gap-1.5">
                          {participant.dressingRooms.map((room) => (
                            <li
                              key={room.facilityResourceId}
                              className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-2)] px-2.5 py-1 text-xs text-[var(--text-2)]"
                            >
                              {room.facilityResourceName}
                              <button
                                type="button"
                                onClick={() => removeDressingRoomDraft(participant.localId, room.facilityResourceId)}
                                aria-label={`Garderobe ${room.facilityResourceName} entfernen`}
                                className="text-[var(--muted)] hover:text-rose-600"
                              >
                                ×
                              </button>
                            </li>
                          ))}
                        </ul>
                      )}

                      <FacilityResourceSelector
                        facilityGroups={dressingRoomFacilityGroups}
                        allocatedResourceIds={new Set(participant.dressingRooms.map((d) => d.facilityResourceId))}
                        onAdd={(resourceId) => addDressingRoomDraft(participant.localId, resourceId)}
                        placeholder="Garderobe auswählen…"
                        addButtonLabel="Zuweisen"
                        testId={`tournament-create-participant-${participant.localId}-dressing-room`}
                      />
                    </div>
                  )}
                </li>
              ))}
            </ul>
          )}

          <div className="space-y-3 rounded-lg border border-dashed border-[var(--border)] p-4">
            <p className="text-sm font-medium text-[var(--text-2)]">Team hinzufügen</p>

            <div className="grid gap-3 md:grid-cols-2">
              <div className="flex gap-2">
                <select
                  value={selectedTeamId}
                  onChange={(e) => setSelectedTeamId(e.target.value)}
                  disabled={loadingTeams}
                  data-testid="tournament-create-add-team-select"
                  className="fca-select flex-1"
                >
                  <option value="">{loadingTeams ? "Teams laden…" : "FC Allschwil Team…"}</option>
                  {availableTeams.map((t) => (
                    <option key={t.id} value={t.id}>
                      {formatTeamLabel(t)}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={addTeamParticipant}
                  disabled={!selectedTeamId}
                  data-testid="tournament-create-add-team-button"
                  className="fca-button-secondary shrink-0"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>

              <div className="flex gap-2">
                <select
                  value={selectedExternalTeamId}
                  onChange={(e) => setSelectedExternalTeamId(e.target.value)}
                  disabled={loadingExternalTeams}
                  data-testid="tournament-create-add-external-team-select"
                  className="fca-select flex-1"
                >
                  <option value="">{loadingExternalTeams ? "Externe Teams laden…" : "Externes Team (Club Directory)…"}</option>
                  {externalTeamsByClub.map((group) => (
                    <optgroup key={group.clubName} label={group.clubName}>
                      {group.teams.map((t) => (
                        <option key={t.id} value={t.id}>
                          {t.name}
                        </option>
                      ))}
                    </optgroup>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={addExternalTeamParticipant}
                  disabled={!selectedExternalTeamId}
                  data-testid="tournament-create-add-external-team-button"
                  className="fca-button-secondary shrink-0"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            </div>

            {showManualEntry ? (
              <div className="flex gap-2">
                <input
                  type="text"
                  value={manualLabel}
                  onChange={(e) => setManualLabel(e.target.value)}
                  placeholder="z. B. unbekanntes Gastteam"
                  data-testid="tournament-create-manual-input"
                  className="fca-input flex-1"
                />
                <button
                  type="button"
                  onClick={addManualParticipant}
                  disabled={!manualLabel.trim()}
                  data-testid="tournament-create-add-manual-button"
                  className="fca-button-secondary shrink-0"
                >
                  <Plus className="h-4 w-4" />
                </button>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setShowManualEntry(true)}
                className="text-xs font-medium text-[var(--muted)] underline-offset-2 hover:underline"
              >
                Team ohne Verzeichniseintrag manuell erfassen…
              </button>
            )}
          </div>
        </div>
      </SectionCard>

      {homeAway === "HOME" && (
        <SectionCard
          title="Ressourcen · Spielfeld / Halle"
          description="Ein Heimturnier kann mehr als ein Spielfeld bzw. mehr als eine Halle belegen."
        >
          <div className="space-y-4">
            {resources.length === 0 ? (
              <div className="rounded-lg border-2 border-dashed border-[var(--border)] py-6 text-center">
                <p className="text-sm text-[var(--text-2)]">Noch kein Spielfeld / keine Halle zugewiesen.</p>
              </div>
            ) : (
              <ul className="space-y-2" data-testid="tournament-create-resource-list">
                {resources.map((resource) => (
                  <li
                    key={resource.localId}
                    className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
                  >
                    <div className="min-w-0 flex-1">
                      <p className="truncate text-sm font-semibold text-[var(--foreground)]">{resource.facilityResourceName}</p>
                      <p className="mt-0.5 flex items-center gap-1 text-xs text-[var(--text-2)]">
                        <Building2 className="h-3 w-3" aria-hidden />
                        {resource.facilityName}
                      </p>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeResourceDraft(resource.localId)}
                      aria-label={`${resource.facilityResourceName} entfernen`}
                      className="shrink-0 rounded p-1 text-[var(--muted)] transition hover:bg-rose-50 hover:text-rose-600"
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </li>
                ))}
              </ul>
            )}

            <FacilityResourceSelector
              facilityGroups={pitchHallFacilityGroups}
              allocatedResourceIds={allocatedResourceIds}
              onAdd={addResourceDraft}
              placeholder="Spielfeld / Halle auswählen…"
              addButtonLabel="Zuweisen"
              testId="tournament-create-resource-add"
            />
          </div>
        </SectionCard>
      )}

      <SectionCard title="Veröffentlichung" description="Ausgabekanäle für dieses Turnier">
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          <Toggle label="Website" value={websiteVisible} onChange={setWebsiteVisible} />
          <Toggle label="Infoboard" value={infoboardVisible} onChange={setInfoboardVisible} />
          <Toggle label="Homepage" value={homepageVisible} onChange={setHomepageVisible} />
          <Toggle label="Wochenplan" value={wochenplanVisible} onChange={setWochenplanVisible} />
          <Toggle label="Teamseite" value={teamPageVisible} onChange={setTeamPageVisible} />
        </div>
      </SectionCard>

      <div className="fca-status-box fca-status-box-muted text-xs">
        Neue Turniere werden vor der Veröffentlichung geprüft, sofern kein Freigabe-Recht vorliegt. Teams, Ressourcen
        und Garderoben aus diesem Formular werden dabei sofort mit dem Turnier angelegt.
      </div>

      {partialResult && totalStepErrors > 0 ? (
        <div className="fca-status-box fca-status-box-warn text-sm" data-testid="tournament-create-partial-warning">
          <p className="font-semibold">
            Turnier wurde erstellt, {totalStepErrors === 1 ? "aber ein Element" : `aber ${totalStepErrors} Elemente`}{" "}
            konnte{totalStepErrors === 1 ? "" : "n"} nicht angelegt werden.
          </p>
          <ul className="mt-1.5 list-inside list-disc space-y-0.5">
            {partialResult.participantErrors.map((e, i) => (
              <li key={`p-${i}`}>Team: {e.error}</li>
            ))}
            {partialResult.resourceAllocationErrors.map((e, i) => (
              <li key={`r-${i}`}>Spielfeld / Halle: {e.error}</li>
            ))}
            {partialResult.dressingRoomAllocationErrors.map((e, i) => (
              <li key={`d-${i}`}>Garderobe: {e.error}</li>
            ))}
          </ul>
          <button
            type="button"
            onClick={() => router.push(`/dashboard/tournamentcenter/${partialResult.tournamentId}/edit`)}
            className="fca-button-secondary mt-3"
          >
            Zum Turnier wechseln und korrigieren
          </button>
        </div>
      ) : null}

      {error ? <div className="fca-status-box fca-status-box-error">{error}</div> : null}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={!canSubmit} data-testid="tournament-create-submit" className="fca-button-primary">
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Wird erstellt…
            </>
          ) : (
            "Turnier erstellen"
          )}
        </button>

        <button type="button" onClick={() => router.push("/dashboard/tournamentcenter")} className="fca-button-secondary">
          Abbrechen
        </button>
      </div>
      <p className="sr-only" id={`${formId}-hint`}>
        Mindestens ein teilnehmendes Team ist erforderlich, um ein Turnier zu erstellen.
      </p>
    </form>
  );
}

function Toggle({ label, value, onChange }: { label: string; value: boolean; onChange: (value: boolean) => void }) {
  return (
    <div className="fca-toggle-row">
      <span className="fca-label">{label}</span>
      <input type="checkbox" checked={value} onChange={(e) => onChange(e.target.checked)} className="fca-toggle-checkbox" />
    </div>
  );
}
