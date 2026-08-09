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
 *   2 · Tag & Zeit      — the initial occurrence's date + start/end time
 *   3 · Wiederholung    — Ja/Nein; "Ja" adds a recurrence end date
 *   4 · Spielfeld/Halle — live Frei/Belegt availability (01A foundation)
 *   5 · Garderobe       — live Frei/Belegt availability (01A foundation)
 *   6 · Prüfen & Einreichen — summary + Freigeben / Zur Freigabe einreichen
 *
 * Preserves the EXISTING canonical architecture end to end:
 *   - Still posts to POST /api/training-series (createTrainingSeries +
 *     synchronous first-occurrence generation) — TrainingSeriesForm
 *     (mode="edit") is untouched and keeps handling edits.
 *   - Still uses the EXISTING weekdaySchedules contract; the guided flow
 *     simply derives ONE weekday from the chosen date rather than exposing
 *     the full multi-weekday picker during creation. Additional weekdays
 *     can still be added afterwards via the existing edit form.
 *   - Resource allocation still goes through the EXISTING
 *     POST /api/training-series/:id/allocations endpoint (same one
 *     TrainingAllocationEditor already uses), sequenced by
 *     lib/training/create-training-series-orchestration.ts so the series
 *     always exists before allocations are attempted.
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
import { useRouter } from "next/navigation";
import { Loader2, CalendarDays, Repeat } from "lucide-react";
import { SectionCard } from "@/components/ui/page/SectionCard";
import {
  FacilityResourceSelector,
  type FacilityGroup,
  type ResourceAvailabilityAnnotation,
} from "@/components/admin/training/FacilityResourceSelector";
import { weekdayFromDate, zonedTimeToUtc } from "@/lib/training/recurrence";
import type { Weekday } from "@/lib/training/types";
import {
  orchestrateTrainingSeriesCreation,
  type TrainingSeriesAllocationDraft,
} from "@/lib/training/create-training-series-orchestration";

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
    async (facilityResourceId: string) => {
      const display = resolveResourceDisplay(pitchHallFacilityGroups, facilityResourceId);
      setResources((prev) => [
        ...prev,
        { localId: nextLocalId("resource"), facilityResourceId, facilityResourceName: display.name, facilityName: display.facilityName },
      ]);
    },
    [pitchHallFacilityGroups],
  );
  const removeResourceDraft = useCallback((localId: string) => {
    setResources((prev) => prev.filter((r) => r.localId !== localId));
  }, []);

  const addDressingRoomDraft = useCallback(
    async (facilityResourceId: string) => {
      const display = resolveResourceDisplay(dressingRoomFacilityGroups, facilityResourceId);
      setDressingRooms((prev) => [
        ...prev,
        { localId: nextLocalId("dressing-room"), facilityResourceId, facilityResourceName: display.name, facilityName: display.facilityName },
      ]);
    },
    [dressingRoomFacilityGroups],
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
  const [partialErrors, setPartialErrors] = useState<{ resource: string; error: string }[]>([]);

  // PLANNING-CREATION-UX-01B: once a submission has partially failed, the
  // TrainingSeries (and whatever allocations succeeded) already exists —
  // resubmitting would call POST /api/training-series again and create a
  // second, duplicate series. The only safe way to finish an incomplete
  // creation is the existing allocations page (linked in the banner below).
  const hasUnresolvedPartialFailure = !!result && partialErrors.length > 0;

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
  // page, same fallback the partial-failure banner below already offers.
  const hasRequiredFields =
    !!teamSeasonId && !!title.trim() && !!date && timesValid && !!derivedWeekday && (!isRecurring || !!validUntil);

  const canSubmit = !submitting && !hasUnresolvedPartialFailure && canValidateDirectly && hasRequiredFields;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (hasUnresolvedPartialFailure) {
      // Defense in depth — the button is disabled for this case, but a
      // native form submit (e.g. pressing Enter) still calls this handler.
      return;
    }
    if (!canValidateDirectly) {
      return;
    }
    if (!hasRequiredFields || !derivedWeekday) {
      setError("Bitte alle erforderlichen Angaben ausfüllen.");
      return;
    }

    setSubmitting(true);
    setPartialErrors([]);

    const plan = {
      pitchHallAllocations: resources.map<TrainingSeriesAllocationDraft>((r) => ({
        facilityResourceId: r.facilityResourceId,
        facilityResourceName: r.facilityResourceName,
      })),
      dressingRoomAllocations: dressingRooms.map<TrainingSeriesAllocationDraft>((r) => ({
        facilityResourceId: r.facilityResourceId,
        facilityResourceName: r.facilityResourceName,
      })),
    };

    try {
      const orchestration = await orchestrateTrainingSeriesCreation(plan, {
        createSeries: async () => {
          const res = await fetch("/api/training-series", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              teamSeasonId,
              title: title.trim(),
              validFrom: date,
              validUntil: effectiveValidUntil,
              weekdaySchedules: [{ weekday: derivedWeekday, startsAt, endsAt }],
            }),
          });
          const data = (await res.json().catch(() => null)) as
            | { series?: { id: string }; generation?: GenerationResult; error?: string }
            | null;
          if (!res.ok || !data?.series) {
            throw new Error(data?.error ?? "Trainingsserie konnte nicht erstellt werden.");
          }
          return { seriesId: data.series.id, generation: data.generation as GenerationResult };
        },
        addAllocation: async (seriesId, draft) => {
          const res = await fetch(`/api/training-series/${seriesId}/allocations`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ facilityResourceId: draft.facilityResourceId }),
          });
          const data = (await res.json().catch(() => null)) as { allocation?: unknown; error?: string } | null;
          if (!res.ok || !data?.allocation) {
            throw new Error(data?.error ?? "Ressource konnte nicht zugewiesen werden.");
          }
        },
      });

      setResult({ seriesId: orchestration.seriesId, generation: orchestration.generation });

      const combinedErrors = [
        ...orchestration.resourceAllocationErrors.map((e) => ({ resource: e.draft.facilityResourceName, error: e.error })),
        ...orchestration.dressingRoomAllocationErrors.map((e) => ({ resource: e.draft.facilityResourceName, error: e.error })),
      ];

      if (combinedErrors.length > 0) {
        setPartialErrors(combinedErrors);
        return;
      }

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

      <SectionCard title="1 · Team" description="Tenant-Team (Team · Saison) und Name der Trainingsserie.">
        <div className="grid gap-4 md:grid-cols-2">
          <label className="block space-y-2 md:col-span-2">
            <span className="fca-label">Team / Saison</span>
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
          </label>

          <label className="block space-y-2 md:col-span-2">
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
      </SectionCard>

      <SectionCard title="2 · Tag & Zeit" description="Datum und Uhrzeit des ersten Trainingstermins.">
        <div className="grid gap-4 md:grid-cols-3">
          <label className="block space-y-2">
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
          <label className="block space-y-2">
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
          <label className="block space-y-2">
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
          <p className="mt-3 flex items-center gap-1.5 text-xs text-[var(--text-2)]" data-testid="training-create-weekday-label">
            <CalendarDays className="h-3.5 w-3.5" aria-hidden />
            Wochentag: {derivedWeekday ? WEEKDAY_LABELS[derivedWeekday] : "—"}
          </p>
        ) : null}
        {date && !timesValid ? (
          <p className="mt-1 text-xs text-rose-600">Start muss vor Ende liegen.</p>
        ) : null}
      </SectionCard>

      <SectionCard
        title="3 · Wiederholung"
        description="Wiederholt sich dieses Training wöchentlich am selben Wochentag?"
      >
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-medium text-[var(--foreground)]">
            <Repeat className="h-4 w-4 text-[var(--sce-primary)]" aria-hidden />
            Wiederholung
          </div>
          <div className="flex gap-2" role="radiogroup" aria-label="Wiederholung">
            <button
              type="button"
              onClick={() => setIsRecurring(false)}
              aria-pressed={!isRecurring}
              data-testid="training-create-recurrence-no"
              className={!isRecurring ? "fca-button-primary text-sm" : "fca-button-secondary text-sm"}
            >
              Nein
            </button>
            <button
              type="button"
              onClick={() => setIsRecurring(true)}
              aria-pressed={isRecurring}
              data-testid="training-create-recurrence-yes"
              className={isRecurring ? "fca-button-primary text-sm" : "fca-button-secondary text-sm"}
            >
              Ja
            </button>
          </div>
        </div>

        {isRecurring ? (
          <div className="mt-4">
            <label className="block space-y-2 md:w-1/2">
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
              <p className="mt-2 text-xs text-[var(--text-2)]">
                Wiederholt sich wöchentlich an {derivedWeekday ? WEEKDAY_LABELS[derivedWeekday] : "—"}, bis zum gewählten Datum.
              </p>
            ) : null}
          </div>
        ) : (
          <p className="mt-3 text-xs text-[var(--text-2)]">Einmaliges Training am {date || "gewählten Tag"}.</p>
        )}
      </SectionCard>

      <SectionCard
        title="4 · Spielfeld / Halle"
        description="Verfügbarkeit wird live für den ersten Termin angezeigt, sobald Tag und Zeit gewählt sind."
      >
        <div className="space-y-4">
          {resources.length === 0 ? (
            <div className="rounded-lg border-2 border-dashed border-[var(--border)] py-6 text-center">
              <p className="text-sm text-[var(--text-2)]">Noch kein Spielfeld / keine Halle zugewiesen.</p>
            </div>
          ) : (
            <ul className="space-y-2" data-testid="training-create-resource-list">
              {resources.map((resource) => (
                <li
                  key={resource.localId}
                  className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[var(--foreground)]">{resource.facilityResourceName}</p>
                    <p className="mt-0.5 text-xs text-[var(--text-2)]">{resource.facilityName}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeResourceDraft(resource.localId)}
                    aria-label={`${resource.facilityResourceName} entfernen`}
                    className="shrink-0 rounded p-1 text-[var(--muted)] transition hover:bg-rose-50 hover:text-rose-600"
                  >
                    ×
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
            availabilityByResourceId={pitchAvailability}
            testId="training-create-resource-add"
          />
        </div>
      </SectionCard>

      <SectionCard
        title="5 · Garderobe"
        description="Verfügbarkeit wird live für den ersten Termin angezeigt, sobald Tag und Zeit gewählt sind."
      >
        <div className="space-y-4">
          {dressingRooms.length === 0 ? (
            <div className="rounded-lg border-2 border-dashed border-[var(--border)] py-6 text-center">
              <p className="text-sm text-[var(--text-2)]">Noch keine Garderobe zugewiesen.</p>
            </div>
          ) : (
            <ul className="space-y-2" data-testid="training-create-dressing-room-list">
              {dressingRooms.map((room) => (
                <li
                  key={room.localId}
                  className="flex items-center gap-3 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-4 py-3"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-semibold text-[var(--foreground)]">{room.facilityResourceName}</p>
                    <p className="mt-0.5 text-xs text-[var(--text-2)]">{room.facilityName}</p>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeDressingRoomDraft(room.localId)}
                    aria-label={`${room.facilityResourceName} entfernen`}
                    className="shrink-0 rounded p-1 text-[var(--muted)] transition hover:bg-rose-50 hover:text-rose-600"
                  >
                    ×
                  </button>
                </li>
              ))}
            </ul>
          )}

          <FacilityResourceSelector
            facilityGroups={dressingRoomFacilityGroups}
            allocatedResourceIds={allocatedDressingRoomIds}
            onAdd={addDressingRoomDraft}
            placeholder="Garderobe auswählen…"
            addButtonLabel="Zuweisen"
            availabilityByResourceId={dressingRoomAvailability}
            testId="training-create-dressing-room-add"
          />
        </div>
      </SectionCard>

      <SectionCard title="6 · Prüfen & Einreichen" description="Zusammenfassung vor dem Erstellen der Trainingsserie.">
        <dl className="grid gap-x-6 gap-y-2 text-sm md:grid-cols-2">
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
          <div className="fca-status-box fca-status-box-warn mt-4 text-xs" data-testid="training-create-no-validation-right">
            Für die direkte Erstellung von Trainingsserien ist die Berechtigung „Trainings verwalten“ erforderlich.
            Bitte wende dich an eine Person mit Freigaberecht.
          </div>
        ) : (
          <div className="fca-status-box fca-status-box-muted mt-4 text-xs">
            Mit „{submitLabel}“ wird die Trainingsserie sofort erstellt und aktiv gesetzt (kein separater
            Prüfschritt in der aktuellen TrainingCenter-Architektur).
          </div>
        )}
      </SectionCard>

      {result && partialErrors.length > 0 ? (
        <div className="fca-status-box fca-status-box-warn text-sm" data-testid="training-create-partial-warning">
          <p className="font-semibold">
            Trainingsserie wurde erstellt, {partialErrors.length === 1 ? "aber eine Ressource" : `aber ${partialErrors.length} Ressourcen`}{" "}
            konnte{partialErrors.length === 1 ? "" : "n"} nicht zugewiesen werden.
          </p>
          <ul className="mt-1.5 list-inside list-disc space-y-0.5">
            {partialErrors.map((e, i) => (
              <li key={i}>
                {e.resource}: {e.error}
              </li>
            ))}
          </ul>
          <p className="mt-2 text-xs text-[var(--text-2)]">
            „{submitLabel}“ ist deaktiviert, um eine doppelte Serie zu vermeiden — bitte die fehlenden Ressourcen
            direkt an der bereits angelegten Serie nachtragen.
          </p>
          <button
            type="button"
            onClick={() => router.push(`/dashboard/training/series/${result.seriesId}/allocations`)}
            className="fca-button-secondary mt-3"
            data-testid="training-create-goto-allocations"
          >
            Zu den Ressourcen wechseln und korrigieren
          </button>
        </div>
      ) : null}

      {result && partialErrors.length === 0 ? (
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
          title={
            hasUnresolvedPartialFailure
              ? 'Trainingsserie wurde bereits angelegt — bitte über "Zu den Ressourcen wechseln und korrigieren" fortsetzen.'
              : !canValidateDirectly
                ? "Berechtigung „Trainings verwalten“ erforderlich."
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
