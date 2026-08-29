"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  DoorOpen,
  Dumbbell,
  Info,
  MapPin,
  Shield,
  Trophy,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { SectionCard } from "@/components/ui/page/SectionCard";
import { EmptyState } from "@/components/ui/page/EmptyState";
import AdminSectionHeader from "@/components/admin/shared/AdminSectionHeader";
import type {
  WeekplannerDay,
  WeekplannerItem,
  WeekplannerResourceRef,
  WeekplannerWeek,
} from "@/lib/weekplanner/types";
import type { WeekplannerPlanDto } from "@/lib/weekplanner/plan-types";
import type { WochenplanPlanDto } from "@/lib/wochenplan/plan-types";
import { planOverrideKey } from "@/lib/weekplanner/plan-override-key";
import { WeekplannerPlanBar } from "./WeekplannerPlanBar";
import {
  WeekplannerAllocationOverrideEditor,
  type WeekplannerOverrideRow,
} from "./WeekplannerAllocationOverrideEditor";
import { WeekplannerActivityTimeOverrideEditor } from "./WeekplannerActivityTimeOverrideEditor";
import { WeekplannerActivityOverridePanel } from "./WeekplannerActivityOverridePanel";
import { WeekplannerOverridePanelProvider } from "./WeekplannerOverridePanelContext";
import type { FacilityGroup } from "@/components/admin/training/FacilityResourceSelector";
import { WeekplannerPlanningSheet } from "./WeekplannerPlanningSheet";

/**
 * WEEKPLANNER-01B — populated only when an alternative plan is selected AND
 * the caller can manage plans.
 */
type OverrideEditingContext = {
  planId: string;
  planName: string;
  overridesByKey: Record<string, WeekplannerOverrideRow[]>;
  facilityGroupsByAllocationGroup: { PITCH_HALL: FacilityGroup[]; DRESSING_ROOM: FacilityGroup[] };
};

const CANONICAL_MODULE_HREF: Record<WeekplannerItem["type"], { label: string; href: string }> = {
  TRAINING: { label: "TrainingCenter", href: "/dashboard/training" },
  MATCH: { label: "Matchcenter", href: "/dashboard/matchcenter" },
  TOURNAMENT: { label: "TournamentCenter", href: "/dashboard/tournamentcenter" },
};

/**
 * PLANNING-RESOURCE-UX-01 — Standardplan canonical editing context.
 */
type CanonicalEditingContext = {
  canManageTrainings: boolean;
  canManageEvents: boolean;
  facilityGroupsByAllocationGroup: { PITCH_HALL: FacilityGroup[]; DRESSING_ROOM: FacilityGroup[] };
};

type WeekPlannerPageProps = {
  week: WeekplannerWeek;
  todayParam: string;
  locale?: string;
  timezone?: string;
  wochenplanPlans?: WochenplanPlanDto[];
  plans?: WeekplannerPlanDto[];
  viewedWochenplanPlanId?: string | null;
  selectedPlanParam?: string | null;
  materializedWeekplannerPlanId?: string | null;
  activePlanId?: string | null;
  canManagePlans?: boolean;
  overrideEditing?: OverrideEditingContext;
  canonicalEditing?: CanonicalEditingContext;
};

const TYPE_META: Record<
  WeekplannerItem["type"],
  { label: string; badgeClass: string; icon: typeof Dumbbell }
> = {
  TRAINING: {
    label: "Training",
    badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-700",
    icon: Dumbbell,
  },
  MATCH: {
    label: "Match",
    badgeClass: "border-blue-200 bg-blue-50 text-blue-700",
    icon: Shield,
  },
  TOURNAMENT: {
    label: "Turnier",
    badgeClass: "border-amber-200 bg-amber-50 text-amber-700",
    icon: Trophy,
  },
};

function weekHref(param: string): string {
  return `/dashboard/planner/week?week=${encodeURIComponent(param)}`;
}

function formatTimeRange(startAt: Date, endAt: Date, locale: string, timeZone: string): string {
  const fmt = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", timeZone });
  const start = fmt.format(startAt);
  const end = fmt.format(endAt);
  return start === end ? start : `${start} – ${end}`;
}

function formatDayHeading(dayKey: string, locale: string, timeZone: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "2-digit",
    month: "2-digit",
    timeZone,
  }).format(new Date(`${dayKey}T12:00:00.000Z`));
}

function isToday(dayKey: string, timeZone: string): boolean {
  const todayKey = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());
  return dayKey === todayKey;
}

function ResourceChips({
  icon: Icon,
  refs,
  emptyLabel,
  overridden,
}: {
  icon: typeof MapPin;
  refs: WeekplannerResourceRef[];
  emptyLabel?: string;
  overridden?: boolean;
}) {
  if (refs.length === 0) {
    // Empty label is now handled by IncompletePlanningBadge for required resources.
    // Retain display only for non-required contexts (training dressing rooms).
    return emptyLabel ? (
      <span className="inline-flex items-center gap-1 text-[11px] text-[var(--muted)]">
        <Icon className="h-3 w-3" />
        {emptyLabel}
      </span>
    ) : null;
  }

  return (
    <div className="flex flex-wrap items-center gap-1">
      {refs.map((ref) => (
        <span
          key={ref.facilityResourceId}
          className={cn(
            "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px] font-medium",
            overridden
              ? "border-blue-200 bg-blue-50 text-blue-700"
              : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-2)]",
          )}
          title={ref.facilityName}
        >
          <Icon className="h-3 w-3" />
          {ref.name}
        </span>
      ))}
    </div>
  );
}

function isItemOverridden(item: WeekplannerItem): boolean {
  const resourceOverridden =
    item.pitchOverridden ||
    item.dressingRoomOverridden ||
    (item.type === "TOURNAMENT" && item.participantAllocations.some((p) => p.dressingRoomOverridden));
  return item.timeOverridden || resourceOverridden;
}

function formatStandardSummary(item: WeekplannerItem, locale: string, timeZone: string): string {
  const parts = [formatTimeRange(item.canonicalStartAt, item.canonicalEndAt, locale, timeZone)];
  for (const ref of item.canonicalPitchAllocations) parts.push(ref.name);
  for (const ref of item.canonicalDressingRoomAllocations) parts.push(ref.name);
  return parts.join(" · ");
}

function OverrideIndicator({
  item,
  planName,
  locale,
  timezone,
}: {
  item: WeekplannerItem;
  planName: string;
  locale: string;
  timezone: string;
}) {
  if (!isItemOverridden(item)) return null;

  return (
    <div className="mt-1.5 space-y-0.5" data-testid="weekplanner-override-indicator">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-600">{planName} angepasst</p>
      <p className="text-[10px] text-[var(--muted)]">Standard: {formatStandardSummary(item, locale, timezone)}</p>
    </div>
  );
}

function ConflictBadge({ item }: { item: WeekplannerItem }) {
  if (item.conflicts.length === 0) return null;

  const resourceNames = item.conflicts.map((c) => c.facilityResourceName).join(", ");

  return (
    <div
      className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-rose-200 bg-rose-50 px-2.5 py-1 text-[11px] font-semibold text-rose-700"
      title={`Doppelbelegung: ${resourceNames}`}
      data-testid="weekplanner-conflict-badge"
    >
      <AlertTriangle className="h-3.5 w-3.5" />
      Doppelbelegung · {resourceNames}
    </div>
  );
}

/**
 * PLANNING-UX-C3 — AMBER urgency badge for incomplete planning.
 *
 * Returns the list of missing required resources for an item based on the
 * effective allocations for the current plan view:
 *   TRAINING:   pitch required
 *   MATCH HOME: pitch + home dressing room + away dressing room
 *   TOURNAMENT: pitch required
 *
 * The Weekplanner only surfaces HOME matches and HOME tournaments
 * (WeekplannerMatchItem.homeAway === "HOME"), so away-match false-positive
 * flagging is structurally impossible.
 */
function getMissingAllocations(item: WeekplannerItem): string[] {
  const missing: string[] = [];

  if (item.pitchAllocations.length === 0) {
    missing.push("Spielfeld");
  }

  if (item.type === "MATCH") {
    if (item.dressingRoomAllocations.length === 0) {
      missing.push("Heimkabine");
    }
    if (item.awayDressingRoomAllocations.length === 0) {
      missing.push("Gastkabine");
    }
  }

  return missing;
}

/**
 * PLANNING-UX-C3 — compact amber attention treatment for cards with
 * incomplete planning. Aggregates all missing resources into one badge
 * rather than showing per-resource noise.
 */
function IncompletePlanningBadge({
  missing,
  onEdit,
}: {
  missing: string[];
  onEdit?: () => void;
}) {
  if (missing.length === 0) return null;

  return (
    <div
      className="mt-2 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5"
      data-testid="weekplanner-incomplete-badge"
    >
      <div className="flex items-start gap-1.5">
        <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0 text-amber-600" />
        <div className="min-w-0">
          <p className="text-[11px] font-semibold text-amber-800">Planung unvollständig</p>
          <p className="text-[11px] text-amber-700">{missing.join(" · ")}</p>
        </div>
        {onEdit && (
          <button
            type="button"
            onClick={onEdit}
            className="ml-auto shrink-0 text-[11px] font-medium text-amber-800 underline underline-offset-2 hover:text-amber-900"
          >
            Bearbeiten
          </button>
        )}
      </div>
    </div>
  );
}

function activityIdOf(item: WeekplannerItem): string {
  return item.type === "TRAINING" ? item.trainingSessionId : item.eventId;
}

function WeekplannerCard({
  item,
  locale,
  timezone,
  planName,
  overrideEditing,
  canonicalEditing,
  onEdit,
}: {
  item: WeekplannerItem;
  locale: string;
  timezone: string;
  planName?: string | null;
  overrideEditing?: OverrideEditingContext;
  canonicalEditing?: CanonicalEditingContext;
  /** PLANNING-UX-C3 — opens the Sheet editor for this item. Undefined = editing not available. */
  onEdit?: (item: WeekplannerItem) => void;
}) {
  const meta = TYPE_META[item.type];
  const Icon = meta.icon;
  const hasConflict = item.conflicts.length > 0;
  const activityId = activityIdOf(item);
  const activityKey = `${item.type}:${activityId}`;

  const isStandardplan = !planName;
  const canEditThisItem =
    canonicalEditing &&
    ((item.type === "TRAINING" && canonicalEditing.canManageTrainings) ||
      ((item.type === "MATCH" || item.type === "TOURNAMENT") && canonicalEditing.canManageEvents));
  const showCanonicalEditButton = isStandardplan && canEditThisItem && !!onEdit;

  // PLANNING-UX-C3 — incomplete planning detection
  const missingAllocations = isStandardplan ? getMissingAllocations(item) : [];

  const timeEditor = overrideEditing ? (
    <WeekplannerActivityTimeOverrideEditor
      planId={overrideEditing.planId}
      activityType={item.type}
      activityId={activityId}
      effectiveStartAt={item.startAt.toISOString()}
      effectiveEndAt={item.endAt.toISOString()}
      isOverridden={item.timeOverridden}
      timeZone={timezone}
    />
  ) : null;

  return (
    <div
      className={cn(
        "rounded-[16px] border bg-[var(--surface)] p-3.5 shadow-sm",
        hasConflict ? "border-rose-300" : "border-[var(--border)]",
      )}
      data-testid={`weekplanner-item-${item.type.toLowerCase()}`}
    >
      <div className="flex items-start justify-between gap-2">
        <span
          className={cn(
            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold",
            meta.badgeClass,
          )}
        >
          <Icon className="h-3.5 w-3.5" />
          {meta.label}
        </span>
        <span className="shrink-0 text-xs font-semibold text-[var(--text-2)]">
          {formatTimeRange(item.startAt, item.endAt, locale, timezone)}
        </span>
      </div>

      {item.type === "TRAINING" && (
        <div className="mt-2.5">
          <p className="text-sm font-semibold text-[var(--foreground)]">{item.teamNames[0] ?? item.title}</p>
          <p className="mt-0.5 text-xs text-[var(--text-2)]">{item.title}</p>
          <div className="mt-2 space-y-1">
            <ResourceChips icon={MapPin} refs={item.pitchAllocations} overridden={item.pitchOverridden} />
            <ResourceChips icon={DoorOpen} refs={item.dressingRoomAllocations} overridden={item.dressingRoomOverridden} />
          </div>
          {planName && <OverrideIndicator item={item} planName={planName} locale={locale} timezone={timezone} />}
          {overrideEditing && (
            <WeekplannerActivityOverridePanel activityKey={activityKey}>
              {timeEditor}
              <WeekplannerAllocationOverrideEditor
                planId={overrideEditing.planId}
                planName={overrideEditing.planName}
                activityType="TRAINING"
                activityId={activityId}
                allocationGroup="PITCH_HALL"
                label="Spielfeld/Halle"
                standardplanAllocations={toStandardplanRows(item.pitchAllocations)}
                initialOverrideAllocations={overrideEditing.overridesByKey[planOverrideKey("TRAINING", activityId, "PITCH_HALL")] ?? []}
                facilityGroups={overrideEditing.facilityGroupsByAllocationGroup.PITCH_HALL}
                startAt={item.startAt.toISOString()}
                endAt={item.endAt.toISOString()}
              />
              <WeekplannerAllocationOverrideEditor
                planId={overrideEditing.planId}
                planName={overrideEditing.planName}
                activityType="TRAINING"
                activityId={activityId}
                allocationGroup="DRESSING_ROOM"
                label="Garderobe"
                standardplanAllocations={toStandardplanRows(item.dressingRoomAllocations)}
                initialOverrideAllocations={overrideEditing.overridesByKey[planOverrideKey("TRAINING", activityId, "DRESSING_ROOM")] ?? []}
                facilityGroups={overrideEditing.facilityGroupsByAllocationGroup.DRESSING_ROOM}
                startAt={item.startAt.toISOString()}
                endAt={item.endAt.toISOString()}
              />
            </WeekplannerActivityOverridePanel>
          )}
        </div>
      )}

      {item.type === "MATCH" && (
        <div className="mt-2.5">
          <p className="text-sm font-semibold text-[var(--foreground)]">
            {item.teamNames[0] ?? item.title} <span className="text-[var(--text-2)]">vs.</span> {item.opponentName ?? "TBD"}
          </p>
          <div className="mt-2 space-y-1">
            <ResourceChips icon={MapPin} refs={item.pitchAllocations} overridden={item.pitchOverridden} />
            <ResourceChips icon={DoorOpen} refs={item.dressingRoomAllocations} overridden={item.dressingRoomOverridden} />
            <ResourceChips icon={DoorOpen} refs={item.awayDressingRoomAllocations} />
          </div>
          {planName && <OverrideIndicator item={item} planName={planName} locale={locale} timezone={timezone} />}
          {overrideEditing && (
            <WeekplannerActivityOverridePanel activityKey={activityKey}>
              {timeEditor}
              <WeekplannerAllocationOverrideEditor
                planId={overrideEditing.planId}
                planName={overrideEditing.planName}
                activityType="MATCH"
                activityId={activityId}
                allocationGroup="PITCH_HALL"
                label="Spielfeld/Halle"
                standardplanAllocations={toStandardplanRows(item.pitchAllocations)}
                initialOverrideAllocations={overrideEditing.overridesByKey[planOverrideKey("MATCH", activityId, "PITCH_HALL")] ?? []}
                facilityGroups={overrideEditing.facilityGroupsByAllocationGroup.PITCH_HALL}
                startAt={item.startAt.toISOString()}
                endAt={item.endAt.toISOString()}
              />
              <WeekplannerAllocationOverrideEditor
                planId={overrideEditing.planId}
                planName={overrideEditing.planName}
                activityType="MATCH"
                activityId={activityId}
                allocationGroup="DRESSING_ROOM"
                label="Garderobe (Heim)"
                standardplanAllocations={toStandardplanRows(item.dressingRoomAllocations)}
                initialOverrideAllocations={overrideEditing.overridesByKey[planOverrideKey("MATCH", activityId, "DRESSING_ROOM")] ?? []}
                facilityGroups={overrideEditing.facilityGroupsByAllocationGroup.DRESSING_ROOM}
                startAt={item.startAt.toISOString()}
                endAt={item.endAt.toISOString()}
              />
            </WeekplannerActivityOverridePanel>
          )}
        </div>
      )}

      {item.type === "TOURNAMENT" && (
        <div className="mt-2.5">
          <p className="text-sm font-semibold text-[var(--foreground)]">{item.title}</p>
          {item.teamNames.length > 0 && (
            <p className="mt-0.5 text-xs text-[var(--text-2)]">{item.teamNames.join(", ")}</p>
          )}
          <div className="mt-2 space-y-1">
            <ResourceChips icon={MapPin} refs={item.pitchAllocations} overridden={item.pitchOverridden} />
            {item.participantAllocations.map((participant) =>
              participant.dressingRoomAllocations.length > 0 ? (
                <div key={participant.participantId} className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-[var(--muted)]">{participant.participantLabel}:</span>
                  <ResourceChips icon={DoorOpen} refs={participant.dressingRoomAllocations} overridden={participant.dressingRoomOverridden} />
                </div>
              ) : null,
            )}
          </div>
          {planName && <OverrideIndicator item={item} planName={planName} locale={locale} timezone={timezone} />}
          {overrideEditing && (
            <WeekplannerActivityOverridePanel activityKey={activityKey}>
              {timeEditor}
              <WeekplannerAllocationOverrideEditor
                planId={overrideEditing.planId}
                planName={overrideEditing.planName}
                activityType="TOURNAMENT"
                activityId={activityId}
                allocationGroup="PITCH_HALL"
                label="Spielfeld/Halle"
                standardplanAllocations={toStandardplanRows(item.pitchAllocations)}
                initialOverrideAllocations={overrideEditing.overridesByKey[planOverrideKey("TOURNAMENT", activityId, "PITCH_HALL")] ?? []}
                facilityGroups={overrideEditing.facilityGroupsByAllocationGroup.PITCH_HALL}
                startAt={item.startAt.toISOString()}
                endAt={item.endAt.toISOString()}
              />
              {item.participantAllocations.map((participant) => (
                <WeekplannerAllocationOverrideEditor
                  key={participant.participantId}
                  planId={overrideEditing.planId}
                  planName={overrideEditing.planName}
                  activityType="TOURNAMENT"
                  activityId={activityId}
                  allocationGroup="DRESSING_ROOM"
                  participantId={participant.participantId}
                  label={`Garderobe · ${participant.participantLabel}`}
                  standardplanAllocations={toStandardplanRows(participant.dressingRoomAllocations)}
                  initialOverrideAllocations={
                    overrideEditing.overridesByKey[
                      planOverrideKey("TOURNAMENT", activityId, "DRESSING_ROOM", participant.participantId)
                    ] ?? []
                  }
                  facilityGroups={overrideEditing.facilityGroupsByAllocationGroup.DRESSING_ROOM}
                  startAt={item.startAt.toISOString()}
                  endAt={item.endAt.toISOString()}
                />
              ))}
            </WeekplannerActivityOverridePanel>
          )}
        </div>
      )}

      <ConflictBadge item={item} />

      {/* PLANNING-UX-C3 — amber incomplete planning badge */}
      <IncompletePlanningBadge
        missing={missingAllocations}
        onEdit={showCanonicalEditButton ? () => onEdit?.(item) : undefined}
      />

      {/* PLANNING-UX-C3 — "Planung bearbeiten" button (shown when no incomplete badge or as supplementary) */}
      {showCanonicalEditButton && missingAllocations.length === 0 && (
        <div className="mt-2.5">
          <button
            type="button"
            onClick={() => onEdit?.(item)}
            className="text-xs font-medium text-[var(--sce-primary)] hover:underline"
            data-testid={`weekplanner-canonical-edit-${item.type.toLowerCase()}`}
          >
            Planung bearbeiten
          </button>
        </div>
      )}
    </div>
  );
}

function toStandardplanRows(
  refs: WeekplannerResourceRef[],
): { facilityResourceId: string; facilityResourceName: string; facilityResourceCode: string }[] {
  return refs.map((ref) => ({
    facilityResourceId: ref.facilityResourceId,
    facilityResourceName: ref.name,
    facilityResourceCode: ref.code,
  }));
}

function DayColumn({
  day,
  locale,
  timezone,
  planName,
  overrideEditing,
  canonicalEditing,
  onEdit,
}: {
  day: WeekplannerDay;
  locale: string;
  timezone: string;
  planName?: string | null;
  overrideEditing?: OverrideEditingContext;
  canonicalEditing?: CanonicalEditingContext;
  onEdit?: (item: WeekplannerItem) => void;
}) {
  const today = isToday(day.dayKey, timezone);

  return (
    <div
      className={cn(
        "flex min-w-[260px] flex-1 flex-col rounded-[20px] border bg-[var(--surface)]",
        today ? "border-[var(--sce-primary)]" : "border-[var(--border)]",
      )}
      data-testid="weekplanner-day-column"
      data-day={day.dayKey}
    >
      <div
        className={cn(
          "rounded-t-[20px] border-b px-3.5 py-2.5",
          today ? "border-[var(--sce-primary)] bg-[var(--sce-primary-light)]" : "border-[var(--border)] bg-[var(--surface-2)]",
        )}
      >
        <p
          className={cn(
            "text-xs font-semibold uppercase tracking-wide",
            today ? "text-[var(--sce-primary)]" : "text-[var(--text-2)]",
          )}
        >
          {formatDayHeading(day.dayKey, locale, timezone)}
        </p>
        <p className="mt-0.5 text-[11px] text-[var(--muted)]">
          {day.items.length} {day.items.length === 1 ? "Eintrag" : "Einträge"}
        </p>
      </div>

      <div className="flex-1 space-y-2.5 p-2.5">
        {day.items.length === 0 ? (
          <p className="px-1 py-3 text-center text-[11px] text-[var(--muted)]">Keine Einträge</p>
        ) : (
          day.items.map((item) => (
            <WeekplannerCard
              key={item.id}
              item={item}
              locale={locale}
              timezone={timezone}
              planName={planName}
              overrideEditing={overrideEditing}
              canonicalEditing={canonicalEditing}
              onEdit={onEdit}
            />
          ))
        )}
      </div>
    </div>
  );
}

export default function WeekPlannerPage({
  week,
  todayParam,
  locale = "de-CH",
  timezone = "Europe/Zurich",
  wochenplanPlans = [],
  plans = [],
  viewedWochenplanPlanId = null,
  selectedPlanParam = null,
  materializedWeekplannerPlanId = null,
  activePlanId = null,
  canManagePlans = false,
  overrideEditing,
  canonicalEditing,
}: WeekPlannerPageProps) {
  const totalItems = week.days.reduce((sum, day) => sum + day.items.length, 0);
  const conflictCount = week.days.reduce(
    (sum, day) => sum + day.items.filter((item) => item.conflicts.length > 0).length,
    0,
  );

  // PLANNING-UX-C3 — incomplete planning count (Standardplan only)
  const isStandardplan = activePlanId === null;
  const incompleteCount = isStandardplan
    ? week.days.reduce(
        (sum, day) =>
          sum + day.items.filter((item) => getMissingAllocations(item).length > 0).length,
        0,
      )
    : 0;

  const planName = activePlanId ? plans.find((p) => p.id === activePlanId)?.name ?? null : null;

  // PLANNING-UX-C3 — lifted Sheet state: one active editing item at most.
  const [editingItem, setEditingItem] = useState<WeekplannerItem | null>(null);

  const canEdit = !!canonicalEditing;

  function handleEdit(item: WeekplannerItem) {
    if (!canonicalEditing) return;
    const canEditThisItem =
      (item.type === "TRAINING" && canonicalEditing.canManageTrainings) ||
      ((item.type === "MATCH" || item.type === "TOURNAMENT") && canonicalEditing.canManageEvents);
    if (canEditThisItem) setEditingItem(item);
  }

  return (
    <div className="space-y-6">
      <AdminSectionHeader
        eyebrow="Planung"
        title="Wochenplanung"
        description="Trainings, Heimspiele und Heimturniere einer Kalenderwoche in einer koordinierten Ansicht — inklusive Platz- und Garderobenzuteilung."
      />

      <SectionCard>
        <WeekplannerPlanBar
          weekParam={week.param}
          wochenplanPlans={wochenplanPlans}
          weekplannerPlans={plans}
          selectedPlanParam={selectedPlanParam ?? viewedWochenplanPlanId}
          materializedWeekplannerPlanId={materializedWeekplannerPlanId}
          canManage={canManagePlans}
        />
      </SectionCard>

      {activePlanId === null && canManagePlans && (
        <div
          className="flex flex-wrap items-start gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-2.5 text-sm text-[var(--text-2)]"
          data-testid="weekplanner-standardplan-safety-note"
        >
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--muted)]" />
          <span>
            {canonicalEditing
              ? "Standardplan — Planungsdaten direkt bearbeitbar (\"Planung bearbeiten\" auf jedem Eintrag) oder über "
              : "Standardplan aktiv — Platz- und Garderobenzuteilungen sind hier nur lesbar. Um sie zu ändern, öffnen Sie "}
            <Link href={CANONICAL_MODULE_HREF.TRAINING.href} className="font-semibold text-[var(--sce-primary)] hover:underline">
              {CANONICAL_MODULE_HREF.TRAINING.label}
            </Link>
            ,{" "}
            <Link href={CANONICAL_MODULE_HREF.MATCH.href} className="font-semibold text-[var(--sce-primary)] hover:underline">
              {CANONICAL_MODULE_HREF.MATCH.label}
            </Link>{" "}
            oder{" "}
            <Link href={CANONICAL_MODULE_HREF.TOURNAMENT.href} className="font-semibold text-[var(--sce-primary)] hover:underline">
              {CANONICAL_MODULE_HREF.TOURNAMENT.label}
            </Link>{" "}
            — oder wählen Sie oben einen Alternativ-Wochenplan, um nur für diese Woche abzuweichen.
          </span>
        </div>
      )}

      <SectionCard noPadding>
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]" data-testid="weekplanner-week-number">
              {week.weekNumberLabel}
            </p>
            <p className="mt-1 text-lg font-semibold text-[var(--foreground)]" data-testid="weekplanner-range-label">
              {week.rangeLabel}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={weekHref(week.previousParam)}
              aria-label="Vorherige Woche"
              data-testid="weekplanner-previous-week"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text-2)] transition hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
            >
              <ChevronLeft className="h-4 w-4" />
            </Link>

            <Link
              href={weekHref(todayParam)}
              data-testid="weekplanner-today"
              className="inline-flex h-9 items-center rounded-lg border border-[var(--border)] px-3.5 text-sm font-semibold text-[var(--text-2)] transition hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
            >
              Heute
            </Link>

            <Link
              href={weekHref(week.nextParam)}
              aria-label="Nächste Woche"
              data-testid="weekplanner-next-week"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text-2)] transition hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
            >
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </SectionCard>

      {/* PLANNING-UX-C3 — RED: Doppelbelegung. Semantically distinct from AMBER below. */}
      {conflictCount > 0 && (
        <div
          className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700"
          data-testid="weekplanner-conflict-summary"
        >
          <AlertTriangle className="h-4 w-4" />
          {conflictCount} {conflictCount === 1 ? "Eintrag" : "Einträge"} mit Doppelbelegung diese Woche
        </div>
      )}

      {/* PLANNING-UX-C3 — AMBER: incomplete planning (Standardplan only). Never classified as Doppelbelegung. */}
      {incompleteCount > 0 && (
        <div
          className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-700"
          data-testid="weekplanner-incomplete-summary"
        >
          <AlertTriangle className="h-4 w-4" />
          {incompleteCount} {incompleteCount === 1 ? "Eintrag benötigt" : "Einträge benötigen"} Planung diese Woche
        </div>
      )}

      {totalItems === 0 ? (
        <SectionCard noPadding>
          <EmptyState
            icon={<Dumbbell className="h-8 w-8" />}
            heading="Keine Planungseinträge"
            description="Für diese Kalenderwoche gibt es keine Trainings, Heimspiele oder Heimturniere."
          />
        </SectionCard>
      ) : (
        <div className="-mx-1 overflow-x-auto pb-2">
          <WeekplannerOverridePanelProvider>
            <div className="flex min-w-full gap-3 px-1">
              {week.days.map((day) => (
                <DayColumn
                  key={day.dayKey}
                  day={day}
                  locale={locale}
                  timezone={timezone}
                  planName={planName}
                  overrideEditing={overrideEditing}
                  canonicalEditing={activePlanId === null ? canonicalEditing : undefined}
                  onEdit={canEdit && activePlanId === null ? handleEdit : undefined}
                />
              ))}
            </div>
          </WeekplannerOverridePanelProvider>
        </div>
      )}

      {/* PLANNING-UX-C3 — Sheet overlay for canonical editing workspace */}
      {canonicalEditing && (
        <WeekplannerPlanningSheet
          item={editingItem}
          facilityGroupsByAllocationGroup={canonicalEditing.facilityGroupsByAllocationGroup}
          timezone={timezone}
          onClose={() => setEditingItem(null)}
          onSaved={() => setEditingItem(null)}
        />
      )}
    </div>
  );
}
