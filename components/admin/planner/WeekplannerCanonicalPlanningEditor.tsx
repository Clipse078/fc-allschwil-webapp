"use client";

/**
 * components/admin/planner/WeekplannerCanonicalPlanningEditor.tsx
 *
 * PLANNING-RESOURCE-UX-01 — Wochenplaner canonical planning editor.
 *
 * Allows authorized coordinators to edit time and resource allocations of
 * STANDARD PLAN Trainings, Matches and Tournaments directly from the
 * Wochenplaner, saving back to the underlying canonical entity.
 *
 * Architecture invariants:
 *   - NO duplicate planning records: all saves go through the existing
 *     canonical API endpoints (reschedule, allocations, matchcenter PATCH,
 *     tournament resource allocations).
 *   - Permissions are preserved: Training → TRAININGS_MANAGE, Match →
 *     EVENTS_MANAGE, Tournament → EVENTS_MANAGE (enforced server-side;
 *     the editor only appears when canManagePlans is true and relies on
 *     the server to validate the caller's authority per entity type).
 *   - The same shared visual pickers (VisualResourceAvailabilityPicker,
 *     VisualDressingRoomPicker) used by TrainingCenter / MatchCenter /
 *     TournamentCenter — no separate allocator.
 *   - Availability is fetched via GET /api/facilities/availability —
 *     the same endpoint, no second engine.
 *
 * Supported editing per entity type:
 *   TRAINING:
 *     - time (date + start/end): PATCH /api/training-sessions/[id]/reschedule
 *     - pitch/hall: DELETE existing session overrides → POST new session override
 *     - dressing room: same delete+add pattern
 *   MATCH:
 *     - time (start/end): PATCH /api/matchcenter/[id] (startAt/endAt fields;
 *       only if the canonical match endpoint supports it — we use pitchCode
 *       and dressing codes since time is not in scope for Match here due to
 *       provider sync constraints; we stick to resource editing)
 *     - pitch: PATCH /api/matchcenter/[id] pitchCode (derived from selected ID)
 *     - dressing rooms: PATCH /api/matchcenter/[id] homeDressingRoomCode/awayDressingRoomCode
 *   TOURNAMENT:
 *     - pitch/hall: DELETE+POST /api/tournaments/[id]/resource-allocations
 *     - dressing rooms: out of scope for Wochenplaner (per-participant complexity)
 *
 * The editor opens inline below the WeekplannerCard. It is dismissed via
 * the "Schließen" button or by another card's editor opening.
 */

import { useId, useMemo, useState } from "react";
import { Check, Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { VisualResourceAvailabilityPicker } from "@/components/admin/shared/planning/VisualResourceAvailabilityPicker";
import { VisualDressingRoomPicker } from "@/components/admin/shared/planning/VisualDressingRoomPicker";
import { useFacilityAvailability } from "@/hooks/use-facility-availability";
import type { FacilityGroup } from "@/components/admin/training/FacilityResourceSelector";
import type { WeekplannerItem } from "@/lib/weekplanner/types";
import { classifyFacilityResourceType } from "@/lib/training/allocation-groups";
import type { FacilityResourceType } from "@prisma/client";

// ── Types ─────────────────────────────────────────────────────────────────────

type Props = {
  item: WeekplannerItem;
  facilityGroupsByAllocationGroup: {
    PITCH_HALL: FacilityGroup[];
    DRESSING_ROOM: FacilityGroup[];
  };
  timezone: string;
  onClose: () => void;
  onSaved: () => void;
};

// ── Helpers ───────────────────────────────────────────────────────────────────

function isoToLocalTime(iso: Date | string): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return d.toLocaleTimeString("de-CH", { hour: "2-digit", minute: "2-digit", timeZone: "Europe/Zurich" });
}

function isoToLocalDate(iso: Date | string, tz: string): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat("en-CA", { timeZone: tz, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
}

/** Re-derive startAt ISO from a local date + HH:mm time string (Europe/Zurich only). */
function localToUtcIso(date: string, time: string, tz: string): string | null {
  if (!date || !time) return null;
  try {
    const local = `${date}T${time}:00`;
    const formatter = new Intl.DateTimeFormat("en-CA", {
      timeZone: tz,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      second: "2-digit",
    });
    const parts = formatter.formatToParts(new Date(`${local}Z`));
    const get = (type: string) => parts.find((p) => p.type === type)?.value ?? "00";
    const utcGuess = new Date(
      `${get("year")}-${get("month")}-${get("day")}T${get("hour")}:${get("minute")}:${get("second")}Z`,
    );
    const offset = new Date(local + "Z").getTime() - utcGuess.getTime();
    return new Date(new Date(local + "Z").getTime() + offset).toISOString();
  } catch {
    return null;
  }
}

function resolveResourceCode(facilityGroups: FacilityGroup[], resourceId: string): string | null {
  for (const fg of facilityGroups) {
    const r = fg.resources.find((r) => r.id === resourceId);
    if (r) return r.code;
  }
  return null;
}

// ── TrainingEditor ────────────────────────────────────────────────────────────

function TrainingEditor({
  item,
  facilityGroupsByAllocationGroup,
  timezone,
  onClose,
  onSaved,
}: Props & { item: Extract<WeekplannerItem, { type: "TRAINING" }> }) {
  const router = useRouter();
  const formId = useId();

  const initDate = isoToLocalDate(item.canonicalStartAt, timezone);
  const initStart = isoToLocalTime(item.canonicalStartAt);
  const initEnd = isoToLocalTime(item.canonicalEndAt);
  const initPitchIds = new Set(item.canonicalPitchAllocations.map((r) => r.facilityResourceId));
  const initRoomIds = new Set(item.canonicalDressingRoomAllocations.map((r) => r.facilityResourceId));

  const [date, setDate] = useState(initDate);
  const [startTime, setStartTime] = useState(initStart);
  const [endTime, setEndTime] = useState(initEnd);
  const [selectedPitchIds, setSelectedPitchIds] = useState<Set<string>>(initPitchIds);
  const [selectedRoomIds, setSelectedRoomIds] = useState<Set<string>>(initRoomIds);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startAt = useMemo(() => {
    if (!date || !startTime) return "";
    return localToUtcIso(date, startTime, timezone) ?? "";
  }, [date, startTime, timezone]);

  const endAt = useMemo(() => {
    if (!date || !endTime) return "";
    return localToUtcIso(date, endTime, timezone) ?? "";
  }, [date, endTime, timezone]);

  const { pitchAvailability, dressingRoomAvailability } = useFacilityAvailability({
    enabled: !!startAt,
    startAt,
    endAt,
    excludeTrainingSessionId: item.trainingSessionId,
  });

  const timesValid = !!startTime && !!endTime && startTime < endTime;
  const timeChanged =
    date !== initDate || startTime !== initStart || endTime !== initEnd;
  const pitchChanged = !setsEqual(selectedPitchIds, initPitchIds);
  const roomChanged = !setsEqual(selectedRoomIds, initRoomIds);
  const hasChanges = timeChanged || pitchChanged || roomChanged;

  async function handleSave() {
    if (!timesValid || !hasChanges) return;
    setSaving(true);
    setError(null);

    try {
      const sessionId = item.trainingSessionId;

      if (timeChanged) {
        const res = await fetch(`/api/training-sessions/${sessionId}/reschedule`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ date, startsAt: startTime, endsAt: endTime }),
        });
        if (!res.ok) {
          const data = (await res.json().catch(() => null)) as { error?: string } | null;
          throw new Error(data?.error ?? "Zeitänderung fehlgeschlagen.");
        }
      }

      if (pitchChanged || roomChanged) {
        const currentAllocationsRes = await fetch(`/api/training-sessions/${sessionId}/allocations`);
        const currentData = (await currentAllocationsRes.json().catch(() => null)) as
          | { allocations?: Array<{ id: string; facilityResourceType: string }> }
          | null;
        const currentAllocations = currentData?.allocations ?? [];

        const pitchAllocations = currentAllocations.filter(
          (a) => classifyFacilityResourceType(a.facilityResourceType as FacilityResourceType) === "PITCH_HALL",
        );
        const roomAllocations = currentAllocations.filter(
          (a) => classifyFacilityResourceType(a.facilityResourceType as FacilityResourceType) === "DRESSING_ROOM",
        );

        const toDelete = [
          ...(pitchChanged ? pitchAllocations : []),
          ...(roomChanged ? roomAllocations : []),
        ];

        await Promise.all(
          toDelete.map((a) =>
            fetch(`/api/training-sessions/${sessionId}/allocations/${a.id}`, { method: "DELETE" }),
          ),
        );

        const toAdd = [
          ...(pitchChanged ? Array.from(selectedPitchIds) : []),
          ...(roomChanged ? Array.from(selectedRoomIds) : []),
        ];

        for (const resourceId of toAdd) {
          const res = await fetch(`/api/training-sessions/${sessionId}/allocations`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ facilityResourceId: resourceId }),
          });
          if (!res.ok) {
            const data = (await res.json().catch(() => null)) as { error?: string } | null;
            console.warn("Allocation add failed:", data?.error);
          }
        }
      }

      router.refresh();
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <EditorShell onClose={onClose} title="Planung bearbeiten" error={error}>
      <div className="grid gap-3 md:grid-cols-3">
        <label className="block space-y-1">
          <span className="fca-label">Datum</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="fca-input" id={`${formId}-date`} />
        </label>
        <label className="block space-y-1">
          <span className="fca-label">Start</span>
          <input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} className="fca-input" id={`${formId}-start`} />
        </label>
        <label className="block space-y-1">
          <span className="fca-label">Ende</span>
          <input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} className="fca-input" id={`${formId}-end`} />
        </label>
      </div>

      <div className="space-y-1">
        <p className="fca-label">Spielfeld / Halle</p>
        <VisualResourceAvailabilityPicker
          facilityGroups={facilityGroupsByAllocationGroup.PITCH_HALL}
          selectedResourceIds={selectedPitchIds}
          onSelect={(id) => setSelectedPitchIds((prev) => new Set([...prev, id]))}
          onDeselect={(id) => setSelectedPitchIds((prev) => { const s = new Set(prev); s.delete(id); return s; })}
          availabilityByResourceId={pitchAvailability}
          disabled={saving}
          testId="wochenplaner-canonical-pitch"
        />
      </div>

      <div className="space-y-1">
        <p className="fca-label">Garderobe</p>
        <VisualDressingRoomPicker
          facilityGroups={facilityGroupsByAllocationGroup.DRESSING_ROOM}
          selectedResourceIds={selectedRoomIds}
          onSelect={(id) => setSelectedRoomIds((prev) => new Set([...prev, id]))}
          onDeselect={(id) => setSelectedRoomIds((prev) => { const s = new Set(prev); s.delete(id); return s; })}
          availabilityByResourceId={dressingRoomAvailability}
          disabled={saving}
          testId="wochenplaner-canonical-room"
        />
      </div>

      <SaveRow saving={saving} hasChanges={hasChanges} canSave={timesValid} onSave={handleSave} onClose={onClose} />
    </EditorShell>
  );
}

// ── MatchEditor ───────────────────────────────────────────────────────────────

function MatchEditor({
  item,
  facilityGroupsByAllocationGroup,
  timezone,
  onClose,
  onSaved,
}: Props & { item: Extract<WeekplannerItem, { type: "MATCH" }> }) {
  const router = useRouter();

  // Match events still use legacy string codes
  const initPitchCode = item.canonicalPitchAllocations[0]?.code ?? "";
  const initHomeDressingCode = item.canonicalDressingRoomAllocations[0]?.code ?? "";
  const initAwayDressingCode = item.awayDressingRoomAllocations[0]?.code ?? "";

  const [pitchCode, setPitchCode] = useState(initPitchCode);
  const [homeDressingCode, setHomeDressingCode] = useState(initHomeDressingCode);
  const [awayDressingCode, setAwayDressingCode] = useState(initAwayDressingCode);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startAt = useMemo(() => item.canonicalStartAt.toISOString(), [item.canonicalStartAt]);
  const endAt = useMemo(() => item.canonicalEndAt.toISOString(), [item.canonicalEndAt]);

  const { pitchAvailability: pitchAvByCode, dressingRoomAvailability: roomAvByCode } = useFacilityAvailability({
    enabled: true,
    startAt,
    endAt,
    excludeEventId: item.eventId,
    keyBy: "code",
  });

  // Build code-as-ID groups for visual pickers
  const pitchGroupsByCode = useMemo(
    () => facilityGroupsByAllocationGroup.PITCH_HALL.map((fg) => ({
      ...fg,
      resources: fg.resources.map((r) => ({ ...r, id: r.code })),
    })),
    [facilityGroupsByAllocationGroup.PITCH_HALL],
  );
  const roomGroupsByCode = useMemo(
    () => facilityGroupsByAllocationGroup.DRESSING_ROOM.map((fg) => ({
      ...fg,
      resources: fg.resources.map((r) => ({ ...r, id: r.code })),
    })),
    [facilityGroupsByAllocationGroup.DRESSING_ROOM],
  );

  const hasChanges =
    pitchCode !== initPitchCode ||
    homeDressingCode !== initHomeDressingCode ||
    awayDressingCode !== initAwayDressingCode;

  async function handleSave() {
    if (!hasChanges) return;
    setSaving(true);
    setError(null);

    try {
      const body: Record<string, string | null> = {
        pitchCode: pitchCode || null,
        homeDressingRoomCode: homeDressingCode || null,
        awayDressingRoomCode: awayDressingCode || null,
      };
      const res = await fetch(`/api/matchcenter/${item.eventId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const data = (await res.json().catch(() => null)) as { error?: string } | null;
        throw new Error(data?.error ?? "Speichern fehlgeschlagen.");
      }
      router.refresh();
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <EditorShell onClose={onClose} title="Spielfeld & Garderoben bearbeiten" error={error}>
      <div className="space-y-1">
        <p className="fca-label">Spielfeld / Halle</p>
        <VisualResourceAvailabilityPicker
          facilityGroups={pitchGroupsByCode}
          selectedResourceIds={pitchCode ? new Set([pitchCode]) : new Set()}
          onSelect={(code) => setPitchCode(code)}
          onDeselect={() => setPitchCode("")}
          availabilityByResourceId={pitchAvByCode}
          disabled={saving}
          singleSelect
          testId="wochenplaner-canonical-match-pitch"
        />
      </div>

      <div className="space-y-1">
        <p className="fca-label">Heimkabine</p>
        <VisualDressingRoomPicker
          facilityGroups={roomGroupsByCode}
          selectedResourceIds={homeDressingCode ? new Set([homeDressingCode]) : new Set()}
          onSelect={(code) => setHomeDressingCode(code)}
          onDeselect={() => setHomeDressingCode("")}
          availabilityByResourceId={roomAvByCode}
          disabled={saving}
          singleSelect
          testId="wochenplaner-canonical-match-home-room"
        />
      </div>

      <div className="space-y-1">
        <p className="fca-label">Gastkabine</p>
        <VisualDressingRoomPicker
          facilityGroups={roomGroupsByCode}
          selectedResourceIds={awayDressingCode ? new Set([awayDressingCode]) : new Set()}
          onSelect={(code) => setAwayDressingCode(code)}
          onDeselect={() => setAwayDressingCode("")}
          availabilityByResourceId={roomAvByCode}
          disabled={saving}
          singleSelect
          testId="wochenplaner-canonical-match-away-room"
        />
      </div>

      <SaveRow saving={saving} hasChanges={hasChanges} canSave onSave={handleSave} onClose={onClose} />
    </EditorShell>
  );
}

// ── TournamentEditor ──────────────────────────────────────────────────────────

function TournamentEditor({
  item,
  facilityGroupsByAllocationGroup,
  timezone,
  onClose,
  onSaved,
}: Props & { item: Extract<WeekplannerItem, { type: "TOURNAMENT" }> }) {
  const router = useRouter();

  const initPitchIds = new Set(item.canonicalPitchAllocations.map((r) => r.facilityResourceId));
  const [selectedPitchIds, setSelectedPitchIds] = useState<Set<string>>(initPitchIds);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const startAt = useMemo(() => item.canonicalStartAt.toISOString(), [item.canonicalStartAt]);
  const endAt = useMemo(() => item.canonicalEndAt.toISOString(), [item.canonicalEndAt]);

  const { pitchAvailability } = useFacilityAvailability({
    enabled: true,
    startAt,
    endAt,
    excludeEventId: item.eventId,
  });

  const hasChanges = !setsEqual(selectedPitchIds, initPitchIds);

  async function handleSave() {
    if (!hasChanges) return;
    setSaving(true);
    setError(null);

    try {
      const toRemove = Array.from(initPitchIds).filter((id) => !selectedPitchIds.has(id));
      const toAdd = Array.from(selectedPitchIds).filter((id) => !initPitchIds.has(id));

      // Delete removed allocations — we need the allocation IDs from the server
      const allocsRes = await fetch(`/api/tournaments/${item.eventId}/resource-allocations`);
      const allocsData = (await allocsRes.json().catch(() => null)) as
        | { allocations?: Array<{ id: string; facilityResourceId: string }> }
        | null;
      const existingAllocs = allocsData?.allocations ?? [];

      await Promise.all(
        toRemove
          .map((resourceId) => existingAllocs.find((a) => a.facilityResourceId === resourceId))
          .filter(Boolean)
          .map((a) =>
            fetch(`/api/tournaments/${item.eventId}/resource-allocations/${a!.id}`, { method: "DELETE" }),
          ),
      );

      await Promise.all(
        toAdd.map((resourceId) =>
          fetch(`/api/tournaments/${item.eventId}/resource-allocations`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ facilityResourceId: resourceId }),
          }),
        ),
      );

      router.refresh();
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Speichern fehlgeschlagen.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <EditorShell onClose={onClose} title="Spielfeld bearbeiten" error={error}>
      <VisualResourceAvailabilityPicker
        facilityGroups={facilityGroupsByAllocationGroup.PITCH_HALL}
        selectedResourceIds={selectedPitchIds}
        onSelect={(id) => setSelectedPitchIds((prev) => new Set([...prev, id]))}
        onDeselect={(id) => setSelectedPitchIds((prev) => { const s = new Set(prev); s.delete(id); return s; })}
        availabilityByResourceId={pitchAvailability}
        disabled={saving}
        testId="wochenplaner-canonical-tournament-pitch"
      />

      <SaveRow saving={saving} hasChanges={hasChanges} canSave onSave={handleSave} onClose={onClose} />
    </EditorShell>
  );
}

// ── Shared sub-components ─────────────────────────────────────────────────────

function EditorShell({
  title,
  error,
  onClose,
  children,
}: {
  title: string;
  error: string | null;
  onClose: () => void;
  children: React.ReactNode;
}) {
  return (
    <div
      className="mt-3 rounded-xl border border-[var(--sce-primary)] bg-[var(--surface)] shadow-md"
      data-testid="weekplanner-canonical-editor"
    >
      <div className="flex items-center justify-between border-b border-[var(--border)] px-4 py-2.5">
        <p className="text-sm font-semibold text-[var(--foreground)]">{title}</p>
        <button
          type="button"
          onClick={onClose}
          aria-label="Schließen"
          className="rounded p-1 text-[var(--muted)] transition hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
        >
          <X className="h-4 w-4" />
        </button>
      </div>
      <div className="space-y-4 p-4">
        {children}
        {error && (
          <p className="rounded-lg border border-rose-200 bg-rose-50 px-3 py-2 text-sm text-rose-700">{error}</p>
        )}
      </div>
    </div>
  );
}

function SaveRow({
  saving,
  hasChanges,
  canSave,
  onSave,
  onClose,
}: {
  saving: boolean;
  hasChanges: boolean;
  canSave: boolean;
  onSave: () => void;
  onClose: () => void;
}) {
  return (
    <div className="flex items-center gap-2 border-t border-[var(--border)] pt-3">
      <button
        type="button"
        onClick={onSave}
        disabled={saving || !hasChanges || !canSave}
        className="fca-button-primary text-sm"
        data-testid="weekplanner-canonical-save"
      >
        {saving ? (
          <>
            <Loader2 className="h-3.5 w-3.5 animate-spin" />
            Speichern…
          </>
        ) : (
          <>
            <Check className="h-3.5 w-3.5" />
            Änderungen speichern
          </>
        )}
      </button>
      <button
        type="button"
        onClick={onClose}
        className="fca-button-secondary text-sm"
      >
        Abbrechen
      </button>
      {!hasChanges && <p className="text-xs text-[var(--muted)]">Keine Änderungen.</p>}
    </div>
  );
}

function setsEqual<T>(a: Set<T>, b: Set<T>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

// ── Main Export ───────────────────────────────────────────────────────────────

export function WeekplannerCanonicalPlanningEditor(props: Props) {
  const { item } = props;

  if (item.type === "TRAINING") {
    return <TrainingEditor {...props} item={item} />;
  }
  if (item.type === "MATCH") {
    return <MatchEditor {...props} item={item} />;
  }
  if (item.type === "TOURNAMENT") {
    return <TournamentEditor {...props} item={item} />;
  }
  return null;
}
