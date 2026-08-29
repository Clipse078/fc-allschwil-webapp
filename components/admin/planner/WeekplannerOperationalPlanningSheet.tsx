"use client";

/**
 * components/admin/planner/WeekplannerOperationalPlanningSheet.tsx
 *
 * WOCHENPLAN-2.0-01H-C — compact Sheet editor for alternative-plan operational
 * overrides (time + resources) without mutating canonical entities.
 */

import { useId, useMemo, useState } from "react";
import { AlertCircle, Check, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { Sheet } from "@/components/ui/Sheet";
import { VisualResourceAvailabilityPicker } from "@/components/admin/shared/planning/VisualResourceAvailabilityPicker";
import { VisualDressingRoomPicker } from "@/components/admin/shared/planning/VisualDressingRoomPicker";
import { useFacilityAvailability } from "@/hooks/use-facility-availability";
import type { FacilityGroup } from "@/components/admin/training/FacilityResourceSelector";
import type { WeekplannerItem } from "@/lib/weekplanner/types";
import type { WeekplannerActivityType } from "@/lib/weekplanner/plan-types";
import { planOverrideKey } from "@/lib/weekplanner/plan-override-key";
import type { WeekplannerOverrideRow } from "./WeekplannerAllocationOverrideEditor";

type Props = {
  item: WeekplannerItem | null;
  planId: string;
  planName: string;
  overridesByKey: Record<string, WeekplannerOverrideRow[]>;
  facilityGroupsByAllocationGroup: {
    PITCH_HALL: FacilityGroup[];
    DRESSING_ROOM: FacilityGroup[];
  };
  timezone: string;
  onClose: () => void;
  onSaved: () => void;
};

function toTimeInputValue(iso: Date | string, timeZone: string): string {
  return new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(new Date(iso));
}

function combineTimeWithReferenceDay(time: string, referenceIso: Date | string, timeZone: string): string | null {
  const match = /^(\d{2}):(\d{2})$/.exec(time.trim());
  if (!match) return null;
  const [, hh, mm] = match;
  const reference = typeof referenceIso === "string" ? referenceIso : referenceIso.toISOString();
  const dayParts = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date(reference));
  const year = dayParts.find((p) => p.type === "year")?.value;
  const month = dayParts.find((p) => p.type === "month")?.value;
  const day = dayParts.find((p) => p.type === "day")?.value;
  if (!year || !month || !day) return null;
  const naiveUtcGuess = new Date(`${year}-${month}-${day}T${hh}:${mm}:00.000Z`);
  const zonedFormat = new Intl.DateTimeFormat("en-US", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const shownAsIfUtc = zonedFormat.format(naiveUtcGuess);
  const [shownHour, shownMinute] = shownAsIfUtc.replace(/^24:/, "00:").split(":").map(Number);
  const targetMinutes = Number(hh) * 60 + Number(mm);
  const shownMinutes = shownHour * 60 + shownMinute;
  const diffMinutes = targetMinutes - shownMinutes;
  return new Date(naiveUtcGuess.getTime() + diffMinutes * 60_000).toISOString();
}

function setsEqual<T>(a: Set<T>, b: Set<T>): boolean {
  if (a.size !== b.size) return false;
  for (const value of a) if (!b.has(value)) return false;
  return true;
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">{children}</p>;
}

async function deleteAllocationOverrides(planId: string, rows: WeekplannerOverrideRow[]): Promise<void> {
  await Promise.all(
    rows.map(async (row) => {
      const res = await fetch(`/api/weekplanner/plans/${planId}/allocations/${row.id}`, { method: "DELETE" });
      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        throw new Error(data.error ?? `Fehler: HTTP ${res.status}`);
      }
    }),
  );
}

async function replaceAllocationOverrides(
  planId: string,
  activityType: WeekplannerActivityType,
  activityId: string,
  allocationGroup: "PITCH_HALL" | "DRESSING_ROOM",
  participantId: string | undefined,
  selectedResourceIds: string[],
  existingRows: WeekplannerOverrideRow[],
): Promise<void> {
  await deleteAllocationOverrides(planId, existingRows);
  for (const facilityResourceId of selectedResourceIds) {
    const res = await fetch(`/api/weekplanner/plans/${planId}/allocations`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        activityType,
        activityId,
        allocationGroup,
        participantId: participantId ?? null,
        facilityResourceId,
      }),
    });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(data.error ?? `Fehler: HTTP ${res.status}`);
    }
  }
}

async function saveTimeOverride(
  planId: string,
  activityType: WeekplannerActivityType,
  activityId: string,
  startAt: string,
  endAt: string,
  matchesCanonical: boolean,
): Promise<void> {
  if (matchesCanonical) {
    const res = await fetch(`/api/weekplanner/plans/${planId}/time-overrides`, {
      method: "DELETE",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ activityType, activityId }),
    });
    if (!res.ok && res.status !== 404) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      throw new Error(data.error ?? `Fehler: HTTP ${res.status}`);
    }
    return;
  }

  const res = await fetch(`/api/weekplanner/plans/${planId}/time-overrides`, {
    method: "PUT",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ activityType, activityId, startAt, endAt }),
  });
  if (!res.ok) {
    const data = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(data.error ?? `Fehler: HTTP ${res.status}`);
  }
}

function TrainingOperationalEditor({
  item,
  planId,
  overridesByKey,
  facilityGroupsByAllocationGroup,
  timezone,
  onClose,
  onSaved,
}: {
  item: Extract<WeekplannerItem, { type: "TRAINING" }>;
} & Omit<Props, "item" | "planName">) {
  const router = useRouter();
  const formId = useId();
  const activityId = item.trainingSessionId;

  const initStart = toTimeInputValue(item.startAt, timezone);
  const initEnd = toTimeInputValue(item.endAt, timezone);
  const canonicalStart = toTimeInputValue(item.canonicalStartAt, timezone);
  const canonicalEnd = toTimeInputValue(item.canonicalEndAt, timezone);
  const initPitchIds = new Set(item.pitchAllocations.map((r) => r.facilityResourceId));
  const initRoomIds = new Set(item.dressingRoomAllocations.map((r) => r.facilityResourceId));
  const canonicalPitchIds = new Set(item.canonicalPitchAllocations.map((r) => r.facilityResourceId));
  const canonicalRoomIds = new Set(item.canonicalDressingRoomAllocations.map((r) => r.facilityResourceId));

  const [startTime, setStartTime] = useState(initStart);
  const [endTime, setEndTime] = useState(initEnd);
  const [selectedPitchIds, setSelectedPitchIds] = useState<Set<string>>(initPitchIds);
  const [selectedRoomIds, setSelectedRoomIds] = useState<Set<string>>(initRoomIds);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startAt = useMemo(
    () => combineTimeWithReferenceDay(startTime, item.startAt, timezone) ?? "",
    [startTime, item.startAt, timezone],
  );
  const endAt = useMemo(
    () => combineTimeWithReferenceDay(endTime, item.endAt, timezone) ?? "",
    [endTime, item.endAt, timezone],
  );

  const { pitchAvailability, dressingRoomAvailability } = useFacilityAvailability({
    enabled: !!startAt,
    startAt,
    endAt,
    excludeTrainingSessionId: activityId,
  });

  const pitchOverrideRows =
    overridesByKey[planOverrideKey("TRAINING", activityId, "PITCH_HALL")] ?? [];
  const roomOverrideRows =
    overridesByKey[planOverrideKey("TRAINING", activityId, "DRESSING_ROOM")] ?? [];

  const timesValid = !!startTime && !!endTime && startTime < endTime;
  const timeChanged = startTime !== initStart || endTime !== initEnd;
  const pitchChanged = !setsEqual(selectedPitchIds, initPitchIds);
  const roomChanged = !setsEqual(selectedRoomIds, initRoomIds);
  const hasChanges = timeChanged || pitchChanged || roomChanged;

  async function handleSave() {
    if (!timesValid || !hasChanges) return;
    setSaving(true);
    setError(null);

    try {
      const canonicalStartAt = combineTimeWithReferenceDay(canonicalStart, item.canonicalStartAt, timezone);
      const canonicalEndAt = combineTimeWithReferenceDay(canonicalEnd, item.canonicalEndAt, timezone);
      const nextStartAt = combineTimeWithReferenceDay(startTime, item.startAt, timezone);
      const nextEndAt = combineTimeWithReferenceDay(endTime, item.endAt, timezone);
      if (!nextStartAt || !nextEndAt) throw new Error("Bitte gültige Uhrzeiten angeben.");

      if (timeChanged) {
        const matchesCanonical =
          startTime === canonicalStart &&
          endTime === canonicalEnd &&
          nextStartAt === canonicalStartAt &&
          nextEndAt === canonicalEndAt;
        await saveTimeOverride(planId, "TRAINING", activityId, nextStartAt, nextEndAt, matchesCanonical);
      }

      if (pitchChanged) {
        if (setsEqual(selectedPitchIds, canonicalPitchIds)) {
          await deleteAllocationOverrides(planId, pitchOverrideRows);
        } else {
          await replaceAllocationOverrides(
            planId,
            "TRAINING",
            activityId,
            "PITCH_HALL",
            undefined,
            Array.from(selectedPitchIds),
            pitchOverrideRows,
          );
        }
      }

      if (roomChanged) {
        if (setsEqual(selectedRoomIds, canonicalRoomIds)) {
          await deleteAllocationOverrides(planId, roomOverrideRows);
        } else {
          await replaceAllocationOverrides(
            planId,
            "TRAINING",
            activityId,
            "DRESSING_ROOM",
            undefined,
            Array.from(selectedRoomIds),
            roomOverrideRows,
          );
        }
      }

      router.refresh();
      onSaved();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Speichern fehlgeschlagen.";
      setError(message);
      setSaving(false);
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title="Planung bearbeiten"
      description={item.title}
      footer={
        <>
          <button type="button" onClick={onClose} className="fca-button-secondary text-sm">
            Abbrechen
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !hasChanges || !timesValid}
            data-testid="weekplanner-operational-save"
            className="fca-button-primary text-sm"
          >
            {saving ? (
              <>
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Speichern…
              </>
            ) : (
              <>
                <Check className="h-3.5 w-3.5" />
                Speichern
              </>
            )}
          </button>
        </>
      }
    >
      <div data-testid="weekplanner-operational-editor" className="space-y-6">
        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="space-y-2">
          <SectionLabel>Zeit</SectionLabel>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1" htmlFor={`${formId}-start`}>
              <span className="fca-label">Beginn</span>
              <input
                id={`${formId}-start`}
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="fca-input"
              />
            </label>
            <label className="block space-y-1" htmlFor={`${formId}-end`}>
              <span className="fca-label">Ende</span>
              <input
                id={`${formId}-end`}
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="fca-input"
              />
            </label>
          </div>
        </div>

        <div className="space-y-2">
          <SectionLabel>Ressourcen · Platz</SectionLabel>
          <VisualResourceAvailabilityPicker
            facilityGroups={facilityGroupsByAllocationGroup.PITCH_HALL}
            selectedResourceIds={selectedPitchIds}
            onSelect={(id) => setSelectedPitchIds((prev) => new Set([...prev, id]))}
            onDeselect={(id) =>
              setSelectedPitchIds((prev) => {
                const next = new Set(prev);
                next.delete(id);
                return next;
              })
            }
            availabilityByResourceId={pitchAvailability}
            disabled={saving}
            compact
            testId="weekplanner-operational-pitch"
          />
        </div>

        <div className="space-y-2">
          <SectionLabel>Garderobe</SectionLabel>
          <VisualDressingRoomPicker
            facilityGroups={facilityGroupsByAllocationGroup.DRESSING_ROOM}
            selectedResourceIds={selectedRoomIds}
            onSelect={(id) => setSelectedRoomIds((prev) => new Set([...prev, id]))}
            onDeselect={(id) =>
              setSelectedRoomIds((prev) => {
                const next = new Set(prev);
                next.delete(id);
                return next;
              })
            }
            availabilityByResourceId={dressingRoomAvailability}
            disabled={saving}
            compact
            testId="weekplanner-operational-room"
          />
        </div>
      </div>
    </Sheet>
  );
}

function MatchOperationalEditor({
  item,
  planId,
  overridesByKey,
  facilityGroupsByAllocationGroup,
  timezone,
  onClose,
  onSaved,
}: {
  item: Extract<WeekplannerItem, { type: "MATCH" }>;
} & Omit<Props, "item" | "planName">) {
  const router = useRouter();
  const formId = useId();
  const activityId = item.eventId;

  const initStart = toTimeInputValue(item.startAt, timezone);
  const initEnd = toTimeInputValue(item.endAt, timezone);
  const canonicalStart = toTimeInputValue(item.canonicalStartAt, timezone);
  const canonicalEnd = toTimeInputValue(item.canonicalEndAt, timezone);
  const initPitchIds = new Set(item.pitchAllocations.map((r) => r.facilityResourceId));
  const initRoomIds = new Set(item.dressingRoomAllocations.map((r) => r.facilityResourceId));
  const canonicalPitchIds = new Set(item.canonicalPitchAllocations.map((r) => r.facilityResourceId));
  const canonicalRoomIds = new Set(item.canonicalDressingRoomAllocations.map((r) => r.facilityResourceId));

  const [startTime, setStartTime] = useState(initStart);
  const [endTime, setEndTime] = useState(initEnd);
  const [selectedPitchIds, setSelectedPitchIds] = useState<Set<string>>(initPitchIds);
  const [selectedRoomIds, setSelectedRoomIds] = useState<Set<string>>(initRoomIds);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startAt = useMemo(() => item.startAt.toISOString(), [item.startAt]);
  const endAt = useMemo(() => item.endAt.toISOString(), [item.endAt]);

  const { pitchAvailability, dressingRoomAvailability } = useFacilityAvailability({
    enabled: true,
    startAt,
    endAt,
    excludeEventId: activityId,
  });

  const pitchOverrideRows = overridesByKey[planOverrideKey("MATCH", activityId, "PITCH_HALL")] ?? [];
  const roomOverrideRows = overridesByKey[planOverrideKey("MATCH", activityId, "DRESSING_ROOM")] ?? [];

  const timesValid = !!startTime && !!endTime && startTime < endTime;
  const timeChanged = startTime !== initStart || endTime !== initEnd;
  const pitchChanged = !setsEqual(selectedPitchIds, initPitchIds);
  const roomChanged = !setsEqual(selectedRoomIds, initRoomIds);
  const hasChanges = timeChanged || pitchChanged || roomChanged;

  async function handleSave() {
    if (!timesValid || !hasChanges) return;
    setSaving(true);
    setError(null);

    try {
      const nextStartAt = combineTimeWithReferenceDay(startTime, item.startAt, timezone);
      const nextEndAt = combineTimeWithReferenceDay(endTime, item.endAt, timezone);
      if (!nextStartAt || !nextEndAt) throw new Error("Bitte gültige Uhrzeiten angeben.");

      if (timeChanged) {
        const matchesCanonical = startTime === canonicalStart && endTime === canonicalEnd;
        await saveTimeOverride(planId, "MATCH", activityId, nextStartAt, nextEndAt, matchesCanonical);
      }

      if (pitchChanged) {
        if (setsEqual(selectedPitchIds, canonicalPitchIds)) {
          await deleteAllocationOverrides(planId, pitchOverrideRows);
        } else {
          await replaceAllocationOverrides(
            planId,
            "MATCH",
            activityId,
            "PITCH_HALL",
            undefined,
            Array.from(selectedPitchIds),
            pitchOverrideRows,
          );
        }
      }

      if (roomChanged) {
        if (setsEqual(selectedRoomIds, canonicalRoomIds)) {
          await deleteAllocationOverrides(planId, roomOverrideRows);
        } else {
          await replaceAllocationOverrides(
            planId,
            "MATCH",
            activityId,
            "DRESSING_ROOM",
            undefined,
            Array.from(selectedRoomIds),
            roomOverrideRows,
          );
        }
      }

      router.refresh();
      onSaved();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Speichern fehlgeschlagen.";
      setError(message);
      setSaving(false);
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title="Planung bearbeiten"
      description={`${item.teamNames[0] ?? item.title} vs. ${item.opponentName ?? "TBD"}`}
      footer={
        <>
          <button type="button" onClick={onClose} className="fca-button-secondary text-sm">
            Abbrechen
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !hasChanges || !timesValid}
            data-testid="weekplanner-operational-save"
            className="fca-button-primary text-sm"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Speichern
          </button>
        </>
      }
    >
      <div data-testid="weekplanner-operational-editor" className="space-y-6">
        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="space-y-2">
          <SectionLabel>Zeit</SectionLabel>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1" htmlFor={`${formId}-start`}>
              <span className="fca-label">Beginn</span>
              <input id={`${formId}-start`} type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="fca-input" />
            </label>
            <label className="block space-y-1" htmlFor={`${formId}-end`}>
              <span className="fca-label">Ende</span>
              <input id={`${formId}-end`} type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="fca-input" />
            </label>
          </div>
        </div>

        <div className="space-y-2">
          <SectionLabel>Ressourcen · Platz</SectionLabel>
          <VisualResourceAvailabilityPicker
            facilityGroups={facilityGroupsByAllocationGroup.PITCH_HALL}
            selectedResourceIds={selectedPitchIds}
            onSelect={(id) => setSelectedPitchIds(new Set([id]))}
            onDeselect={() => setSelectedPitchIds(new Set())}
            availabilityByResourceId={pitchAvailability}
            disabled={saving}
            singleSelect
            compact
            testId="weekplanner-operational-match-pitch"
          />
        </div>

        <div className="space-y-2">
          <SectionLabel>Garderobe · Heim</SectionLabel>
          <VisualDressingRoomPicker
            facilityGroups={facilityGroupsByAllocationGroup.DRESSING_ROOM}
            selectedResourceIds={selectedRoomIds}
            onSelect={(id) => setSelectedRoomIds(new Set([id]))}
            onDeselect={() => setSelectedRoomIds(new Set())}
            availabilityByResourceId={dressingRoomAvailability}
            disabled={saving}
            singleSelect
            compact
            testId="weekplanner-operational-match-room"
          />
        </div>
      </div>
    </Sheet>
  );
}

function TournamentOperationalEditor({
  item,
  planId,
  overridesByKey,
  facilityGroupsByAllocationGroup,
  timezone,
  onClose,
  onSaved,
}: {
  item: Extract<WeekplannerItem, { type: "TOURNAMENT" }>;
} & Omit<Props, "item" | "planName">) {
  const router = useRouter();
  const formId = useId();
  const activityId = item.eventId;

  const initStart = toTimeInputValue(item.startAt, timezone);
  const initEnd = toTimeInputValue(item.endAt, timezone);
  const canonicalStart = toTimeInputValue(item.canonicalStartAt, timezone);
  const canonicalEnd = toTimeInputValue(item.canonicalEndAt, timezone);
  const initPitchIds = new Set(item.pitchAllocations.map((r) => r.facilityResourceId));
  const canonicalPitchIds = new Set(item.canonicalPitchAllocations.map((r) => r.facilityResourceId));

  const [startTime, setStartTime] = useState(initStart);
  const [endTime, setEndTime] = useState(initEnd);
  const [selectedPitchIds, setSelectedPitchIds] = useState<Set<string>>(initPitchIds);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startAt = useMemo(() => item.startAt.toISOString(), [item.startAt]);
  const endAt = useMemo(() => item.endAt.toISOString(), [item.endAt]);

  const { pitchAvailability } = useFacilityAvailability({
    enabled: true,
    startAt,
    endAt,
    excludeEventId: activityId,
  });

  const pitchOverrideRows = overridesByKey[planOverrideKey("TOURNAMENT", activityId, "PITCH_HALL")] ?? [];

  const timesValid = !!startTime && !!endTime && startTime < endTime;
  const timeChanged = startTime !== initStart || endTime !== initEnd;
  const pitchChanged = !setsEqual(selectedPitchIds, initPitchIds);
  const hasChanges = timeChanged || pitchChanged;

  async function handleSave() {
    if (!timesValid || !hasChanges) return;
    setSaving(true);
    setError(null);

    try {
      const nextStartAt = combineTimeWithReferenceDay(startTime, item.startAt, timezone);
      const nextEndAt = combineTimeWithReferenceDay(endTime, item.endAt, timezone);
      if (!nextStartAt || !nextEndAt) throw new Error("Bitte gültige Uhrzeiten angeben.");

      if (timeChanged) {
        const matchesCanonical = startTime === canonicalStart && endTime === canonicalEnd;
        await saveTimeOverride(planId, "TOURNAMENT", activityId, nextStartAt, nextEndAt, matchesCanonical);
      }

      if (pitchChanged) {
        if (setsEqual(selectedPitchIds, canonicalPitchIds)) {
          await deleteAllocationOverrides(planId, pitchOverrideRows);
        } else {
          await replaceAllocationOverrides(
            planId,
            "TOURNAMENT",
            activityId,
            "PITCH_HALL",
            undefined,
            Array.from(selectedPitchIds),
            pitchOverrideRows,
          );
        }
      }

      router.refresh();
      onSaved();
    } catch (err) {
      const message = err instanceof Error ? err.message : "Speichern fehlgeschlagen.";
      setError(message);
      setSaving(false);
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title="Planung bearbeiten"
      description={item.title}
      footer={
        <>
          <button type="button" onClick={onClose} className="fca-button-secondary text-sm">
            Abbrechen
          </button>
          <button
            type="button"
            onClick={handleSave}
            disabled={saving || !hasChanges || !timesValid}
            data-testid="weekplanner-operational-save"
            className="fca-button-primary text-sm"
          >
            {saving ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Check className="h-3.5 w-3.5" />}
            Speichern
          </button>
        </>
      }
    >
      <div data-testid="weekplanner-operational-editor" className="space-y-6">
        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        <div className="space-y-2">
          <SectionLabel>Zeit</SectionLabel>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="block space-y-1" htmlFor={`${formId}-start`}>
              <span className="fca-label">Beginn</span>
              <input id={`${formId}-start`} type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="fca-input" />
            </label>
            <label className="block space-y-1" htmlFor={`${formId}-end`}>
              <span className="fca-label">Ende</span>
              <input id={`${formId}-end`} type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="fca-input" />
            </label>
          </div>
        </div>

        <div className="space-y-2">
          <SectionLabel>Ressourcen · Platz</SectionLabel>
          <VisualResourceAvailabilityPicker
            facilityGroups={facilityGroupsByAllocationGroup.PITCH_HALL}
            selectedResourceIds={selectedPitchIds}
            onSelect={(id) => setSelectedPitchIds((prev) => new Set([...prev, id]))}
            onDeselect={(id) =>
              setSelectedPitchIds((prev) => {
                const next = new Set(prev);
                next.delete(id);
                return next;
              })
            }
            availabilityByResourceId={pitchAvailability}
            disabled={saving}
            compact
            testId="weekplanner-operational-tournament-pitch"
          />
        </div>
      </div>
    </Sheet>
  );
}

export function WeekplannerOperationalPlanningSheet({
  item,
  planId,
  planName: _planName,
  overridesByKey,
  facilityGroupsByAllocationGroup,
  timezone,
  onClose,
  onSaved,
}: Props) {
  if (!item) return null;

  const shared = {
    planId,
    overridesByKey,
    facilityGroupsByAllocationGroup,
    timezone,
    onClose,
    onSaved,
  };

  if (item.type === "TRAINING") {
    return <TrainingOperationalEditor item={item} {...shared} />;
  }
  if (item.type === "MATCH") {
    return <MatchOperationalEditor item={item} {...shared} />;
  }
  if (item.type === "TOURNAMENT") {
    return <TournamentOperationalEditor item={item} {...shared} />;
  }
  return null;
}
