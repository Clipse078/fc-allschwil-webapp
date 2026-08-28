"use client";

/**
 * components/admin/matchcenter/MatchCreateForm.tsx
 *
 * PLANNING-CREATION-UX-01C — guided MatchCenter creation workflow.
 *
 * Adds a compact, single-surface guided "Match erstellen" flow next to the
 * existing generic MatchEventCreateForm (still reachable at
 * /dashboard/events/matches/new — untouched), following the SAME numbered
 * guided-step pattern proven on STAGE by TrainingSeriesCreateForm
 * (PLANNING-CREATION-UX-01B/-01B-C1) and TournamentCreateForm
 * (TOURNAMENTCENTER-01D):
 *
 *   1 · Team              — tenant Team (Event.teamId)
 *   2 · Heim / Auswärts    — Event.homeAway
 *   3 · Ort                — Event.location (editable; quick-pick from
 *                            tenant facilities for HOME)
 *   4 · Gegner             — searchable Club-Directory ExternalClub picker
 *                            (same ExternalClubPicker as TournamentCenter)
 *                            that prefills the EXISTING editable
 *                            Event.opponentName text field — never a second
 *                            opponent identity.
 *   5 · Termin             — Event.startAt / endAt
 *   6 · Spielfeld/Halle    — HOME only, canonical FacilityResource selection
 *                            + live Frei/Belegt (lib/facilities/availability-service.ts)
 *   7 · Garderobe          — HOME only, same live availability, Heim + Gast
 *   8 · Prüfen & Einreichen
 *
 * Preserves the EXISTING canonical architecture end to end:
 *   - Still posts to POST /api/events (type=MATCH) — the SAME endpoint
 *     MatchEventCreateForm already uses. reviewStage (APPROVED vs SUBMITTED)
 *     is decided entirely server-side by the EXISTING
 *     lib/workflow/event-review-policy.ts — this form never guesses or
 *     gates on that decision, it only reflects it via `canValidateDirectly`
 *     (same permission the server checks) for copy purposes.
 *   - Spielfeld/Halle + Garderobe are still written through the EXISTING
 *     legacy Event.pitchCode / homeDressingRoomCode / awayDressingRoomCode
 *     string fields via PATCH /api/matchcenter/:matchId (the SAME endpoint
 *     MatchcenterDetailOperational already uses) — sequenced by
 *     lib/matchcenter/create-match-orchestration.ts. FacilityResource IDs
 *     are only used client-side to drive the picker + live availability;
 *     the resource's `code` is what's actually persisted, matching the
 *     documented "not migrated to FacilityResource ids yet" state (see
 *     lib/facilities/availability-service.ts module doc). No schema/
 *     migration work is introduced here.
 *   - Gegner never creates a MatchExternalMapping — that linkage is
 *     exclusively created by the SFV sync/discovery flow (see
 *     prisma/schema.prisma MatchExternalMapping doc). Selecting a
 *     Club-Directory team here only prefills the free-text opponentName
 *     field, exactly like the generic form already allows manually.
 *   - AWAY matches never touch facility availability/allocation — no
 *     fetch, no Spielfeld/Halle or Garderobe section rendered at all.
 */

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import type { FocusEvent, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check, Building2 } from "lucide-react";
import {
  type FacilityGroup,
  type ResourceAvailabilityAnnotation,
} from "@/components/admin/training/FacilityResourceSelector";
import { VisualResourceAvailabilityPicker } from "@/components/admin/shared/planning/VisualResourceAvailabilityPicker";
import { VisualDressingRoomPicker } from "@/components/admin/shared/planning/VisualDressingRoomPicker";
import {
  orchestrateMatchCreation,
  type MatchCreationPlan,
} from "@/lib/matchcenter/create-match-orchestration";
import {
  ExternalClubPicker,
  type ExternalClubPickerResult,
} from "@/components/admin/tournamentcenter/ExternalClubPicker";

// ── Types ──────────────────────────────────────────────────────────────────

type SeasonItem = { id: string; key: string; name: string; isActive: boolean };

type TeamOption = {
  id: string;
  name: string;
  ageGroup: string | null;
  genderGroup: string | null;
  isActive: boolean;
};

/** Shape of one row in GET /api/facilities/availability's `availability` array. */
type ResourceAvailabilityRow = ResourceAvailabilityAnnotation & { resourceId: string };

type ResourceSlot = { facilityResourceId: string; facilityResourceName: string; facilityName: string; code: string };

export type MatchCreateFormProps = {
  pitchHallFacilityGroups: FacilityGroup[];
  dressingRoomFacilityGroups: FacilityGroup[];
  /**
   * Whether the current actor can create-and-approve a Match directly,
   * sourced from the SAME server-side check POST /api/events performs
   * (EVENTS_PUBLISH_WEBSITE or EVENTS_PUBLISH_INFOBOARD — see
   * lib/workflow/event-review-policy.ts). Purely informational here: the
   * server always decides the real reviewStage, this only drives copy.
   */
  canValidateDirectly: boolean;
};

function formatTeamLabel(team: { name: string; ageGroup: string | null; genderGroup: string | null }): string {
  const suffix = [team.ageGroup, team.genderGroup].filter(Boolean).join(" / ");
  return suffix ? `${team.name} · ${suffix}` : team.name;
}

function resolveResourceSlot(facilityGroups: FacilityGroup[], facilityResourceId: string): ResourceSlot | null {
  for (const group of facilityGroups) {
    const resource = group.resources.find((r) => r.id === facilityResourceId);
    if (resource) {
      return {
        facilityResourceId,
        facilityResourceName: resource.name,
        facilityName: group.facilityName,
        code: resource.code,
      };
    }
  }
  return null;
}

/** Collapses a step to a one-line summary once its own info is complete — plain local UI state, not a wizard. */
function handleStepBlur(event: FocusEvent<HTMLDivElement>, isComplete: boolean, collapse: () => void): void {
  if (!isComplete) return;
  const next = event.relatedTarget as Node | null;
  if (next && event.currentTarget.contains(next)) return;
  collapse();
}

type GuidedStepProps = {
  index: number;
  title: string;
  hint: ReactNode;
  complete: boolean;
  collapsed: boolean;
  summary?: ReactNode;
  onExpand?: () => void;
  onBlurCapture?: (event: FocusEvent<HTMLDivElement>) => void;
  children: ReactNode;
};

function GuidedStep({ index, title, hint, complete, collapsed, summary, onExpand, onBlurCapture, children }: GuidedStepProps) {
  const isCollapsed = complete && collapsed;
  return (
    <div className="px-4 py-3" onBlur={onBlurCapture}>
      <div className="flex items-center gap-2.5">
        <span
          className={
            complete
              ? "flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[var(--sce-primary)] text-white"
              : "flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[var(--border-strong)] text-[0.7rem] font-semibold text-[var(--text-2)]"
          }
          aria-hidden
        >
          {complete ? <Check className="h-3.5 w-3.5" /> : index}
        </span>
        <div className="min-w-0 flex-1">
          <h2 className="text-sm font-semibold text-[var(--foreground)]">{title}</h2>
          {isCollapsed && summary ? (
            <p className="truncate text-xs text-[var(--text-2)]">{summary}</p>
          ) : (
            <p className="text-xs text-[var(--text-2)]">{hint}</p>
          )}
        </div>
        {isCollapsed && onExpand ? (
          <button type="button" onClick={onExpand} className="shrink-0 text-xs font-medium text-[var(--sce-primary)] hover:underline">
            Bearbeiten
          </button>
        ) : null}
      </div>
      {isCollapsed ? null : <div className="mt-2.5 pl-[2.125rem]">{children}</div>}
    </div>
  );
}


// ── Component ────────────────────────────────────────────────────────────

export default function MatchCreateForm({
  pitchHallFacilityGroups,
  dressingRoomFacilityGroups,
  canValidateDirectly,
}: MatchCreateFormProps) {
  const router = useRouter();
  const formId = useId();

  // ── 1 · Team ─────────────────────────────────────────────────────────
  const [teamId, setTeamId] = useState("");
  const [teamOptions, setTeamOptions] = useState<TeamOption[]>([]);
  const [loadingTeams, setLoadingTeams] = useState(true);

  // Season is resolved automatically (active season) — not a guided step;
  // POST /api/events still requires it, mirroring how TournamentCreateForm
  // auto-selects the active season without exposing it as its own step.
  const [seasonId, setSeasonId] = useState("");

  // ── 2 · Heim / Auswärts ────────────────────────────────────────────────
  const [homeAway, setHomeAway] = useState<"HOME" | "AWAY">("HOME");

  // ── 3 · Ort ──────────────────────────────────────────────────────────
  const [location, setLocation] = useState("");

  // ── 4 · Gegner ───────────────────────────────────────────────────────
  const [opponentName, setOpponentName] = useState("");
  /** Canonical Club-Directory Verein — searched on demand via ExternalClubPicker. */
  const [selectedExternalClub, setSelectedExternalClub] = useState<ExternalClubPickerResult | null>(null);

  // ── 5 · Termin ───────────────────────────────────────────────────────
  const [startAt, setStartAt] = useState("");
  const [endAt, setEndAt] = useState("");

  // ── 6/7 · Spielfeld/Halle + Garderobe (HOME only, draft pre-creation) ──
  const [pitchSlot, setPitchSlot] = useState<ResourceSlot | null>(null);
  const [homeDressingRoomSlot, setHomeDressingRoomSlot] = useState<ResourceSlot | null>(null);
  const [awayDressingRoomSlot, setAwayDressingRoomSlot] = useState<ResourceSlot | null>(null);

  const [pitchAvailability, setPitchAvailability] = useState<Map<string, ResourceAvailabilityAnnotation>>(new Map());
  const [dressingRoomAvailability, setDressingRoomAvailability] = useState<Map<string, ResourceAvailabilityAnnotation>>(
    new Map(),
  );

  // ── Collapse state (steps 1–4 only — see GuidedStep doc comment) ──────
  const [teamCollapsed, setTeamCollapsed] = useState(false);
  const [homeAwayCollapsed, setHomeAwayCollapsed] = useState(false);
  const [opponentCollapsed, setOpponentCollapsed] = useState(false);
  const [terminCollapsed, setTerminCollapsed] = useState(false);

  // ── Submission ─────────────────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ eventId: string } | null>(null);
  const [partialError, setPartialError] = useState<string | null>(null);

  useEffect(() => {
    let active = true;

    async function loadSeasons() {
      try {
        const res = await fetch("/api/seasons", { cache: "no-store" });
        const data = (await res.json().catch(() => null)) as { seasons?: SeasonItem[] } | null;
        if (!res.ok) throw new Error((data as { error?: string } | null)?.error ?? "Saisons konnten nicht geladen werden.");
        if (!active || !data) return;
        const seasons = Array.isArray(data.seasons) ? data.seasons : [];
        setSeasonId((seasons.find((s) => s.isActive) ?? seasons[0])?.id ?? "");
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Ein Fehler ist aufgetreten.");
      }
    }

    async function loadTeams() {
      setLoadingTeams(true);
      try {
        // ORG-ACCESS-03: use writable-teams endpoint so scoped users see only
        // teams within their OrgUnit write scope; coordinators get all teams.
        const res = await fetch("/api/planning/writable-teams?domain=match", { cache: "no-store" });
        const data = (await res.json().catch(() => null)) as
          | { teams?: TeamOption[] }
          | { error?: string }
          | null;
        if (!res.ok) throw new Error((data as { error?: string } | null)?.error ?? "Teams konnten nicht geladen werden.");
        if (!active) return;
        setTeamOptions((data as { teams?: TeamOption[] } | null)?.teams ?? []);
      } catch (err) {
        if (active) setError(err instanceof Error ? err.message : "Ein Fehler ist aufgetreten.");
      } finally {
        if (active) setLoadingTeams(false);
      }
    }

    loadSeasons();
    loadTeams();

    return () => {
      active = false;
    };
  }, []);

  const selectedTeam = useMemo(() => teamOptions.find((t) => t.id === teamId) ?? null, [teamId, teamOptions]);

  function handleSelectExternalClub(club: ExternalClubPickerResult) {
    setSelectedExternalClub(club);
  }

  function getEffectiveOpponentDisplayName(): string {
    const override = opponentName.trim();
    if (selectedExternalClub) {
      return override || selectedExternalClub.name;
    }
    return override;
  }

  // Quick-pick facility names for "Ort" — reuses the same tenant facility
  // data already loaded for Spielfeld/Halle, no new lookup.
  const facilityNameQuickPicks = useMemo(() => {
    const names = new Set<string>();
    for (const group of pitchHallFacilityGroups) names.add(group.facilityName);
    return Array.from(names);
  }, [pitchHallFacilityGroups]);

  // PLANNING-CREATION-UX-01C: HOME-only live Spielfeld/Halle + Garderobe
  // availability for the currently selected interval, reusing the EXISTING
  // GET /api/facilities/availability endpoint — identical fetch shape to
  // TournamentCreateForm/TrainingSeriesCreateForm.
  useEffect(() => {
    if (homeAway !== "HOME" || !startAt) {
      setPitchAvailability(new Map());
      setDressingRoomAvailability(new Map());
      return;
    }

    let active = true;

    async function loadAvailability() {
      const params = new URLSearchParams({ startAt });
      if (endAt) params.set("endAt", endAt);

      async function fetchGroup(group: "PITCH_HALL" | "DRESSING_ROOM") {
        try {
          const res = await fetch(`/api/facilities/availability?${params.toString()}&group=${group}`, {
            cache: "no-store",
          });
          const data = (await res.json().catch(() => null)) as { availability?: ResourceAvailabilityRow[] } | null;
          if (!res.ok || !data?.availability) return new Map<string, ResourceAvailabilityAnnotation>();
          return new Map(data.availability.map((a) => [a.resourceId, a]));
        } catch {
          return new Map<string, ResourceAvailabilityAnnotation>();
        }
      }

      const [pitch, room] = await Promise.all([fetchGroup("PITCH_HALL"), fetchGroup("DRESSING_ROOM")]);
      if (!active) return;
      setPitchAvailability(pitch);
      setDressingRoomAvailability(room);
    }

    loadAvailability();

    return () => {
      active = false;
    };
  }, [homeAway, startAt, endAt]);

  const addPitchSlot = useCallback(
    (facilityResourceId: string) => setPitchSlot(resolveResourceSlot(pitchHallFacilityGroups, facilityResourceId)),
    [pitchHallFacilityGroups],
  );
  const addHomeDressingRoomSlot = useCallback(
    (facilityResourceId: string) =>
      setHomeDressingRoomSlot(resolveResourceSlot(dressingRoomFacilityGroups, facilityResourceId)),
    [dressingRoomFacilityGroups],
  );
  const addAwayDressingRoomSlot = useCallback(
    (facilityResourceId: string) =>
      setAwayDressingRoomSlot(resolveResourceSlot(dressingRoomFacilityGroups, facilityResourceId)),
    [dressingRoomFacilityGroups],
  );

  // ── Guided-progress nudge (compact, never blocks submission) ───────────
  const teamStepComplete = !!teamId;
  const homeAwayStepComplete = true; // always has a default
  const opponentStepComplete = !!selectedExternalClub || !!opponentName.trim();
  const terminStepComplete = !!startAt;

  const missingItems = useMemo(() => {
    const items: string[] = [];
    if (!teamId) items.push("Team auswählen");
    if (!selectedExternalClub && !opponentName.trim()) items.push("Gegner angeben");
    if (!startAt) items.push("Termin angeben");
    if (homeAway === "HOME" && startAt) {
      if (!pitchSlot) items.push("Spielfeld / Halle zuweisen");
      if (!homeDressingRoomSlot) items.push("Garderobe Heimteam zuweisen");
      if (!awayDressingRoomSlot) items.push("Garderobe Gastteam zuweisen");
    }
    return items;
  }, [teamId, selectedExternalClub, opponentName, startAt, homeAway, pitchSlot, homeDressingRoomSlot, awayDressingRoomSlot]);

  const hasRequiredFields =
    !!seasonId && !!teamId && (!!selectedExternalClub || !!opponentName.trim()) && !!startAt;
  const hasUnresolvedPartialFailure = !!result && !!partialError;
  const canSubmit = !submitting && !hasUnresolvedPartialFailure && hasRequiredFields;

  const submitLabel = canValidateDirectly ? "Freigeben & Match erstellen" : "Zur Prüfung einreichen";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (hasUnresolvedPartialFailure) return;
    if (!hasRequiredFields) {
      setError("Bitte alle erforderlichen Angaben ausfüllen.");
      return;
    }

    setSubmitting(true);
    setPartialError(null);

    const isHome = homeAway === "HOME";
    const plan: MatchCreationPlan = {
      homeAway,
      pitchCode: isHome ? pitchSlot?.code ?? null : null,
      homeDressingRoomCode: isHome ? homeDressingRoomSlot?.code ?? null : null,
      awayDressingRoomCode: isHome ? awayDressingRoomSlot?.code ?? null : null,
    };

    const effectiveOpponentName = getEffectiveOpponentDisplayName();
    const title = selectedTeam
      ? `${selectedTeam.name} vs. ${effectiveOpponentName}`
      : `Match vs. ${effectiveOpponentName}`;

    try {
      const orchestration = await orchestrateMatchCreation(plan, {
        createEvent: async () => {
          const res = await fetch("/api/events", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              type: "MATCH",
              source: "MANUAL",
              seasonId,
              teamId,
              title,
              location: location.trim() || null,
              startAt,
              endAt: endAt || null,
              opponentName: opponentName.trim() || null,
              opponentExternalClubId: selectedExternalClub?.id ?? null,
              homeAway,
              websiteVisible: true,
              infoboardVisible: true,
              homepageVisible: true,
              wochenplanVisible: true,
              trainingsplanVisible: false,
              teamPageVisible: true,
            }),
          });
          const data = (await res.json().catch(() => null)) as
            | { eventIds?: string[]; reviewStage?: string; allowsDirectExecution?: boolean; error?: string }
            | null;
          if (!res.ok || !data?.eventIds?.[0]) {
            throw new Error(data?.error ?? "Match konnte nicht erstellt werden.");
          }
          return {
            eventId: data.eventIds[0],
            reviewStage: data.reviewStage ?? "SUBMITTED",
            allowsDirectExecution: !!data.allowsDirectExecution,
          };
        },
        updateOperationalFields: async (eventId, fields) => {
          const res = await fetch(`/api/matchcenter/${eventId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(fields),
          });
          const data = (await res.json().catch(() => null)) as { error?: string } | null;
          if (!res.ok) {
            throw new Error(data?.error ?? "Zuteilung konnte nicht gespeichert werden.");
          }
        },
      });

      setResult({ eventId: orchestration.eventId });

      if (!orchestration.ok) {
        setPartialError(orchestration.operationalFieldsError);
        return;
      }

      router.push("/dashboard/matchcenter?submitted=1");
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Match konnte nicht erstellt werden.");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5" data-testid="match-create-form">
      {missingItems.length > 0 ? (
        <div className="fca-status-box fca-status-box-muted text-sm" data-testid="match-create-guided-progress">
          <p className="font-semibold">
            Noch {missingItems.length} {missingItems.length === 1 ? "Angabe fehlt" : "Angaben fehlen"}
          </p>
          <ul className="mt-1.5 list-inside list-disc space-y-0.5" data-testid="match-create-guided-progress-list">
            {missingItems.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="fca-status-box fca-status-box-success text-sm" data-testid="match-create-guided-progress">
          Alle Angaben vollständig — bereit zum Einreichen.
        </div>
      )}

      <div className="divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
        <GuidedStep
          index={1}
          title="Team"
          hint="Das FC-Allschwil-Team für dieses Match."
          complete={teamStepComplete}
          collapsed={teamCollapsed}
          summary={selectedTeam ? formatTeamLabel(selectedTeam) : undefined}
          onExpand={() => setTeamCollapsed(false)}
          onBlurCapture={(e) => handleStepBlur(e, teamStepComplete, () => setTeamCollapsed(true))}
        >
          <label className="block space-y-1">
            <span className="fca-label">Team</span>
            {!loadingTeams && teamOptions.length === 0 ? (
              <p className="mt-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400">
                Kein Team mit Schreibzugriff verfügbar. Bitte wenden Sie sich an die Koordination.
              </p>
            ) : (
              <select
                value={teamId}
                onChange={(e) => setTeamId(e.target.value)}
                className="fca-select"
                required
                disabled={loadingTeams}
                data-testid="match-create-team-select"
              >
                <option value="">{loadingTeams ? "Teams laden…" : "— Auswählen —"}</option>
                {teamOptions.map((t) => (
                  <option key={t.id} value={t.id}>
                    {formatTeamLabel(t)}
                  </option>
                ))}
              </select>
            )}
          </label>
        </GuidedStep>

        <GuidedStep
          index={2}
          title="Heim / Auswärts"
          hint="Bestimmt, ob Spielfeld/Halle und Garderoben zugewiesen werden."
          complete={homeAwayStepComplete}
          collapsed={homeAwayCollapsed}
          summary={homeAway === "HOME" ? "Heim (FC Allschwil ausrichtend)" : "Auswärts (extern ausgerichtet)"}
          onExpand={() => setHomeAwayCollapsed(false)}
          onBlurCapture={(e) => handleStepBlur(e, homeAwayStepComplete, () => setHomeAwayCollapsed(true))}
        >
          <div className="flex gap-1.5" role="radiogroup" aria-label="Heim / Auswärts">
            <button
              type="button"
              onClick={() => setHomeAway("HOME")}
              aria-pressed={homeAway === "HOME"}
              data-testid="match-create-home-away-home"
              className={homeAway === "HOME" ? "fca-button-primary text-xs" : "fca-button-secondary text-xs"}
            >
              Heim
            </button>
            <button
              type="button"
              onClick={() => setHomeAway("AWAY")}
              aria-pressed={homeAway === "AWAY"}
              data-testid="match-create-home-away-away"
              className={homeAway === "AWAY" ? "fca-button-primary text-xs" : "fca-button-secondary text-xs"}
            >
              Auswärts
            </button>
          </div>

          <div className="mt-3">
            <span className="fca-label">Ort</span>
            <input
              type="text"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
              className="fca-input mt-1"
              placeholder="z. B. Sportanlage Brüel"
              data-testid="match-create-location"
            />
            {homeAway === "HOME" && facilityNameQuickPicks.length > 0 ? (
              <div className="mt-1.5 flex flex-wrap gap-1.5">
                {facilityNameQuickPicks.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setLocation(name)}
                    data-testid={`match-create-location-quickpick-${name}`}
                    className="inline-flex items-center gap-1 rounded-full bg-[var(--surface-2)] px-2.5 py-1 text-xs text-[var(--text-2)] hover:bg-[var(--surface)]"
                  >
                    <Building2 className="h-3 w-3" aria-hidden />
                    {name}
                  </button>
                ))}
              </div>
            ) : null}
          </div>
        </GuidedStep>

        <GuidedStep
          index={3}
          title="Gegner"
          hint="Aus dem Vereinsverzeichnis auswählen oder frei erfassen — Anzeigename bleibt editierbar."
          complete={opponentStepComplete}
          collapsed={opponentCollapsed}
          summary={getEffectiveOpponentDisplayName() || undefined}
          onExpand={() => setOpponentCollapsed(false)}
          onBlurCapture={(e) => handleStepBlur(e, opponentStepComplete, () => setOpponentCollapsed(true))}
        >
          <div className="grid gap-3 md:grid-cols-2">
            <div className="block space-y-1">
              <span className="fca-label">Aus Vereinsverzeichnis</span>
              <ExternalClubPicker
                selected={selectedExternalClub}
                onSelect={handleSelectExternalClub}
                onClearSelected={() => setSelectedExternalClub(null)}
                placeholder="Verein suchen…"
                testId="match-create-opponent-club-search"
              />
            </div>

            <label className="block space-y-1">
              <span className="fca-label">
                Anzeigename{selectedExternalClub ? " (optional)" : ""}
              </span>
              <input
                type="text"
                value={opponentName}
                onChange={(e) => setOpponentName(e.target.value)}
                className="fca-input"
                placeholder={
                  selectedExternalClub
                    ? `Leer lassen für «${selectedExternalClub.name}»`
                    : "z. B. FC Concordia Basel"
                }
                required={!selectedExternalClub}
                data-testid="match-create-opponent-name"
              />
            </label>
          </div>
        </GuidedStep>

        <GuidedStep
          index={4}
          title="Termin"
          hint="Start- und Endzeit des Matches."
          complete={terminStepComplete}
          collapsed={terminCollapsed}
          summary={startAt ? `${startAt}${endAt ? ` – ${endAt}` : ""}` : undefined}
          onExpand={() => setTerminCollapsed(false)}
          onBlurCapture={(e) => handleStepBlur(e, terminStepComplete, () => setTerminCollapsed(true))}
        >
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block space-y-1">
              <span className="fca-label">Start</span>
              <input
                type="datetime-local"
                value={startAt}
                onChange={(e) => setStartAt(e.target.value)}
                className="fca-input"
                required
                data-testid="match-create-start-at"
              />
            </label>
            <label className="block space-y-1">
              <span className="fca-label">Ende</span>
              <input
                type="datetime-local"
                value={endAt}
                onChange={(e) => setEndAt(e.target.value)}
                className="fca-input"
                data-testid="match-create-end-at"
              />
            </label>
          </div>
        </GuidedStep>

        {homeAway === "HOME" ? (
          <>
            <div className="px-4 py-3">
              <div className="mb-3 flex items-center gap-2.5">
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[var(--border-strong)] text-[0.7rem] font-semibold text-[var(--text-2)]"
                  aria-hidden
                >
                  5
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-semibold text-[var(--foreground)]">Spielfeld / Halle</h2>
                  <p className="text-xs text-[var(--text-2)]">Für Heimspiele — wähle den Platz direkt aus.</p>
                </div>
              </div>
              <div className="pl-[2.125rem]">
                <VisualResourceAvailabilityPicker
                  facilityGroups={pitchHallFacilityGroups}
                  selectedResourceIds={pitchSlot ? new Set([pitchSlot.facilityResourceId]) : new Set()}
                  onSelect={addPitchSlot}
                  onDeselect={() => setPitchSlot(null)}
                  availabilityByResourceId={pitchAvailability}
                  singleSelect
                  testId="match-create-pitch"
                />
              </div>
            </div>

            <div className="px-4 py-3">
              <div className="mb-3 flex items-center gap-2.5">
                <span
                  className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[var(--border-strong)] text-[0.7rem] font-semibold text-[var(--text-2)]"
                  aria-hidden
                >
                  6
                </span>
                <div className="min-w-0 flex-1">
                  <h2 className="text-sm font-semibold text-[var(--foreground)]">Garderoben</h2>
                  <p className="text-xs text-[var(--text-2)]">Heim- und Gastkabine zuweisen.</p>
                </div>
              </div>
              <div className="space-y-4 pl-[2.125rem]">
                <VisualDressingRoomPicker
                  facilityGroups={dressingRoomFacilityGroups}
                  selectedResourceIds={homeDressingRoomSlot ? new Set([homeDressingRoomSlot.facilityResourceId]) : new Set()}
                  onSelect={addHomeDressingRoomSlot}
                  onDeselect={() => setHomeDressingRoomSlot(null)}
                  availabilityByResourceId={dressingRoomAvailability}
                  label={`Heimkabine${selectedTeam ? ` (${selectedTeam.name})` : ""}`}
                  singleSelect
                  testId="match-create-home-dressing-room"
                />
                <VisualDressingRoomPicker
                  facilityGroups={dressingRoomFacilityGroups}
                  selectedResourceIds={awayDressingRoomSlot ? new Set([awayDressingRoomSlot.facilityResourceId]) : new Set()}
                  onSelect={addAwayDressingRoomSlot}
                  onDeselect={() => setAwayDressingRoomSlot(null)}
                  availabilityByResourceId={dressingRoomAvailability}
                  label={`Gastkabine${getEffectiveOpponentDisplayName() ? ` (${getEffectiveOpponentDisplayName()})` : ""}`}
                  singleSelect
                  testId="match-create-away-dressing-room"
                />
              </div>
            </div>
          </>
        ) : null}

        <div className="px-4 py-3">
          <div className="mb-2.5 flex items-center gap-2.5">
            <span
              className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[var(--border-strong)] text-[0.7rem] font-semibold text-[var(--text-2)]"
              aria-hidden
            >
              {homeAway === "HOME" ? 7 : 5}
            </span>
            <h2 className="text-sm font-semibold text-[var(--foreground)]">Prüfen &amp; Einreichen</h2>
          </div>
          <dl className="grid gap-x-6 gap-y-1.5 pl-[2.125rem] text-sm md:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Team</dt>
              <dd className="text-[var(--foreground)]">{selectedTeam ? formatTeamLabel(selectedTeam) : "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Heim / Auswärts</dt>
              <dd className="text-[var(--foreground)]">{homeAway === "HOME" ? "Heim" : "Auswärts"}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Ort</dt>
              <dd className="text-[var(--foreground)]">{location || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Gegner</dt>
              <dd className="text-[var(--foreground)]">{getEffectiveOpponentDisplayName() || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Termin</dt>
              <dd className="text-[var(--foreground)]">{startAt ? `${startAt}${endAt ? ` – ${endAt}` : ""}` : "—"}</dd>
            </div>
            {homeAway === "HOME" ? (
              <>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Spielfeld / Halle</dt>
                  <dd className="text-[var(--foreground)]">{pitchSlot?.facilityResourceName ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Garderoben</dt>
                  <dd className="text-[var(--foreground)]">
                    {[homeDressingRoomSlot?.facilityResourceName, awayDressingRoomSlot?.facilityResourceName]
                      .filter(Boolean)
                      .join(" · ") || "—"}
                  </dd>
                </div>
              </>
            ) : null}
          </dl>

          <div
            className={canValidateDirectly ? "fca-status-box fca-status-box-muted ml-[2.125rem] mt-3 text-xs" : "fca-status-box fca-status-box-warn ml-[2.125rem] mt-3 text-xs"}
            data-testid="match-create-validation-note"
          >
            {canValidateDirectly
              ? `Mit „${submitLabel}“ wird das Match sofort erstellt und freigegeben (Berechtigung zur direkten Veröffentlichung vorhanden).`
              : `Mit „${submitLabel}“ wird das Match zur Prüfung eingereicht — die Veröffentlichung erfolgt erst nach Freigabe durch eine Person mit Freigaberecht.`}
          </div>
        </div>
      </div>

      {result && partialError ? (
        <div className="fca-status-box fca-status-box-warn text-sm" data-testid="match-create-partial-warning">
          <p className="font-semibold">Match wurde erstellt, aber Spielfeld/Garderobe konnten nicht gespeichert werden.</p>
          <p className="mt-1">{partialError}</p>
          <p className="mt-2 text-xs text-[var(--text-2)]">
            „{submitLabel}“ ist deaktiviert, um ein doppeltes Match zu vermeiden — bitte die Zuteilung direkt am
            bereits angelegten Match nachtragen.
          </p>
          <button
            type="button"
            onClick={() => router.push(`/dashboard/matchcenter/${result.eventId}`)}
            className="fca-button-secondary mt-3"
            data-testid="match-create-goto-detail"
          >
            Zum Match wechseln und korrigieren
          </button>
        </div>
      ) : null}

      {error ? <div className="fca-status-box fca-status-box-error">{error}</div> : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={!canSubmit}
          data-testid="match-create-submit"
          title={
            hasUnresolvedPartialFailure
              ? 'Match wurde bereits angelegt — bitte über "Zum Match wechseln und korrigieren" fortsetzen.'
              : undefined
          }
          className="fca-button-primary"
        >
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Wird erstellt…
            </>
          ) : (
            submitLabel
          )}
        </button>

        <button type="button" onClick={() => router.push("/dashboard/matchcenter")} className="fca-button-secondary">
          Abbrechen
        </button>
      </div>
      <p className="sr-only" id={`${formId}-hint`}>
        Team, Gegner und Termin sind erforderlich, um ein Match zu erstellen.
      </p>
    </form>
  );
}
