"use client";

/**
 * components/admin/planner/WeekplannerPlanningSheet.tsx
 *
 * PLANNING-UX-C3 — Wochenplaner Premium Editing Workspace.
 *
 * Renders the canonical planning editor inside a right-side Sheet overlay
 * (~750–820 px desktop width, full viewport height) so the visual resource
 * allocator has sufficient horizontal space to render readable cards.
 *
 * The Wochenplan week grid remains visible behind the sheet for coordinator
 * context. All canonical mutation paths from WeekplannerCanonicalPlanningEditor
 * are preserved — this file is purely a layout wrapper.
 *
 * Architecture invariants:
 *   - All saves still go through the same canonical API endpoints.
 *   - Shared visual pickers (VisualResourceAvailabilityPicker,
 *     VisualDressingRoomPicker) are unchanged.
 *   - No duplicate planning records; no new availability engine.
 */

import { useId, useMemo, useState } from "react";
import { AlertCircle, Check, Loader2, Shield, Dumbbell, Trophy, Calendar, Clock } from "lucide-react";
import { useRouter } from "next/navigation";
import { cn } from "@/lib/cn";
import { Sheet } from "@/components/ui/Sheet";
import { VisualResourceAvailabilityPicker } from "@/components/admin/shared/planning/VisualResourceAvailabilityPicker";
import { VisualDressingRoomPicker } from "@/components/admin/shared/planning/VisualDressingRoomPicker";
import { useFacilityAvailability } from "@/hooks/use-facility-availability";
import type { FacilityGroup } from "@/components/admin/training/FacilityResourceSelector";
import type { WeekplannerItem } from "@/lib/weekplanner/types";
import { classifyFacilityResourceType } from "@/lib/training/allocation-groups";
import type { FacilityResourceType } from "@prisma/client";

// ── Types ─────────────────────────────────────────────────────────────────────

type SheetProps = {
  item: WeekplannerItem | null;
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

function setsEqual<T>(a: Set<T>, b: Set<T>): boolean {
  if (a.size !== b.size) return false;
  for (const v of a) if (!b.has(v)) return false;
  return true;
}

function formatLocalDate(iso: Date | string, tz: string): string {
  const d = typeof iso === "string" ? new Date(iso) : iso;
  return new Intl.DateTimeFormat("de-CH", {
    timeZone: tz,
    weekday: "long",
    day: "2-digit",
    month: "long",
    year: "numeric",
  }).format(d);
}

// ── Shared section heading ────────────────────────────────────────────────────

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-xs font-semibold uppercase tracking-wider text-[var(--muted)]">
      {children}
    </p>
  );
}

// ── Editor context header ─────────────────────────────────────────────────────

function EditorHeader({ item, timezone }: { item: WeekplannerItem; timezone: string }) {
  const typeConfig = {
    TRAINING: { icon: Dumbbell, label: "Training", badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-700" },
    MATCH: { icon: Shield, label: "Heimspiel", badgeClass: "border-blue-200 bg-blue-50 text-blue-700" },
    TOURNAMENT: { icon: Trophy, label: "Turnier", badgeClass: "border-amber-200 bg-amber-50 text-amber-700" },
  }[item.type];

  const Icon = typeConfig.icon;
  const dateLabel = formatLocalDate(item.canonicalStartAt, timezone);
  const timeLabel = `${isoToLocalTime(item.canonicalStartAt)} – ${isoToLocalTime(item.canonicalEndAt)}`;
  const title = item.type === "MATCH"
    ? `${item.teamNames[0] ?? item.title} vs. ${item.opponentName ?? "TBD"}`
    : item.title;

  return (
    <div className="mb-5 space-y-2.5 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-3">
      <div className="flex items-center gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
            typeConfig.badgeClass,
          )}
        >
          <Icon className="h-3.5 w-3.5" />
          {typeConfig.label}
        </span>
      </div>
      <p className="text-base font-semibold text-[var(--foreground)]">{title}</p>
      {item.type === "TRAINING" && item.teamNames[0] && item.teamNames[0] !== item.title && (
        <p className="text-sm text-[var(--text-2)]">{item.teamNames[0]}</p>
      )}
      <div className="flex flex-wrap items-center gap-4 text-sm text-[var(--text-2)]">
        <span className="inline-flex items-center gap-1.5">
          <Calendar className="h-3.5 w-3.5 shrink-0 text-[var(--muted)]" />
          {dateLabel}
        </span>
        <span className="inline-flex items-center gap-1.5">
          <Clock className="h-3.5 w-3.5 shrink-0 text-[var(--muted)]" />
          {timeLabel}
        </span>
      </div>
    </div>
  );
}

// ── Save / Cancel footer (lifted out so Sheet footer slot gets it) ─────────────

type FooterProps = {
  saving: boolean;
  hasChanges: boolean;
  canSave: boolean;
  onSave: () => void;
  onClose: () => void;
};

function EditorFooter({ saving, hasChanges, canSave, onSave, onClose }: FooterProps) {
  return (
    <>
      <button
        type="button"
        onClick={onClose}
        className="fca-button-secondary text-sm"
      >
        Abbrechen
      </button>
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
            Planung übernehmen
          </>
        )}
      </button>
    </>
  );
}

// ── TrainingEditor ────────────────────────────────────────────────────────────

function TrainingEditorContent({
  item,
  facilityGroupsByAllocationGroup,
  timezone,
  onClose,
  onSaved,
}: {
  item: Extract<WeekplannerItem, { type: "TRAINING" }>;
  facilityGroupsByAllocationGroup: { PITCH_HALL: FacilityGroup[]; DRESSING_ROOM: FacilityGroup[] };
  timezone: string;
  onClose: () => void;
  onSaved: () => void;
}) {
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
  const timeChanged = date !== initDate || startTime !== initStart || endTime !== initEnd;
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
        <EditorFooter
          saving={saving}
          hasChanges={hasChanges}
          canSave={timesValid}
          onSave={handleSave}
          onClose={onClose}
        />
      }
    >
      <div data-testid="weekplanner-canonical-editor" className="space-y-6">
        <EditorHeader item={item} timezone={timezone} />

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Date + time */}
        <div className="space-y-2">
          <SectionLabel>Datum & Uhrzeit</SectionLabel>
          <div className="grid gap-3 sm:grid-cols-3">
            <label className="block space-y-1">
              <span className="fca-label">Datum</span>
              <input
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                className="fca-input"
                id={`${formId}-date`}
              />
            </label>
            <label className="block space-y-1">
              <span className="fca-label">Beginn</span>
              <input
                type="time"
                value={startTime}
                onChange={(e) => setStartTime(e.target.value)}
                className="fca-input"
                id={`${formId}-start`}
              />
            </label>
            <label className="block space-y-1">
              <span className="fca-label">Ende</span>
              <input
                type="time"
                value={endTime}
                onChange={(e) => setEndTime(e.target.value)}
                className="fca-input"
                id={`${formId}-end`}
              />
            </label>
          </div>
        </div>

        {/* Pitch */}
        <div className="space-y-2">
          <SectionLabel>Spielfeld / Halle</SectionLabel>
          <VisualResourceAvailabilityPicker
            facilityGroups={facilityGroupsByAllocationGroup.PITCH_HALL}
            selectedResourceIds={selectedPitchIds}
            onSelect={(id) => setSelectedPitchIds((prev) => new Set([...prev, id]))}
            onDeselect={(id) =>
              setSelectedPitchIds((prev) => {
                const s = new Set(prev);
                s.delete(id);
                return s;
              })
            }
            availabilityByResourceId={pitchAvailability}
            disabled={saving}
            testId="wochenplaner-canonical-pitch"
          />
        </div>

        {/* Dressing room */}
        <div className="space-y-2">
          <SectionLabel>Garderobe</SectionLabel>
          <VisualDressingRoomPicker
            facilityGroups={facilityGroupsByAllocationGroup.DRESSING_ROOM}
            selectedResourceIds={selectedRoomIds}
            onSelect={(id) => setSelectedRoomIds((prev) => new Set([...prev, id]))}
            onDeselect={(id) =>
              setSelectedRoomIds((prev) => {
                const s = new Set(prev);
                s.delete(id);
                return s;
              })
            }
            availabilityByResourceId={dressingRoomAvailability}
            disabled={saving}
            testId="wochenplaner-canonical-room"
          />
        </div>
      </div>
    </Sheet>
  );
}

// ── MatchEditor ───────────────────────────────────────────────────────────────

function MatchEditorContent({
  item,
  facilityGroupsByAllocationGroup,
  timezone,
  onClose,
  onSaved,
}: {
  item: Extract<WeekplannerItem, { type: "MATCH" }>;
  facilityGroupsByAllocationGroup: { PITCH_HALL: FacilityGroup[]; DRESSING_ROOM: FacilityGroup[] };
  timezone: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const router = useRouter();

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

  const pitchGroupsByCode = useMemo(
    () =>
      facilityGroupsByAllocationGroup.PITCH_HALL.map((fg) => ({
        ...fg,
        resources: fg.resources.map((r) => ({ ...r, id: r.code })),
      })),
    [facilityGroupsByAllocationGroup.PITCH_HALL],
  );

  const roomGroupsByCode = useMemo(
    () =>
      facilityGroupsByAllocationGroup.DRESSING_ROOM.map((fg) => ({
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
      setSaving(false);
    }
  }

  const matchTitle = `${item.teamNames[0] ?? item.title} vs. ${item.opponentName ?? "TBD"}`;

  return (
    <Sheet
      open
      onClose={onClose}
      title="Spielfeld & Garderoben bearbeiten"
      description={matchTitle}
      footer={
        <EditorFooter
          saving={saving}
          hasChanges={hasChanges}
          canSave
          onSave={handleSave}
          onClose={onClose}
        />
      }
    >
      <div data-testid="weekplanner-canonical-editor" className="space-y-6">
        <EditorHeader item={item} timezone={timezone} />

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Pitch */}
        <div className="space-y-2">
          <SectionLabel>Spielfeld / Halle</SectionLabel>
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

        {/* Home dressing room */}
        <div className="space-y-2">
          <SectionLabel>Heimkabine</SectionLabel>
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

        {/* Away dressing room */}
        <div className="space-y-2">
          <SectionLabel>Gastkabine</SectionLabel>
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
      </div>
    </Sheet>
  );
}

// ── TournamentEditor ──────────────────────────────────────────────────────────

function TournamentEditorContent({
  item,
  facilityGroupsByAllocationGroup,
  timezone,
  onClose,
  onSaved,
}: {
  item: Extract<WeekplannerItem, { type: "TOURNAMENT" }>;
  facilityGroupsByAllocationGroup: { PITCH_HALL: FacilityGroup[]; DRESSING_ROOM: FacilityGroup[] };
  timezone: string;
  onClose: () => void;
  onSaved: () => void;
}) {
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
      setSaving(false);
    }
  }

  return (
    <Sheet
      open
      onClose={onClose}
      title="Spielfeld bearbeiten"
      description={item.title}
      footer={
        <EditorFooter
          saving={saving}
          hasChanges={hasChanges}
          canSave
          onSave={handleSave}
          onClose={onClose}
        />
      }
    >
      <div data-testid="weekplanner-canonical-editor" className="space-y-6">
        <EditorHeader item={item} timezone={timezone} />

        {error && (
          <div className="flex items-center gap-2 rounded-lg border border-rose-200 bg-rose-50 px-3 py-2.5 text-sm text-rose-700">
            <AlertCircle className="h-4 w-4 shrink-0" />
            {error}
          </div>
        )}

        {/* Pitch */}
        <div className="space-y-2">
          <SectionLabel>Spielfeld / Halle</SectionLabel>
          <VisualResourceAvailabilityPicker
            facilityGroups={facilityGroupsByAllocationGroup.PITCH_HALL}
            selectedResourceIds={selectedPitchIds}
            onSelect={(id) => setSelectedPitchIds((prev) => new Set([...prev, id]))}
            onDeselect={(id) =>
              setSelectedPitchIds((prev) => {
                const s = new Set(prev);
                s.delete(id);
                return s;
              })
            }
            availabilityByResourceId={pitchAvailability}
            disabled={saving}
            testId="wochenplaner-canonical-tournament-pitch"
          />
        </div>
      </div>
    </Sheet>
  );
}

// ── Main Export ───────────────────────────────────────────────────────────────

/**
 * WeekplannerPlanningSheet
 *
 * Renders the appropriate canonical editor (Training / Match / Tournament)
 * inside a right-side Sheet overlay. `item === null` means the sheet is closed.
 */
export function WeekplannerPlanningSheet({
  item,
  facilityGroupsByAllocationGroup,
  timezone,
  onClose,
  onSaved,
}: SheetProps) {
  if (!item) return null;

  if (item.type === "TRAINING") {
    return (
      <TrainingEditorContent
        item={item}
        facilityGroupsByAllocationGroup={facilityGroupsByAllocationGroup}
        timezone={timezone}
        onClose={onClose}
        onSaved={onSaved}
      />
    );
  }

  if (item.type === "MATCH") {
    return (
      <MatchEditorContent
        item={item}
        facilityGroupsByAllocationGroup={facilityGroupsByAllocationGroup}
        timezone={timezone}
        onClose={onClose}
        onSaved={onSaved}
      />
    );
  }

  if (item.type === "TOURNAMENT") {
    return (
      <TournamentEditorContent
        item={item}
        facilityGroupsByAllocationGroup={facilityGroupsByAllocationGroup}
        timezone={timezone}
        onClose={onClose}
        onSaved={onSaved}
      />
    );
  }

  return null;
}
