import Link from "next/link";
import {
  AlertTriangle,
  ChevronLeft,
  ChevronRight,
  DoorOpen,
  Dumbbell,
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
import { planOverrideKey } from "@/lib/weekplanner/plan-override-key";
import { WeekplannerPlanBar } from "./WeekplannerPlanBar";
import {
  WeekplannerAllocationOverrideEditor,
  type WeekplannerOverrideRow,
} from "./WeekplannerAllocationOverrideEditor";
import type { FacilityGroup } from "@/components/admin/training/FacilityResourceSelector";

/**
 * WEEKPLANNER-01B — populated only when an alternative plan is selected AND
 * the caller can manage plans. Threads the per-item override editing
 * context down to each WeekplannerCard. Omitted entirely for the
 * Standardplan (no plan selected) or a read-only viewer — the card renders
 * exactly as it did in 01A in both cases.
 */
type OverrideEditingContext = {
  planId: string;
  /** Keyed via lib/weekplanner/plan-override-key.ts#planOverrideKey — one entry per overridden group. */
  overridesByKey: Record<string, WeekplannerOverrideRow[]>;
  facilityGroupsByAllocationGroup: { PITCH_HALL: FacilityGroup[]; DRESSING_ROOM: FacilityGroup[] };
};

type WeekPlannerPageProps = {
  week: WeekplannerWeek;
  /** URL "week" param that resolves to the current Europe/Zurich week — powers the "Heute" button. */
  todayParam: string;
  locale?: string;
  timezone?: string;
  /** WEEKPLANNER-01B — active (non-archived) plans for this tenant+week. Never includes a "Standardplan" row. */
  plans?: WeekplannerPlanDto[];
  /** WEEKPLANNER-01B — the currently selected alternative plan, or null for the Standardplan. */
  activePlanId?: string | null;
  /** WEEKPLANNER-01B — whether the current user can create/rename/archive/delete plans and edit overrides. */
  canManagePlans?: boolean;
  overrideEditing?: OverrideEditingContext;
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
  /** WEEKPLANNER-01B — true when the currently selected plan overrides this group. Adds a subtle "angepasst" marker. */
  overridden?: boolean;
}) {
  if (refs.length === 0) {
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
      {overridden && (
        <span
          className="text-[10px] font-semibold uppercase tracking-wide text-blue-600"
          data-testid="weekplanner-override-marker"
        >
          angepasst
        </span>
      )}
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

/** Resolves the canonical activityId for an item — TrainingSession.id (TRAINING) or Event.id (MATCH/TOURNAMENT). */
function activityIdOf(item: WeekplannerItem): string {
  return item.type === "TRAINING" ? item.trainingSessionId : item.eventId;
}

function WeekplannerCard({
  item,
  locale,
  timezone,
  overrideEditing,
}: {
  item: WeekplannerItem;
  locale: string;
  timezone: string;
  overrideEditing?: OverrideEditingContext;
}) {
  const meta = TYPE_META[item.type];
  const Icon = meta.icon;
  const hasConflict = item.conflicts.length > 0;
  const activityId = activityIdOf(item);

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
            <ResourceChips icon={MapPin} refs={item.pitchAllocations} emptyLabel="Kein Platz zugewiesen" overridden={item.pitchOverridden} />
            <ResourceChips icon={DoorOpen} refs={item.dressingRoomAllocations} overridden={item.dressingRoomOverridden} />
          </div>
          {overrideEditing && (
            <>
              <WeekplannerAllocationOverrideEditor
                planId={overrideEditing.planId}
                activityType="TRAINING"
                activityId={activityId}
                allocationGroup="PITCH_HALL"
                label="Spielfeld/Halle"
                standardplanAllocations={toStandardplanRows(item.pitchAllocations)}
                initialOverrideAllocations={overrideEditing.overridesByKey[planOverrideKey("TRAINING", activityId, "PITCH_HALL")] ?? []}
                facilityGroups={overrideEditing.facilityGroupsByAllocationGroup.PITCH_HALL}
              />
              <WeekplannerAllocationOverrideEditor
                planId={overrideEditing.planId}
                activityType="TRAINING"
                activityId={activityId}
                allocationGroup="DRESSING_ROOM"
                label="Garderobe"
                standardplanAllocations={toStandardplanRows(item.dressingRoomAllocations)}
                initialOverrideAllocations={overrideEditing.overridesByKey[planOverrideKey("TRAINING", activityId, "DRESSING_ROOM")] ?? []}
                facilityGroups={overrideEditing.facilityGroupsByAllocationGroup.DRESSING_ROOM}
              />
            </>
          )}
        </div>
      )}

      {item.type === "MATCH" && (
        <div className="mt-2.5">
          <p className="text-sm font-semibold text-[var(--foreground)]">
            {item.teamNames[0] ?? item.title} <span className="text-[var(--text-2)]">vs.</span> {item.opponentName ?? "TBD"}
          </p>
          <div className="mt-2 space-y-1">
            <ResourceChips icon={MapPin} refs={item.pitchAllocations} emptyLabel="Kein Platz zugewiesen" overridden={item.pitchOverridden} />
            <ResourceChips icon={DoorOpen} refs={item.dressingRoomAllocations} emptyLabel="Heimkabine offen" overridden={item.dressingRoomOverridden} />
            <ResourceChips icon={DoorOpen} refs={item.awayDressingRoomAllocations} emptyLabel="Gastkabine offen" />
          </div>
          {overrideEditing && (
            <>
              <WeekplannerAllocationOverrideEditor
                planId={overrideEditing.planId}
                activityType="MATCH"
                activityId={activityId}
                allocationGroup="PITCH_HALL"
                label="Spielfeld/Halle"
                standardplanAllocations={toStandardplanRows(item.pitchAllocations)}
                initialOverrideAllocations={overrideEditing.overridesByKey[planOverrideKey("MATCH", activityId, "PITCH_HALL")] ?? []}
                facilityGroups={overrideEditing.facilityGroupsByAllocationGroup.PITCH_HALL}
              />
              <WeekplannerAllocationOverrideEditor
                planId={overrideEditing.planId}
                activityType="MATCH"
                activityId={activityId}
                allocationGroup="DRESSING_ROOM"
                label="Garderobe (Heim)"
                standardplanAllocations={toStandardplanRows(item.dressingRoomAllocations)}
                initialOverrideAllocations={overrideEditing.overridesByKey[planOverrideKey("MATCH", activityId, "DRESSING_ROOM")] ?? []}
                facilityGroups={overrideEditing.facilityGroupsByAllocationGroup.DRESSING_ROOM}
              />
            </>
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
            <ResourceChips icon={MapPin} refs={item.pitchAllocations} emptyLabel="Kein Platz zugewiesen" overridden={item.pitchOverridden} />
            {item.participantAllocations.map((participant) =>
              participant.dressingRoomAllocations.length > 0 ? (
                <div key={participant.participantId} className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-[var(--muted)]">{participant.participantLabel}:</span>
                  <ResourceChips icon={DoorOpen} refs={participant.dressingRoomAllocations} overridden={participant.dressingRoomOverridden} />
                </div>
              ) : null,
            )}
          </div>
          {overrideEditing && (
            <>
              <WeekplannerAllocationOverrideEditor
                planId={overrideEditing.planId}
                activityType="TOURNAMENT"
                activityId={activityId}
                allocationGroup="PITCH_HALL"
                label="Spielfeld/Halle"
                standardplanAllocations={toStandardplanRows(item.pitchAllocations)}
                initialOverrideAllocations={overrideEditing.overridesByKey[planOverrideKey("TOURNAMENT", activityId, "PITCH_HALL")] ?? []}
                facilityGroups={overrideEditing.facilityGroupsByAllocationGroup.PITCH_HALL}
              />
              {item.participantAllocations.map((participant) => (
                <WeekplannerAllocationOverrideEditor
                  key={participant.participantId}
                  planId={overrideEditing.planId}
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
                />
              ))}
            </>
          )}
        </div>
      )}

      <ConflictBadge item={item} />
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
  overrideEditing,
}: {
  day: WeekplannerDay;
  locale: string;
  timezone: string;
  overrideEditing?: OverrideEditingContext;
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
              overrideEditing={overrideEditing}
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
  plans = [],
  activePlanId = null,
  canManagePlans = false,
  overrideEditing,
}: WeekPlannerPageProps) {
  const totalItems = week.days.reduce((sum, day) => sum + day.items.length, 0);
  const conflictCount = week.days.reduce(
    (sum, day) => sum + day.items.filter((item) => item.conflicts.length > 0).length,
    0,
  );

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
          plans={plans}
          activePlanId={activePlanId}
          canManage={canManagePlans}
        />
      </SectionCard>

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

      {conflictCount > 0 && (
        <div
          className="flex items-center gap-2 rounded-xl border border-rose-200 bg-rose-50 px-4 py-2.5 text-sm font-medium text-rose-700"
          data-testid="weekplanner-conflict-summary"
        >
          <AlertTriangle className="h-4 w-4" />
          {conflictCount} {conflictCount === 1 ? "Eintrag" : "Einträge"} mit Doppelbelegung diese Woche
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
          <div className="flex min-w-full gap-3 px-1">
            {week.days.map((day) => (
              <DayColumn
                key={day.dayKey}
                day={day}
                locale={locale}
                timezone={timezone}
                overrideEditing={overrideEditing}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
