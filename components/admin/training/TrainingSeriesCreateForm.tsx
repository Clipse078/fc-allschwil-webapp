"use client";

/**
 * components/admin/training/TrainingSeriesCreateForm.tsx
 *
 * PLANNING-CREATION-UX-01B — guided TrainingCenter creation workflow.
 *
 * Replaces the generic TrainingSeriesForm (mode="create") on
 * /dashboard/training/new with a single, premium-minimal guided form,
 * numbered/structured consistently with TournamentCreateForm
 * (PLANNING-CREATION-UX-01A / TOURNAMENTCENTER-01D):
 *
 *   1 · Team           — Tenant Team (TeamSeason) + series identity
 *   2 · Termin          — the initial occurrence's date + start/end time
 *   3 · Wiederholung    — Ja/Nein; "Ja" adds a recurrence end date
 *   4 · Spielfeld/Halle — live Frei/Belegt availability (01A foundation)
 *   5 · Garderobe       — live Frei/Belegt availability (01A foundation)
 *   6 · Prüfen & Einreichen — summary + Freigeben / Zur Freigabe einreichen
 *
 * PLANNING-CREATION-UX-01B-C1: the six steps now render as ONE bordered
 * surface with divided rows (not six separate cards) — same logical flow
 * and same six numbered steps, just visually one guided workflow instead of
 * six administrative panels. Steps 1/2 additionally collapse to a one-line
 * summary once their own fields are complete and focus moves elsewhere
 * (see GuidedStep below) so filled-in information stops taking as much
 * vertical space as the step currently being worked on. This is plain local
 * UI state — no wizard route/step machine: every field stays reachable and
 * editable at any time via "Bearbeiten", in any order.
 *
 * Preserves the EXISTING canonical architecture end to end:
 *   - Still posts to POST /api/training-series (createTrainingSeries +
 *     synchronous first-occurrence generation) — TrainingSeriesForm
 *     (mode="edit") is untouched and keeps handling edits.
 *   - Still uses the EXISTING weekdaySchedules contract; the guided flow
 *     simply derives ONE weekday from the chosen date rather than exposing
 *     the full multi-weekday picker during creation. Additional weekdays
 *     can still be added afterwards via the existing edit form.
 *   - RESOURCE-AVAILABILITY-UX-01-C1 / -C1-V root-cause fix: the selected
 *     Spielfeld/Halle + Garderobe resources are submitted as PART OF the
 *     SAME POST /api/training-series request (`facilityResourceIds`),
 *     which persists them as TrainingAllocation rows server-side in the
 *     same invocation that creates the series and generates its
 *     TrainingSessions, and rolls the WHOLE series back if any requested
 *     resource cannot be allocated — see that route's doc comment for the
 *     full root-cause writeup. Previously this used two-phase client-driven
 *     requests (lib/training/create-training-series-orchestration.ts:
 *     create the series, THEN a separate follow-up request per resource),
 *     which left the series permanently resource-less whenever anything
 *     interrupted the client between requests, or reported it as
 *     "created" even when a resource failed to attach. This request now
 *     either fully succeeds or fully fails — a resubmission after failure
 *     never risks a duplicate series, so no special partial-failure UI
 *     state is needed here. The standalone allocations page
 *     (TrainingAllocationEditor, for series that already exist) is
 *     untouched and still uses the per-resource endpoint directly.
 *   - Availability is read from the EXISTING PLANNING-CREATION-UX-01A
 *     GET /api/facilities/availability endpoint for the initial occurrence
 *     only — no recurring-series-wide conflict analysis is introduced here.
 *
 * Validation/lifecycle (see module doc + PR description for the full
 * finding): TrainingSeries has exactly one permission tier today
 * (trainings.manage — the same permission that gates reaching this page at
 * all) and no draft/pending review state. `canValidateDirectly` is wired
 * from that EXISTING permission so the button reflects reality instead of
 * inventing a new review queue; when false, the guided form explains why
 * direct submission isn't available rather than pretending to queue it.
 */

import { useCallback, useEffect, useId, useMemo, useState } from "react";
import type { FocusEvent, ReactNode } from "react";
import { useRouter } from "next/navigation";
import { Loader2, CalendarDays, Check, Repeat } from "lucide-react";
import {
  type FacilityGroup,
  type ResourceAvailabilityAnnotation,
} from "@/components/admin/training/FacilityResourceSelector";
import { VisualResourceAvailabilityPicker } from "@/components/admin/shared/planning/VisualResourceAvailabilityPicker";
import { VisualDressingRoomPicker } from "@/components/admin/shared/planning/VisualDressingRoomPicker";
import { weekdayFromDate, zonedTimeToUtc } from "@/lib/training/recurrence";
import type { Weekday } from "@/lib/training/types";

// ── Types ──────────────────────────────────────────────────────────────────

export type TeamSeasonOption = {
  id: string;
  teamId: string;
  teamName: string;
  seasonName: string;
};

type GenerationResult = {
  occurrencesInWindow: number;
  created: number;
  updated: number;
  unchanged: number;
};

/** Shape of one row in GET /api/facilities/availability's `availability` array. */
type ResourceAvailabilityRow = ResourceAvailabilityAnnotation & { resourceId: string };

type ResourceDraftRow = {
  localId: string;
  facilityResourceId: string;
  facilityResourceName: string;
  facilityName: string;
};

type TrainingSeriesCreateFormProps = {
  teamSeasons: TeamSeasonOption[];
  pitchHallFacilityGroups: FacilityGroup[];
  dressingRoomFacilityGroups: FacilityGroup[];
  /**
   * Whether the current user can create-and-activate a TrainingSeries
   * directly, sourced from the EXISTING trainings.manage permission — the
   * same permission required to reach this page at all (see module doc).
   */
  canValidateDirectly: boolean;
};

const WEEKDAY_LABELS: Record<Weekday, string> = {
  MONDAY: "Montag",
  TUESDAY: "Dienstag",
  WEDNESDAY: "Mittwoch",
  THURSDAY: "Donnerstag",
  FRIDAY: "Freitag",
  SATURDAY: "Samstag",
  SUNDAY: "Sonntag",
};

/**
 * PLANNING-CREATION-UX-01B-C1: the guided form never collects a timezone
 * (POST /api/training-series defaults an omitted `timezone` to this exact
 * value — see app/api/training-series/route.ts). Availability must resolve
 * the chosen wall-clock date/time to a UTC instant the same way, or the
 * interval sent to GET /api/facilities/availability silently drifts from
 * the UTC startAt/endAt real TrainingSessions are generated with (see
 * lib/training/recurrence.ts#zonedTimeToUtc), causing genuinely overlapping
 * bookings to be missed.
 */
const DEFAULT_TRAINING_SERIES_TIMEZONE = "Europe/Zurich";

let localIdCounter = 0;
function nextLocalId(prefix: string): string {
  localIdCounter += 1;
  return `${prefix}-${localIdCounter}`;
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

/** "YYYY-MM-DD" + N days → "YYYY-MM-DD", using UTC calendar-date arithmetic (matches lib/training/recurrence.ts). */
function addDaysToDateKey(dateKey: string, days: number): string {
  const date = new Date(`${dateKey}T00:00:00.000Z`);
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}


/**
 * PLANNING-CREATION-UX-01B-C1 — collapses a step to a one-line summary once
 * its own information is complete, so "done" steps stop consuming the same
 * height as the step currently being filled in. Purely local UI state (a
 * blur-triggered boolean) — NOT a wizard route/step machine: every step's
 * fields stay mounted-on-demand and reachable again via "Bearbeiten" any
 * time, in any order, with no navigation or gating involved.
 */
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

/** One numbered row of the guided flow — expanded while incomplete/active, a compact summary line once done. */
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
          <button
            type="button"
            onClick={onExpand}
            className="shrink-0 text-xs font-medium text-[var(--sce-primary)] hover:underline"
          >
            Bearbeiten
          </button>
        ) : null}
      </div>
      {isCollapsed ? null : <div className="mt-2.5 pl-[2.125rem]">{children}</div>}
    </div>
  );
}

// ── Component ─────────────────────────────────────────────────────────────

export default function TrainingSeriesCreateForm({
  teamSeasons,
  pitchHallFacilityGroups,
  dressingRoomFacilityGroups,
  canValidateDirectly,
}: TrainingSeriesCreateFormProps) {
  const router = useRouter();
  const formId = useId();

  // ── 1 · Team ────────────────────────────────────────────────────────────
  const [teamSeasonId, setTeamSeasonId] = useState("");
  const [title, setTitle] = useState("");
  const [titleTouched, setTitleTouched] = useState(false);

  const selectedTeamSeason = useMemo(
    () => teamSeasons.find((ts) => ts.id === teamSeasonId) ?? null,
    [teamSeasons, teamSeasonId],
  );

  // Auto-suggest a title from the selected team, same convention as the
  // legacy events/trainings create form — but never overwrite a title the
  // admin has already edited by hand.
  useEffect(() => {
    if (titleTouched || !selectedTeamSeason) return;
    setTitle(`${selectedTeamSeason.teamName} Training`);
  }, [selectedTeamSeason, titleTouched]);

  // ── 2 · Tag & Zeit ──────────────────────────────────────────────────────
  const [date, setDate] = useState("");
  const [startsAt, setStartsAt] = useState("17:00");
  const [endsAt, setEndsAt] = useState("18:00");

  const derivedWeekday = useMemo<Weekday | null>(() => {
    if (!date) return null;
    try {
      return weekdayFromDate(new Date(`${date}T00:00:00.000Z`));
    } catch {
      return null;
    }
  }, [date]);

  const timesValid = !!startsAt && !!endsAt && startsAt < endsAt;

  // ── 3 · Wiederholung ────────────────────────────────────────────────────
  const [isRecurring, setIsRecurring] = useState(false);
  const [validUntil, setValidUntil] = useState("");

  // PLANNING-CREATION-UX-01B-C1: per-step collapse state for the "1 Team" /
  // "2 Termin" steps only (see GuidedStep doc comment) — collapses to a
  // one-line summary once that step's own fields are complete AND focus has
  // moved elsewhere, re-expandable any time via "Bearbeiten".
  const [teamCollapsed, setTeamCollapsed] = useState(false);
  const [terminCollapsed, setTerminCollapsed] = useState(false);

  const teamStepComplete = !!teamSeasonId && !!title.trim();
  const terminStepComplete = !!date && timesValid;

  // Resolves the effective [validFrom, validUntil] window the API will
  // receive: a single occurrence when not recurring (validUntil = date + 1
  // day — both bounds of the recurrence engine are inclusive, and the very
  // next calendar day never shares the same weekday, so exactly one
  // occurrence is produced), or the admin-chosen end date when recurring.
  const effectiveValidUntil = isRecurring ? validUntil : date ? addDaysToDateKey(date, 1) : "";

  // ── 4/5 · Spielfeld/Halle + Garderobe (draft, pre-creation) ────────────
  const [resources, setResources] = useState<ResourceDraftRow[]>([]);
  const [dressingRooms, setDressingRooms] = useState<ResourceDraftRow[]>([]);

  const allocatedResourceIds = useMemo(() => new Set(resources.map((r) => r.facilityResourceId)), [resources]);
  const allocatedDressingRoomIds = useMemo(
    () => new Set(dressingRooms.map((r) => r.facilityResourceId)),
    [dressingRooms],
  );

  const addResourceDraft = useCallback(
    (facilityResourceId: string) => {
      if (allocatedResourceIds.has(facilityResourceId)) return;
      const display = resolveResourceDisplay(pitchHallFacilityGroups, facilityResourceId);
      setResources((prev) => [
        ...prev,
        { localId: nextLocalId("resource"), facilityResourceId, facilityResourceName: display.name, facilityName: display.facilityName },
      ]);
    },
    [pitchHallFacilityGroups, allocatedResourceIds],
  );
  const removeResourceDraft = useCallback((localId: string) => {
    setResources((prev) => prev.filter((r) => r.localId !== localId));
  }, []);

  const addDressingRoomDraft = useCallback(
    (facilityResourceId: string) => {
      if (allocatedDressingRoomIds.has(facilityResourceId)) return;
      const display = resolveResourceDisplay(dressingRoomFacilityGroups, facilityResourceId);
      setDressingRooms((prev) => [
        ...prev,
        { localId: nextLocalId("dressing-room"), facilityResourceId, facilityResourceName: display.name, facilityName: display.facilityName },
      ]);
    },
    [dressingRoomFacilityGroups, allocatedDressingRoomIds],
  );
  const removeDressingRoomDraft = useCallback((localId: string) => {
    setDressingRooms((prev) => prev.filter((r) => r.localId !== localId));
  }, []);

  // PLANNING-CREATION-UX-01B: once the initial occurrence's date + valid
  // start/end times are known, immediately show which Spielfeld/Halle and
  // Garderobe resources are Frei/Belegt for that exact interval — reusing
  // the EXISTING 01A availability endpoint/service. Deliberately scoped to
  // the single initial occurrence only, never the full recurrence.
  const [pitchAvailability, setPitchAvailability] = useState<Map<string, ResourceAvailabilityAnnotation>>(new Map());
  const [dressingRoomAvailability, setDressingRoomAvailability] = useState<Map<string, ResourceAvailabilityAnnotation>>(
    new Map(),
  );

  useEffect(() => {
    if (!date || !timesValid) {
      setPitchAvailability(new Map());
      setDressingRoomAvailability(new Map());
      return;
    }

    let active = true;
    // Resolve the chosen wall-clock date/time to the same UTC instant a
    // generated TrainingSession would get (see DEFAULT_TRAINING_SERIES_TIMEZONE
    // doc comment) instead of sending a bare "YYYY-MM-DDTHH:mm" string, which
    // Date parsing would otherwise resolve in the runtime's local timezone.
    const startAtIso = zonedTimeToUtc(date, startsAt, DEFAULT_TRAINING_SERIES_TIMEZONE).toISOString();
    const endAtIso = zonedTimeToUtc(date, endsAt, DEFAULT_TRAINING_SERIES_TIMEZONE).toISOString();

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
  }, [date, startsAt, endsAt, timesValid]);

  // ── Submission ───────────────────────────────────────────────────────────
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<{ seriesId: string; generation: GenerationResult } | null>(null);

  // PLANNING-CREATION-UX-01B: compact, always-visible "Noch N Angaben
  // fehlen" nudge — not a wizard/gate, every section stays reachable and
  // editable regardless of this list; it only nudges.
  const missingItems = useMemo(() => {
    const items: string[] = [];
    if (!teamSeasonId) items.push("Team auswählen");
    if (!title.trim()) items.push("Titel angeben");
    if (!date) items.push("Tag auswählen");
    if (!timesValid) items.push("Start-/Endzeit angeben (Start vor Ende)");
    if (isRecurring && !validUntil) items.push("Enddatum der Wiederholung angeben");
    if (date && timesValid) {
      if (resources.length === 0) items.push("Spielfeld / Halle zuweisen");
      if (dressingRooms.length === 0) items.push("Garderobe zuweisen");
    }
    return items;
  }, [teamSeasonId, title, date, timesValid, isRecurring, validUntil, resources.length, dressingRooms.length]);

  // Spielfeld/Halle and Garderobe are nudged (see missingItems above) but —
  // consistent with TournamentCreateForm — not required to submit: an admin
  // may finish resource assignment afterwards via the existing allocations
  // page.
  const hasRequiredFields =
    !!teamSeasonId && !!title.trim() && !!date && timesValid && !!derivedWeekday && (!isRecurring || !!validUntil);

  const canSubmit = !submitting && canValidateDirectly && hasRequiredFields;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!canValidateDirectly) {
      return;
    }
    if (!hasRequiredFields || !derivedWeekday) {
      setError("Bitte alle erforderlichen Angaben ausfüllen.");
      return;
    }

    setSubmitting(true);

    // RESOURCE-AVAILABILITY-UX-01-C1 / -C1-V root-cause fix: the selected
    // Spielfeld/Halle + Garderobe resources are sent as PART OF this single
    // request — POST /api/training-series persists the series' default
    // TrainingAllocation rows itself, in the same server-side invocation
    // that creates the series and generates its TrainingSessions, and rolls
    // the whole series back if any requested resource cannot be allocated
    // (see the route's doc comment). Previously these resources were
    // submitted via SEPARATE, sequential follow-up requests (one per
    // resource, after this one already succeeded), which could either be
    // interrupted mid-flight (leaving the series without any resources) or
    // fail individually while still reporting the series as "created" —
    // this endpoint now either fully succeeds or fully fails, so a
    // resubmission after a failure here is always safe (no partially
    // created series is ever left behind to duplicate).
    const facilityResourceIds = [...resources, ...dressingRooms].map((r) => r.facilityResourceId);

    try {
      const res = await fetch("/api/training-series", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          teamSeasonId,
          title: title.trim(),
          validFrom: date,
          validUntil: effectiveValidUntil,
          weekdaySchedules: [{ weekday: derivedWeekday, startsAt, endsAt }],
          facilityResourceIds,
        }),
      });
      const data = (await res.json().catch(() => null)) as
        | { series?: { id: string }; generation?: GenerationResult; error?: string }
        | null;
      if (!res.ok || !data?.series) {
        throw new Error(data?.error ?? "Trainingsserie konnte nicht erstellt werden.");
      }

      setResult({ seriesId: data.series.id, generation: data.generation as GenerationResult });
      router.push(`/dashboard/training?submitted=1`);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Trainingsserie konnte nicht erstellt werden.");
    } finally {
      setSubmitting(false);
    }
  }

  const submitLabel = canValidateDirectly ? "Freigeben & Trainingsserie erstellen" : "Zur Freigabe einreichen";

  return (
    <form onSubmit={handleSubmit} className="space-y-5" data-testid="training-create-form">
      {missingItems.length > 0 ? (
        <div className="fca-status-box fca-status-box-muted text-sm" data-testid="training-create-guided-progress">
          <p className="font-semibold">
            Noch {missingItems.length} {missingItems.length === 1 ? "Angabe fehlt" : "Angaben fehlen"}
          </p>
          <ul className="mt-1.5 list-inside list-disc space-y-0.5" data-testid="training-create-guided-progress-list">
            {missingItems.map((item, i) => (
              <li key={i}>{item}</li>
            ))}
          </ul>
        </div>
      ) : (
        <div className="fca-status-box fca-status-box-success text-sm" data-testid="training-create-guided-progress">
          Alle Angaben vollständig — bereit zum Einreichen.
        </div>
      )}

      <div className="divide-y divide-[var(--border)] overflow-hidden rounded-xl border border-[var(--border)] bg-[var(--surface)] shadow-sm">
        <GuidedStep
          index={1}
          title="Team"
          hint="Team · Saison und Name der Trainingsserie."
          complete={teamStepComplete}
          collapsed={teamCollapsed}
          summary={selectedTeamSeason ? `${selectedTeamSeason.teamName} · ${selectedTeamSeason.seasonName} — „${title}“` : undefined}
          onExpand={() => setTeamCollapsed(false)}
          onBlurCapture={(e) => handleStepBlur(e, teamStepComplete, () => setTeamCollapsed(true))}
        >
          <div className="grid gap-3 md:grid-cols-2">
            <label className="block space-y-1 md:col-span-2">
              <span className="fca-label">Team / Saison</span>
              {teamSeasons.length === 0 ? (
                <p className="mt-1 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-700 dark:border-amber-800 dark:bg-amber-900/20 dark:text-amber-400">
                  Kein Team mit Schreibzugriff verfügbar. Bitte wenden Sie sich an die Koordination.
                </p>
              ) : (
                <select
                  value={teamSeasonId}
                  onChange={(e) => setTeamSeasonId(e.target.value)}
                  className="fca-select"
                  required
                  data-testid="training-create-team-season-select"
                >
                  <option value="">— Auswählen —</option>
                  {teamSeasons.map((ts) => (
                    <option key={ts.id} value={ts.id}>
                      {ts.teamName} · {ts.seasonName}
                    </option>
                  ))}
                </select>
              )}
            </label>

            <label className="block space-y-1 md:col-span-2">
              <span className="fca-label">Name der Trainingsserie</span>
              <input
                type="text"
                value={title}
                onChange={(e) => {
                  setTitle(e.target.value);
                  setTitleTouched(true);
                }}
                placeholder="z. B. E1 Dienstagstraining"
                className="fca-input"
                required
                data-testid="training-create-title"
              />
            </label>
          </div>
        </GuidedStep>

        <GuidedStep
          index={2}
          title="Termin"
          hint="Datum und Uhrzeit des ersten Trainingstermins."
          complete={terminStepComplete}
          collapsed={terminCollapsed}
          summary={
            date
              ? `${date} · ${startsAt}–${endsAt}${derivedWeekday ? ` (${WEEKDAY_LABELS[derivedWeekday]})` : ""}`
              : undefined
          }
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
                data-testid="training-create-date"
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
                data-testid="training-create-starts-at"
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
                data-testid="training-create-ends-at"
              />
            </label>
          </div>
          {date ? (
            <p
              className="mt-2 flex items-center gap-1.5 text-xs text-[var(--text-2)]"
              data-testid="training-create-weekday-label"
            >
              <CalendarDays className="h-3.5 w-3.5" aria-hidden />
              Wochentag: {derivedWeekday ? WEEKDAY_LABELS[derivedWeekday] : "—"}
            </p>
          ) : null}
          {date && !timesValid ? <p className="mt-1 text-xs text-rose-600">Start muss vor Ende liegen.</p> : null}
        </GuidedStep>

        <div className="px-4 py-3">
          <div className="flex items-center gap-2.5">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[var(--border-strong)] text-[0.7rem] font-semibold text-[var(--text-2)]" aria-hidden>
              3
            </span>
            <div className="flex min-w-0 flex-1 flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 text-sm font-semibold text-[var(--foreground)]">
                <Repeat className="h-3.5 w-3.5 text-[var(--sce-primary)]" aria-hidden />
                Wiederholung
              </div>
              <div className="flex gap-1.5" role="radiogroup" aria-label="Wiederholung">
                <button
                  type="button"
                  onClick={() => setIsRecurring(false)}
                  aria-pressed={!isRecurring}
                  data-testid="training-create-recurrence-no"
                  className={!isRecurring ? "fca-button-primary text-xs" : "fca-button-secondary text-xs"}
                >
                  Nein
                </button>
                <button
                  type="button"
                  onClick={() => setIsRecurring(true)}
                  aria-pressed={isRecurring}
                  data-testid="training-create-recurrence-yes"
                  className={isRecurring ? "fca-button-primary text-xs" : "fca-button-secondary text-xs"}
                >
                  Ja
                </button>
              </div>
            </div>
          </div>

          {isRecurring ? (
            <div className="mt-2.5 pl-[2.125rem]">
              <label className="block space-y-1 md:w-1/2">
                <span className="fca-label">Wiederholen bis</span>
                <input
                  type="date"
                  value={validUntil}
                  onChange={(e) => setValidUntil(e.target.value)}
                  min={date || undefined}
                  className="fca-input"
                  required={isRecurring}
                  data-testid="training-create-valid-until"
                />
              </label>
              {date ? (
                <p className="mt-1.5 text-xs text-[var(--text-2)]">
                  Wöchentlich an {derivedWeekday ? WEEKDAY_LABELS[derivedWeekday] : "—"}, bis zum gewählten Datum.
                </p>
              ) : null}
            </div>
          ) : (
            <p className="mt-1.5 pl-[2.125rem] text-xs text-[var(--text-2)]">Einmaliges Training am {date || "gewählten Tag"}.</p>
          )}
        </div>

        <div className="px-4 py-3">
          <div className="mb-3 flex items-center gap-2.5">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[var(--border-strong)] text-[0.7rem] font-semibold text-[var(--text-2)]" aria-hidden>
              4
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold text-[var(--foreground)]">Spielfeld / Halle</h2>
              <p className="text-xs text-[var(--text-2)]">Wähle den passenden Platz direkt aus.</p>
            </div>
          </div>
          <div className="pl-[2.125rem]">
            <VisualResourceAvailabilityPicker
              facilityGroups={pitchHallFacilityGroups}
              selectedResourceIds={allocatedResourceIds}
              onSelect={addResourceDraft}
              onDeselect={(id) => {
                const row = resources.find((r) => r.facilityResourceId === id);
                if (row) removeResourceDraft(row.localId);
              }}
              availabilityByResourceId={pitchAvailability}
              testId="training-create-resource"
            />
          </div>
        </div>

        <div className="px-4 py-3">
          <div className="mb-3 flex items-center gap-2.5">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[var(--border-strong)] text-[0.7rem] font-semibold text-[var(--text-2)]" aria-hidden>
              5
            </span>
            <div className="min-w-0 flex-1">
              <h2 className="text-sm font-semibold text-[var(--foreground)]">Garderobe</h2>
              <p className="text-xs text-[var(--text-2)]">Garderobe für dieses Training zuweisen.</p>
            </div>
          </div>
          <div className="pl-[2.125rem]">
            <VisualDressingRoomPicker
              facilityGroups={dressingRoomFacilityGroups}
              selectedResourceIds={allocatedDressingRoomIds}
              onSelect={addDressingRoomDraft}
              onDeselect={(id) => {
                const row = dressingRooms.find((r) => r.facilityResourceId === id);
                if (row) removeDressingRoomDraft(row.localId);
              }}
              availabilityByResourceId={dressingRoomAvailability}
              testId="training-create-dressing-room"
            />
          </div>
        </div>

        <div className="px-4 py-3">
          <div className="mb-2.5 flex items-center gap-2.5">
            <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full border border-[var(--border-strong)] text-[0.7rem] font-semibold text-[var(--text-2)]" aria-hidden>
              6
            </span>
            <h2 className="text-sm font-semibold text-[var(--foreground)]">Prüfen &amp; Einreichen</h2>
          </div>
          <dl className="grid gap-x-6 gap-y-1.5 pl-[2.125rem] text-sm md:grid-cols-2">
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Team</dt>
              <dd className="text-[var(--foreground)]">
                {selectedTeamSeason ? `${selectedTeamSeason.teamName} · ${selectedTeamSeason.seasonName}` : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Titel</dt>
              <dd className="text-[var(--foreground)]">{title || "—"}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Termin</dt>
              <dd className="text-[var(--foreground)]">
                {date ? `${date} · ${startsAt}–${endsAt}${derivedWeekday ? ` (${WEEKDAY_LABELS[derivedWeekday]})` : ""}` : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Wiederholung</dt>
              <dd className="text-[var(--foreground)]">{isRecurring ? `Wöchentlich bis ${validUntil || "—"}` : "Einmalig"}</dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Spielfeld / Halle</dt>
              <dd className="text-[var(--foreground)]">
                {resources.length > 0 ? resources.map((r) => r.facilityResourceName).join(", ") : "—"}
              </dd>
            </div>
            <div>
              <dt className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">Garderobe</dt>
              <dd className="text-[var(--foreground)]">
                {dressingRooms.length > 0 ? dressingRooms.map((r) => r.facilityResourceName).join(", ") : "—"}
              </dd>
            </div>
          </dl>

          {!canValidateDirectly ? (
            <div
              className="fca-status-box fca-status-box-warn ml-[2.125rem] mt-3 text-xs"
              data-testid="training-create-no-validation-right"
            >
              Für die direkte Erstellung ist die Berechtigung „Trainings verwalten“ erforderlich. Bitte wende dich an
              eine Person mit Freigaberecht.
            </div>
          ) : (
            <div className="fca-status-box fca-status-box-muted ml-[2.125rem] mt-3 text-xs">
              Mit „{submitLabel}“ wird die Trainingsserie sofort erstellt und aktiv gesetzt (kein separater Prüfschritt
              in der aktuellen TrainingCenter-Architektur).
            </div>
          )}
        </div>
      </div>

      {result ? (
        <div className="fca-status-box fca-status-box-success text-sm" data-testid="training-create-success">
          Trainingsserie erstellt — {result.generation.occurrencesInWindow} Termin
          {result.generation.occurrencesInWindow === 1 ? "" : "e"} generiert.
        </div>
      ) : null}

      {error ? <div className="fca-status-box fca-status-box-error">{error}</div> : null}

      <div className="flex flex-wrap items-center gap-3">
        <button
          type="submit"
          disabled={!canSubmit}
          data-testid="training-create-submit"
          title={!canValidateDirectly ? "Berechtigung „Trainings verwalten“ erforderlich." : undefined}
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

        <button type="button" onClick={() => router.push("/dashboard/training")} className="fca-button-secondary">
          Abbrechen
        </button>
      </div>
      <p className="sr-only" id={`${formId}-hint`}>
        Team, Tag, Start-/Endzeit und eine Wiederholungsentscheidung sind erforderlich, um eine Trainingsserie zu
        erstellen.
      </p>
    </form>
  );
}
