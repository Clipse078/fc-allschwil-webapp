"use client";

/**
 * components/admin/matchcenter/MatchGuidedCreateForm.tsx
 *
 * PLANNING-CREATION-UX-01C — guided MatchCenter creation workflow.
 *
 * Replaces the generic MatchEventCreateForm on /dashboard/events/matches/new
 * with a single, compact guided form, following the SAME collapsible
 * numbered-row pattern proven by TrainingSeriesCreateForm
 * (PLANNING-CREATION-UX-01B-C1) and TournamentCreateForm:
 *
 *   1 · Team           — tenant Team
 *   2 · Heim/Auswärts  — Heim or Auswärts
 *   3 · Ort            — Sportanlage (where configured) + editable location text
 *   4 · Gegner         — Club-Directory opponent + editable display name
 *   5 · Termin         — date + start/end time
 *   6 · Spielfeld/Halle — HOME ONLY, live Frei/Belegt (canonical FacilityResource)
 *   7 · Garderobe       — HOME ONLY, live Frei/Belegt (Heim + Auswärts room)
 *   8 · Prüfen & Einreichen — summary + Freigeben / Zur Freigabe einreichen
 *
 * Preserves the EXISTING canonical architecture end to end:
 *   - Still posts to the EXISTING POST /api/events (type="MATCH", source="MANUAL")
 *     — the same endpoint MatchEventCreateForm always used, including its
 *     EXISTING review-decision logic (lib/workflow/event-review-policy.ts).
 *     This form never invents a new lifecycle/state; the "Freigeben & Match
 *     erstellen" vs. "Zur Freigabe einreichen" label simply reflects what the
 *     server will do (see canValidateDirectly prop, computed in the page the
 *     same way the API route computes it server-side).
 *   - Opponent selection reuses the EXISTING GET /api/club-directory/teams
 *     (Club Directory ExternalTeam/ExternalClub) purely as a name picker.
 *     Event.opponentName remains a plain, tenant-editable display string —
 *     no ExternalTeam FK exists on Event and none is introduced here. The
 *     existing external-team/provider-sync architecture (MatchExternalMapping,
 *     SFV sync) is untouched; this only prefills a name an admin can edit.
 *   - Spielfeld/Halle + Garderobe (HOME only) reuse the EXISTING
 *     PLANNING-CREATION-UX-01A GET /api/facilities/availability endpoint for
 *     live Frei/Belegt, and are persisted via the EXISTING
 *     PATCH /api/matchcenter/[matchId] pitchCode/homeDressingRoomCode/
 *     awayDressingRoomCode fields (same fields MatchcenterDetailOperational
 *     already edits) — NOT the canonical FacilityResource id. See the
 *     AVAILABILITY INTEGRITY note below.
 *
 * AVAILABILITY INTEGRITY (read before touching persistence):
 *   lib/facilities/availability-service.ts still matches Match bookings by
 *   FacilityResource.code (Event.pitchCode / homeDressingRoomCode /
 *   awayDressingRoomCode are legacy Wochenplan V1 string fields, unlike
 *   Training/Tournament which already reference FacilityResource ids
 *   directly). This form intentionally keeps writing the resolved `code` of
 *   the chosen FacilityResource — NOT its id — so newly created matches stay
 *   visible to the EXISTING availability engine. Migrating Match to
 *   canonical FacilityResource id references would require a schema/data
 *   migration and is explicitly out of scope here (see task notes / PR
 *   description "known limitations").
 */

import { useEffect, useId, useMemo, useState } from "react";
import type { FocusEvent, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Check } from "lucide-react";
import type { FacilityGroup, ResourceAvailabilityAnnotation } from "@/components/admin/training/FacilityResourceSelector";
import { zonedTimeToUtc } from "@/lib/training/recurrence";

// ── Types ──────────────────────────────────────────────────────────────────

type TeamOption = {
  id: string;
  name: string;
  ageGroup: string | null;
  genderGroup: string | null;
};

type ExternalTeamOption = {
  id: string;
  name: string;
  shortName: string | null;
  categoryLabel: string | null;
  externalClub: { id: string; name: string; shortName: string | null };
};

type SeasonOption = { id: string; key: string; name: string; isActive: boolean };

/** Shape of one row in GET /api/facilities/availability's `availability` array. */
type ResourceAvailabilityRow = ResourceAvailabilityAnnotation & { resourceId: string; resourceName: string };

type MatchGuidedCreateFormProps = {
  pitchHallFacilityGroups: FacilityGroup[];
  dressingRoomFacilityGroups: FacilityGroup[];
  /**
   * Whether the current user's EXISTING event-review capabilities
   * (events.publish_website / events.publish_infoboard) allow a newly
   * created match to be approved directly, computed server-side the same
   * way POST /api/events computes it. Purely informational — the submit
   * button is never disabled by this; the server route is the only
   * authority over what actually happens.
   */
  canValidateDirectly: boolean;
};

const DEFAULT_MATCH_TIMEZONE = "Europe/Zurich";

/** Compact scan line: "N frei · M belegt" for a set of resources given a live availability map. */
function AvailabilityScanLine({
  resources,
  availability,
  ready,
}: {
  resources: { id: string }[];
  availability: Map<string, ResourceAvailabilityAnnotation>;
  ready: boolean;
}) {
  if (!ready || resources.length === 0) {
    return <p className="text-xs text-[var(--text-2)]">Verfügbarkeit erscheint nach Datum &amp; Zeit.</p>;
  }
  let free = 0;
  let occupied = 0;
  for (const r of resources) {
    const a = availability.get(r.id);
    if (!a) continue;
    if (a.status === "OCCUPIED") occupied += 1;
    else free += 1;
  }
  if (free + occupied === 0) {
    return <p className="text-xs text-[var(--text-2)]">Verfügbarkeit erscheint nach Datum &amp; Zeit.</p>;
  }
  return (
    <p className="text-xs">
      <span className="font-medium text-emerald-600">{free} frei</span>
      <span className="text-[var(--text-2)]"> · </span>
      <span className="font-medium text-rose-600">{occupied} belegt</span>
    </p>
  );
}

function formatClockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit" });
}

function availabilitySuffix(annotation: ResourceAvailabilityAnnotation | undefined): string {
  if (!annotation) return "";
  if (annotation.status === "FREE") return " — Frei";
  const timeRange =
    annotation.conflictStartAt && annotation.conflictEndAt
      ? ` · ${formatClockTime(annotation.conflictStartAt)}–${formatClockTime(annotation.conflictEndAt)}`
      : "";
  return ` — Belegt${annotation.conflictLabel ? ` · ${annotation.conflictLabel}` : ""}${timeRange}`;
}

/**
 * Single-value resource picker for exactly one Spielfeld/Halle or one
 * Garderobe slot (Match persists at most one pitch + one home/away dressing
 * room each — unlike Training's multi-resource allocation list). Reuses the
 * same optgroup-by-facility + live Frei/Belegt annotation convention as
 * FacilityResourceSelector, just for a single <select>.
 */
function SingleResourceSelect({
  facilityGroups,
  value,
  onChange,
  availability,
  placeholder,
  testId,
  excludeResourceId,
}: {
  facilityGroups: FacilityGroup[];
  value: string;
  onChange: (resourceId: string) => void;
  availability: Map<string, ResourceAvailabilityAnnotation>;
  placeholder: string;
  testId: string;
  /** Excludes a resource already chosen elsewhere (e.g. the home room from the away room's options). */
  excludeResourceId?: string;
}) {
  const totalResourceCount = facilityGroups.reduce((sum, fg) => sum + fg.resources.length, 0);
  if (totalResourceCount === 0) {
    return (
      <p className="text-sm italic text-[var(--text-2)]" data-testid={`${testId}-no-resources`}>
        Keine Ressourcen dieses Typs konfiguriert.
      </p>
    );
  }
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="fca-select"
      data-testid={testId}
    >
      <option value="">{placeholder}</option>
      {facilityGroups.map((fg) => (
        <optgroup key={fg.facilityId} label={fg.facilityName}>
          {fg.resources
            .filter((r) => r.id !== excludeResourceId)
            .map((r) => (
              <option key={r.id} value={r.id}>
                {r.name}
                {availabilitySuffix(availability.get(r.id))}
              </option>
            ))}
        </optgroup>
      ))}
    </select>
  );
}

/** Collapses a step to a one-line summary once its own fields are complete and focus moves elsewhere. */
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

// ── Component ─────────────────────────────────────────────────────────────

export default function MatchGuidedCreateForm({
  pitchHallFacilityGroups,
  dressingRoomFacilityGroups,
  canValidateDirectly,
}: MatchGuidedCreateFormProps) {
  const router = useRouter();
  const formId = useId();

  // ── 1 · Team ────────────────────────────────────────────────────────────
  const [teams, setTeams] = useState<TeamOption[]>([]);
  const [teamsLoading, setTeamsLoading] = useState(true);
  const [teamId, setTeamId] = useState("");
  const [teamCollapsed, setTeamCollapsed] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadTeams() {
      try {
        const res = await fetch("/api/teams", { cache: "no-store" });
        const data = (await res.json().catch(() => null)) as TeamOption[] | null;
        if (!active || !res.ok || !Array.isArray(data)) return;
        setTeams(data);
      } finally {
        if (active) setTeamsLoading(false);
      }
    }
    loadTeams();
    return () => {
      active = false;
    };
  }, []);

  const selectedTeam = useMemo(() => teams.find((t) => t.id === teamId) ?? null, [teams, teamId]);
  const teamStepComplete = !!teamId;

  // ── Season (technical prerequisite, not a user-facing step) ─────────────
  const [seasonId, setSeasonId] = useState("");
  useEffect(() => {
    let active = true;
    async function loadSeasons() {
      const res = await fetch("/api/seasons", { cache: "no-store" });
      const data = (await res.json().catch(() => null)) as { seasons?: SeasonOption[] } | null;
      if (!active || !res.ok || !data?.seasons) return;
      const preferred = data.seasons.find((s) => s.isActive) ?? data.seasons[0] ?? null;
      setSeasonId(preferred?.id ?? "");
    }
    loadSeasons();
    return () => {
      active = false;
    };
  }, []);

  // ── 2 · Heim / Auswärts ─────────────────────────────────────────────────
  const [homeAway, setHomeAway] = useState<"HOME" | "AWAY">("HOME");
  const isHome = homeAway === "HOME";

  // ── 3 · Ort ─────────────────────────────────────────────────────────────
  const facilityOptions = useMemo(() => {
    const byName = new Map<string, string>();
    for (const fg of [...pitchHallFacilityGroups, ...dressingRoomFacilityGroups]) {
      byName.set(fg.facilityId, fg.facilityName);
    }
    return Array.from(byName, ([facilityId, facilityName]) => ({ facilityId, facilityName }));
  }, [pitchHallFacilityGroups, dressingRoomFacilityGroups]);

  const [location, setLocation] = useState("");
  const [locationCollapsed, setLocationCollapsed] = useState(false);
  const ortStepComplete = !!location.trim();

  // ── 4 · Gegner ──────────────────────────────────────────────────────────
  const [externalTeams, setExternalTeams] = useState<ExternalTeamOption[]>([]);
  const [externalTeamsLoading, setExternalTeamsLoading] = useState(true);
  const [selectedExternalTeamId, setSelectedExternalTeamId] = useState("");
  const [opponentName, setOpponentName] = useState("");
  const [opponentCollapsed, setOpponentCollapsed] = useState(false);

  useEffect(() => {
    let active = true;
    async function loadExternalTeams() {
      try {
        const res = await fetch("/api/club-directory/teams", { cache: "no-store" });
        const data = (await res.json().catch(() => null)) as { teams?: ExternalTeamOption[] } | null;
        if (!active || !res.ok || !data?.teams) return;
        setExternalTeams(data.teams);
      } finally {
        if (active) setExternalTeamsLoading(false);
      }
    }
    loadExternalTeams();
    return () => {
      active = false;
    };
  }, []);

  const opponentGroupedByClub = useMemo(() => {
    const groups = new Map<string, { clubName: string; teams: ExternalTeamOption[] }>();
    for (const t of externalTeams) {
      const key = t.externalClub.id;
      if (!groups.has(key)) groups.set(key, { clubName: t.externalClub.name, teams: [] });
      groups.get(key)!.teams.push(t);
    }
    return Array.from(groups.values());
  }, [externalTeams]);

  const gegnerStepComplete = !!opponentName.trim();

  // ── 5 · Termin ──────────────────────────────────────────────────────────
  const [date, setDate] = useState("");
  const [startsAt, setStartsAt] = useState("");
  const [endsAt, setEndsAt] = useState("");
  const [terminCollapsed, setTerminCollapsed] = useState(false);
  const timesValid = !!startsAt && !!endsAt && startsAt < endsAt;
  const terminStepComplete = !!date && timesValid;

  // ── 6/7 · Spielfeld/Halle + Garderobe (HOME ONLY) ──────────────────────
  const [pitchResourceId, setPitchResourceId] = useState("");
  const [homeDressingResourceId, setHomeDressingResourceId] = useState("");
  const [awayDressingResourceId, setAwayDressingResourceId] = useState("");

  const [pitchAvailability, setPitchAvailability] = useState<Map<string, ResourceAvailabilityAnnotation>>(new Map());
  const [dressingRoomAvailability, setDressingRoomAvailability] = useState<Map<string, ResourceAvailabilityAnnotation>>(
    new Map(),
  );

  useEffect(() => {
    if (!isHome || !date || !timesValid) {
      setPitchAvailability(new Map());
      setDressingRoomAvailability(new Map());
      return;
    }

    let active = true;
    const startAtIso = zonedTimeToUtc(date, startsAt, DEFAULT_MATCH_TIMEZONE).toISOString();
    const endAtIso = zonedTimeToUtc(date, endsAt, DEFAULT_MATCH_TIMEZONE).toISOString();

    async function loadAvailability() {
      const params = new URLSearchParams({ startAt: startAtIso, endAt: endAtIso });

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
  }, [isHome, date, startsAt, endsAt, timesValid]);

  // Reset HOME-only allocation state when switching to AWAY, so a stale
  // pitch/dressing-room selection from a previous HOME edit is never
  // silently submitted for an AWAY match.
  useEffect(() => {
    if (!isHome) {
      setPitchResourceId("");
      setHomeDressingResourceId("");
      setAwayDressingResourceId("");
    }
  }, [isHome]);

  function resolveResourceCode(facilityGroups: FacilityGroup[], resourceId: string): string | null {
    for (const group of facilityGroups) {
      const resource = group.resources.find((r) => r.id === resourceId);
      if (resource) return resource.code;
    }
    return null;
  }

  function resolveResourceName(facilityGroups: FacilityGroup[], resourceId: string): string {
    for (const group of facilityGroups) {
      const resource = group.resources.find((r) => r.id === resourceId);
      if (resource) return resource.name;
    }
    return "";
  }

  // ── Submission ───────────────────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ eventId: string; allowsDirectExecution: boolean } | null>(null);
  const [allocationWarning, setAllocationWarning] = useState<string | null>(null);

  const missingItems = useMemo(() => {
    const items: string[] = [];
    if (!teamId) items.push("Team auswählen");
    if (!location.trim()) items.push("Ort angeben");
    if (!opponentName.trim()) items.push("Gegner angeben");
    if (!date) items.push("Datum auswählen");
    if (!timesValid) items.push("Start-/Endzeit angeben (Start vor Ende)");
    if (isHome && date && timesValid) {
      if (!pitchResourceId) items.push("Spielfeld / Halle zuweisen");
      if (!homeDressingResourceId) items.push("Heim-Garderobe zuweisen");
      if (!awayDressingResourceId) items.push("Auswärts-Garderobe zuweisen");
    }
    return items;
  }, [teamId, location, opponentName, date, timesValid, isHome, pitchResourceId, homeDressingResourceId, awayDressingResourceId]);

  const hasRequiredFields = !!teamId && !!location.trim() && !!opponentName.trim() && !!date && timesValid && !!seasonId;
  const canSubmit = !submitting && hasRequiredFields;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setAllocationWarning(null);

    if (!hasRequiredFields) {
      setError("Bitte alle erforderlichen Angaben ausfüllen.");
      return;
    }

    setSubmitting(true);

    try {
      const startAtIso = zonedTimeToUtc(date, startsAt, DEFAULT_MATCH_TIMEZONE).toISOString();
      const endAtIso = zonedTimeToUtc(date, endsAt, DEFAULT_MATCH_TIMEZONE).toISOString();
      const title = `${selectedTeam ? selectedTeam.name : "Match"} vs. ${opponentName.trim()}`;

      const createRes = await fetch("/api/events", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          type: "MATCH",
          source: "MANUAL",
          seasonId,
          teamId,
          title,
          location: location.trim(),
          startAt: startAtIso,
          endAt: endAtIso,
          opponentName: opponentName.trim(),
          homeAway,
          websiteVisible: true,
          infoboardVisible: true,
          homepageVisible: true,
          wochenplanVisible: true,
          trainingsplanVisible: false,
          teamPageVisible: true,
        }),
      });

      const createData = (await createRes.json().catch(() => null)) as
        | { eventIds?: string[]; allowsDirectExecution?: boolean; error?: string }
        | null;

      if (!createRes.ok || !createData?.eventIds?.[0]) {
        throw new Error(createData?.error ?? "Match konnte nicht erstellt werden.");
      }

      const eventId = createData.eventIds[0];
      const allowsDirectExecution = !!createData.allowsDirectExecution;

      // HOME ONLY: attach Spielfeld/Halle + Garderobe via the EXISTING
      // pitchCode/homeDressingRoomCode/awayDressingRoomCode PATCH — resolved
      // to FacilityResource.code (see AVAILABILITY INTEGRITY module doc).
      let localAllocationWarning: string | null = null;
      if (isHome && (pitchResourceId || homeDressingResourceId || awayDressingResourceId)) {
        const patchBody: Record<string, string | null> = {};
        if (pitchResourceId) patchBody.pitchCode = resolveResourceCode(pitchHallFacilityGroups, pitchResourceId);
        if (homeDressingResourceId)
          patchBody.homeDressingRoomCode = resolveResourceCode(dressingRoomFacilityGroups, homeDressingResourceId);
        if (awayDressingResourceId)
          patchBody.awayDressingRoomCode = resolveResourceCode(dressingRoomFacilityGroups, awayDressingResourceId);

        const patchRes = await fetch(`/api/matchcenter/${eventId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(patchBody),
        });

        if (!patchRes.ok) {
          const patchData = (await patchRes.json().catch(() => null)) as { error?: string } | null;
          localAllocationWarning = `Match wurde erstellt, aber Spielfeld/Garderobe konnten nicht zugewiesen werden: ${patchData?.error ?? "Unbekannter Fehler"}. Bitte direkt am Match nachtragen.`;
          setAllocationWarning(localAllocationWarning);
        }
      }

      setResult({ eventId, allowsDirectExecution });

      if (!localAllocationWarning) {
        router.push("/dashboard/matchcenter?submitted=1");
        router.refresh();
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Match konnte nicht erstellt werden.");
    } finally {
      setSubmitting(false);
    }
  }

  const submitLabel = canValidateDirectly ? "Freigeben & Match erstellen" : "Zur Freigabe einreichen";

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
        {/* 1 · Team */}
        <GuidedStep
          index={1}
          title="Team"
          hint="Tenant-Team, für das dieses Match erfasst wird."
          complete={teamStepComplete}
          collapsed={teamCollapsed}
          summary={selectedTeam ? selectedTeam.name : undefined}
          onExpand={() => setTeamCollapsed(false)}
          onBlurCapture={(e) => handleStepBlur(e, teamStepComplete, () => setTeamCollapsed(true))}
        >
          <label className="block space-y-1">
            <span className="fca-label">Team</span>
            <select
              value={teamId}
              onChange={(e) => setTeamId(e.target.value)}
              className="fca-select"
              required
              disabled={teamsLoading}
              data-testid="match-create-team-select"
            >
              <option value="">{teamsLoading ? "Teams laden…" : "— Auswählen —"}</option>
              {teams.map((t) => (
                <option key={t.id} value={t.id}>
                  {t.name}
                  {t.ageGroup ? ` · ${t.ageGroup}` : ""}
                </option>
              ))}
            </select>
          </label>
        </GuidedStep>

        {/* 2 · Heim / Auswärts */}
        <div className="px-4 py-3">
          <div className="flex items-center gap-2.5">
            <span
              className={
                "flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[0.7rem] font-semibold " +
                "bg-[var(--sce-primary)] text-white"
              }
              aria-hidden
            >
              <Check className="h-3.5 w-3.5" />
            </span>
            <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-2">
              <h2 className="text-sm font-semibold text-[var(--foreground)]">Heim / Auswärts</h2>
              <div className="flex gap-1.5" role="radiogroup" aria-label="Heim / Auswärts">
                <button
                  type="button"
                  onClick={() => setHomeAway("HOME")}
                  aria-pressed={isHome}
                  data-testid="match-create-home"
                  className={isHome ? "fca-button-primary text-xs" : "fca-button-secondary text-xs"}
                >
                  Heim
                </button>
                <button
                  type="button"
                  onClick={() => setHomeAway("AWAY")}
                  aria-pressed={!isHome}
                  data-testid="match-create-away"
                  className={!isHome ? "fca-button-primary text-xs" : "fca-button-secondary text-xs"}
                >
                  Auswärts
                </button>
              </div>
            </div>
          </div>
          <p className="mt-1.5 pl-[2.125rem] text-xs text-[var(--text-2)]">
            {isHome
              ? "Heimspiel — Spielfeld/Halle und Garderobe werden weiter unten zugewiesen."
              : "Auswärtsspiel — keine Spielfeld- oder Garderobenzuweisung durch diesen Verein."}
          </p>
        </div>

        {/* 3 · Ort */}
        <GuidedStep
          index={3}
          title="Ort"
          hint="Sportanlage bzw. Spielort — Anzeigename ist frei editierbar."
          complete={ortStepComplete}
          collapsed={locationCollapsed}
          summary={location || undefined}
          onExpand={() => setLocationCollapsed(false)}
          onBlurCapture={(e) => handleStepBlur(e, ortStepComplete, () => setLocationCollapsed(true))}
        >
          <div className="grid gap-3 md:grid-cols-2">
            {facilityOptions.length > 0 ? (
              <label className="block space-y-1">
                <span className="fca-label">Sportanlage (optional)</span>
                <select
                  className="fca-select"
                  defaultValue=""
                  onChange={(e) => {
                    const facility = facilityOptions.find((f) => f.facilityId === e.target.value);
                    if (facility) setLocation(facility.facilityName);
                  }}
                  data-testid="match-create-facility-select"
                >
                  <option value="">— aus Anlagenliste übernehmen —</option>
                  {facilityOptions.map((f) => (
                    <option key={f.facilityId} value={f.facilityId}>
                      {f.facilityName}
                    </option>
                  ))}
                </select>
              </label>
            ) : null}
            <label className="block space-y-1">
              <span className="fca-label">Anzeigename</span>
              <input
                type="text"
                value={location}
                onChange={(e) => setLocation(e.target.value)}
                placeholder="z. B. Sportplatz im Brüel"
                className="fca-input"
                required
                data-testid="match-create-location"
              />
            </label>
          </div>
        </GuidedStep>

        {/* 4 · Gegner */}
        <GuidedStep
          index={4}
          title="Gegner"
          hint="Aus dem Club-Verzeichnis wählen — Anzeigename ist frei editierbar."
          complete={gegnerStepComplete}
          collapsed={opponentCollapsed}
          summary={opponentName || undefined}
          onExpand={() => setOpponentCollapsed(false)}
          onBlurCapture={(e) => handleStepBlur(e, gegnerStepComplete, () => setOpponentCollapsed(true))}
        >
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block space-y-1">
              <span className="fca-label">Aus Club-Verzeichnis (optional)</span>
              <select
                value={selectedExternalTeamId}
                onChange={(e) => {
                  const id = e.target.value;
                  setSelectedExternalTeamId(id);
                  const team = externalTeams.find((t) => t.id === id);
                  if (team) setOpponentName(team.name);
                }}
                className="fca-select"
                disabled={externalTeamsLoading}
                data-testid="match-create-opponent-select"
              >
                <option value="">{externalTeamsLoading ? "Vereine laden…" : "— Auswählen —"}</option>
                {opponentGroupedByClub.map((group) => (
                  <optgroup key={group.clubName} label={group.clubName}>
                    {group.teams.map((t) => (
                      <option key={t.id} value={t.id}>
                        {t.name}
                      </option>
                    ))}
                  </optgroup>
                ))}
              </select>
            </label>
            <label className="block space-y-1">
              <span className="fca-label">Anzeigename</span>
              <input
                type="text"
                value={opponentName}
                onChange={(e) => setOpponentName(e.target.value)}
                placeholder="z. B. FC Concordia Basel"
                className="fca-input"
                required
                data-testid="match-create-opponent-name"
              />
            </label>
          </div>
        </GuidedStep>

        {/* 5 · Termin */}
        <GuidedStep
          index={5}
          title="Termin"
          hint="Datum und Uhrzeit des Matches."
          complete={terminStepComplete}
          collapsed={terminCollapsed}
          summary={date ? `${date} · ${startsAt}–${endsAt}` : undefined}
          onExpand={() => setTerminCollapsed(false)}
          onBlurCapture={(e) => handleStepBlur(e, terminStepComplete, () => setTerminCollapsed(true))}
        >
          <div className="grid gap-3 md:grid-cols-3">
            <label className="block space-y-1">
              <span className="fca-label">Datum</span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="fca-input"
                required
                data-testid="match-create-date"
              />
            </label>
            <label className="block space-y-1">
              <span className="fca-label">Start</span>
              <input
                type="time"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="fca-input"
                required
                data-testid="match-create-starts-at"
              />
            </label>
            <label className="block space-y-1">
              <span className="fca-label">Ende</span>
              <input
                type="time"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className="fca-input"
                required
                data-testid="match-create-ends-at"
              />
            </label>
          </div>
          {date && !timesValid ? <p className="mt-1 text-xs text-rose-600">Start muss vor Ende liegen.</p> : null}
        </GuidedStep>

        {/* 6 · Spielfeld / Halle — HOME ONLY */}
        {isHome ? (
          <div className="px-4 py-3">
            <div className="mb-2.5 flex items-center gap-2.5">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[var(--border-strong)] text-[0.7rem] font-semibold text-[var(--text-2)]" aria-hidden>
                6
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold text-[var(--foreground)]">Spielfeld / Halle</h2>
                <AvailabilityScanLine
                  resources={pitchHallFacilityGroups.flatMap((g) => g.resources)}
                  availability={pitchAvailability}
                  ready={!!date && timesValid}
                />
              </div>
            </div>
            <div className="pl-[2.125rem]">
              <SingleResourceSelect
                facilityGroups={pitchHallFacilityGroups}
                value={pitchResourceId}
                onChange={setPitchResourceId}
                availability={pitchAvailability}
                placeholder="Spielfeld / Halle auswählen…"
                testId="match-create-pitch-select"
              />
            </div>
          </div>
        ) : null}

        {/* 7 · Garderobe — HOME ONLY */}
        {isHome ? (
          <div className="px-4 py-3">
            <div className="mb-2.5 flex items-center gap-2.5">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[var(--border-strong)] text-[0.7rem] font-semibold text-[var(--text-2)]" aria-hidden>
                7
              </span>
              <div className="min-w-0 flex-1">
                <h2 className="text-sm font-semibold text-[var(--foreground)]">Garderobe</h2>
                <AvailabilityScanLine
                  resources={dressingRoomFacilityGroups.flatMap((g) => g.resources)}
                  availability={dressingRoomAvailability}
                  ready={!!date && timesValid}
                />
              </div>
            </div>
            <div className="grid gap-3 pl-[2.125rem] md:grid-cols-2">
              <label className="block space-y-1">
                <span className="fca-label">Heim-Garderobe</span>
                <SingleResourceSelect
                  facilityGroups={dressingRoomFacilityGroups}
                  value={homeDressingResourceId}
                  onChange={setHomeDressingResourceId}
                  availability={dressingRoomAvailability}
                  placeholder="Heim-Garderobe auswählen…"
                  testId="match-create-home-dressing-select"
                  excludeResourceId={awayDressingResourceId || undefined}
                />
              </label>
              <label className="block space-y-1">
                <span className="fca-label">Auswärts-Garderobe</span>
                <SingleResourceSelect
                  facilityGroups={dressingRoomFacilityGroups}
                  value={awayDressingResourceId}
                  onChange={setAwayDressingResourceId}
                  availability={dressingRoomAvailability}
                  placeholder="Auswärts-Garderobe auswählen…"
                  testId="match-create-away-dressing-select"
                  excludeResourceId={homeDressingResourceId || undefined}
                />
              </label>
            </div>
          </div>
        ) : null}

        {/* 8 · Prüfen & Einreichen */}
        <div className="px-4 py-3">
          <div className="mb-2.5 flex items-center gap-2.5">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[var(--border-strong)] text-[0.7rem] font-semibold text-[var(--text-2)]" aria-hidden>
              8
            </span>
            <h2 className="text-sm font-semibold text-[var(--foreground)]">Prüfen &amp; Einreichen</h2>
          </div>
          <dl className="grid gap-x-6 gap-y-1.5 pl-[2.125rem] text-sm md:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Team</dt>
              <dd className="text-[var(--foreground)]">{selectedTeam ? selectedTeam.name : "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Heim / Auswärts</dt>
              <dd className="text-[var(--foreground)]">{isHome ? "Heim" : "Auswärts"}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Ort</dt>
              <dd className="text-[var(--foreground)]">{location || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Gegner</dt>
              <dd className="text-[var(--foreground)]">{opponentName || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Termin</dt>
              <dd className="text-[var(--foreground)]">{date ? `${date} · ${startsAt}–${endsAt}` : "—"}</dd>
            </div>
            {isHome ? (
              <>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Spielfeld / Halle</dt>
                  <dd className="text-[var(--foreground)]">
                    {pitchResourceId ? resolveResourceName(pitchHallFacilityGroups, pitchResourceId) : "—"}
                  </dd>
                </div>
                <div>
                  <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Garderobe</dt>
                  <dd className="text-[var(--foreground)]">
                    Heim: {homeDressingResourceId ? resolveResourceName(dressingRoomFacilityGroups, homeDressingResourceId) : "—"}
                    {" · "}
                    Auswärts: {awayDressingResourceId ? resolveResourceName(dressingRoomFacilityGroups, awayDressingResourceId) : "—"}
                  </dd>
                </div>
              </>
            ) : null}
          </dl>

          <div className="fca-status-box fca-status-box-muted ml-[2.125rem] mt-3 text-xs">
            {canValidateDirectly
              ? `Mit „${submitLabel}“ wird das Match direkt erstellt und freigegeben.`
              : `Mit „${submitLabel}“ wird das Match zur Prüfung eingereicht — die Veröffentlichung erfolgt erst nach Freigabe (bestehender Prüf-Workflow).`}
          </div>
        </div>
      </div>

      {allocationWarning ? (
        <div className="fca-status-box fca-status-box-warn text-sm" data-testid="match-create-allocation-warning">
          {allocationWarning}
          <div className="mt-3">
            <button
              type="button"
              onClick={() => router.push(`/dashboard/matchcenter/${result?.eventId}`)}
              className="fca-button-secondary"
              data-testid="match-create-goto-match"
            >
              Zum Match wechseln und korrigieren
            </button>
          </div>
        </div>
      ) : null}

      {result && !allocationWarning ? (
        <div className="fca-status-box fca-status-box-success text-sm" data-testid="match-create-success">
          Match wurde {result.allowsDirectExecution ? "direkt erstellt" : "zur Prüfung eingereicht"}.
        </div>
      ) : null}

      {error ? <div className="fca-status-box fca-status-box-error">{error}</div> : null}

      <div className="flex flex-wrap items-center gap-3">
        <button type="submit" disabled={!canSubmit} data-testid="match-create-submit" className="fca-button-primary">
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
        Team, Ort, Gegner sowie Datum und Uhrzeit sind erforderlich, um ein Match zu erstellen.
      </p>
    </form>
  );
}
