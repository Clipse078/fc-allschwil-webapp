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
import type { WeekplannerDay, WeekplannerItem, WeekplannerResourceRef } from "@/lib/weekplanner/types";
import type { WeekplannerPlanDto } from "@/lib/weekplanner/plan-types";
import { planOverrideKey } from "@/lib/weekplanner/plan-override-key";
import { DayPlannerPlanSelect } from "./DayPlannerPlanSelect";
import {
  WeekplannerAllocationOverrideEditor,
  type WeekplannerOverrideRow,
} from "./WeekplannerAllocationOverrideEditor";
import { WeekplannerActivityTimeOverrideEditor } from "./WeekplannerActivityTimeOverrideEditor";
import { WeekplannerActivityOverridePanel } from "./WeekplannerActivityOverridePanel";
import { WeekplannerOverridePanelProvider } from "./WeekplannerOverridePanelContext";
import type { FacilityGroup } from "@/components/admin/training/FacilityResourceSelector";

/**
 * DAYPLANNER-01A — Canonical Day Planning foundation.
 *
 * Day Planning is a ONE-DAY operational projection of the exact same
 * effective planning state Weekplanner already resolves — see
 * lib/weekplanner/queries.ts#getWeekplannerDay's doc comment. This
 * component therefore reuses the identical WeekplannerItem/WeekplannerDay
 * read model, the identical WeekplannerPlan architecture (plan selection,
 * "override by presence" semantics), and — where an alternative plan is
 * selected and the caller can manage plans — the EXACT SAME override
 * editors already used by Wochenplanner (WeekplannerActivityTimeOverride-
 * Editor / WeekplannerAllocationOverrideEditor). No second override editor,
 * no second conflict engine, no DayPlanner-specific persistence.
 *
 * Deliberately NOT "Weekplanner squeezed into one column": a single
 * chronological time-anchored timeline, restrained type labels, no
 * oversized cards, no KPI blocks.
 */

type OverrideEditingContext = {
  planId: string;
  planName: string;
  overridesByKey: Record<string, WeekplannerOverrideRow[]>;
  facilityGroupsByAllocationGroup: { PITCH_HALL: FacilityGroup[]; DRESSING_ROOM: FacilityGroup[] };
};

type DayPlannerPageProps = {
  day: WeekplannerDay;
  /** "YYYY-MM-DD" — the currently viewed day. */
  dayParam: string;
  previousParam: string;
  nextParam: string;
  /** "YYYY-MM-DD" that resolves to today (Europe/Zurich) — powers "Heute". */
  todayParam: string;
  /** Monday "YYYY-MM-DD" of the week containing `dayParam` — plans are week-scoped; also used for the "manage plans" deep-link. */
  weekParam: string;
  locale?: string;
  timezone?: string;
  plans?: WeekplannerPlanDto[];
  activePlanId?: string | null;
  canManagePlans?: boolean;
  overrideEditing?: OverrideEditingContext;
};

const TYPE_META: Record<WeekplannerItem["type"], { label: string; badgeClass: string; icon: typeof Dumbbell }> = {
  TRAINING: { label: "Training", badgeClass: "border-emerald-200 bg-emerald-50 text-emerald-700", icon: Dumbbell },
  MATCH: { label: "Match", badgeClass: "border-blue-200 bg-blue-50 text-blue-700", icon: Shield },
  TOURNAMENT: { label: "Turnier", badgeClass: "border-amber-200 bg-amber-50 text-amber-700", icon: Trophy },
};

function dayHref(dayParam: string, planId?: string | null): string {
  const params = new URLSearchParams({ day: dayParam });
  if (planId) params.set("plan", planId);
  return `/dashboard/planner/day?${params.toString()}`;
}

function formatTime(value: Date, locale: string, timeZone: string): string {
  return new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", timeZone }).format(value);
}

function formatTimeRange(startAt: Date, endAt: Date, locale: string, timeZone: string): string {
  const start = formatTime(startAt, locale, timeZone);
  const end = formatTime(endAt, locale, timeZone);
  return start === end ? start : `${start} – ${end}`;
}

function formatDayHeading(dayKey: string, locale: string, timeZone: string): string {
  return new Intl.DateTimeFormat(locale, {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone,
  }).format(new Date(`${dayKey}T12:00:00.000Z`));
}

function isToday(dayKey: string, todayParam: string): boolean {
  return dayKey === todayParam;
}

function activityIdOf(item: WeekplannerItem): string {
  return item.type === "TRAINING" ? item.trainingSessionId : item.eventId;
}

function isItemOverridden(item: WeekplannerItem): boolean {
  const resourceOverridden =
    item.pitchOverridden ||
    item.dressingRoomOverridden ||
    (item.type === "TOURNAMENT" && item.participantAllocations.some((p) => p.dressingRoomOverridden));
  return item.timeOverridden || resourceOverridden;
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
            overridden ? "border-blue-200 bg-blue-50 text-blue-700" : "border-[var(--border)] bg-[var(--surface-2)] text-[var(--text-2)]",
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

function ConflictBadge({ item }: { item: WeekplannerItem }) {
  if (item.conflicts.length === 0) return null;
  const resourceNames = item.conflicts.map((c) => c.facilityResourceName).join(", ");

  return (
    <div
      className="mt-2 inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-2.5 py-1 text-[11px] font-semibold text-amber-800"
      title={`Geteilte Belegung: ${resourceNames}`}
      data-testid="dayplanner-conflict-badge"
    >
      <AlertTriangle className="h-3.5 w-3.5 text-amber-600" />
      Geteilte Belegung · {resourceNames}
    </div>
  );
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
    <div className="mt-1.5 space-y-0.5" data-testid="dayplanner-override-indicator">
      <p className="text-[10px] font-semibold uppercase tracking-wide text-blue-600">{planName} angepasst</p>
      <p className="text-[10px] text-[var(--muted)]">Standard: {formatStandardSummary(item, locale, timezone)}</p>
    </div>
  );
}

function TimelineRow({
  item,
  locale,
  timezone,
  planName,
  overrideEditing,
}: {
  item: WeekplannerItem;
  locale: string;
  timezone: string;
  planName?: string | null;
  overrideEditing?: OverrideEditingContext;
}) {
  const meta = TYPE_META[item.type];
  const Icon = meta.icon;
  const hasConflict = item.conflicts.length > 0;
  const activityId = activityIdOf(item);
  const activityKey = `${item.type}:${activityId}`;

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
      className="flex gap-4 px-5 py-4"
      data-testid={`dayplanner-item-${item.type.toLowerCase()}`}
      data-activity-key={activityKey}
    >
      <div className="w-16 shrink-0 pt-0.5 text-right">
        <p className="text-sm font-semibold tabular-nums text-[var(--foreground)]">{formatTime(item.startAt, locale, timezone)}</p>
        <p className="text-[11px] tabular-nums text-[var(--muted)]">{formatTime(item.endAt, locale, timezone)}</p>
      </div>

      <div className={cn("relative flex-1 min-w-0 border-l-2 pl-4", hasConflict ? "border-rose-300" : "border-[var(--border)]")}>
        <span
          className={cn(
            "absolute -left-[7px] top-1 h-3 w-3 rounded-full border-2 border-[var(--surface)]",
            hasConflict ? "bg-rose-500" : "bg-[var(--sce-primary)]",
          )}
        />

        <div className="flex flex-wrap items-center gap-2">
          <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] font-semibold", meta.badgeClass)}>
            <Icon className="h-3.5 w-3.5" />
            {meta.label}
          </span>
        </div>

        {item.type === "TRAINING" && (
          <div className="mt-2">
            <p className="text-sm font-semibold text-[var(--foreground)]">{item.teamNames[0] ?? item.title}</p>
            <p className="mt-0.5 text-xs text-[var(--text-2)]">{item.title}</p>
          </div>
        )}
        {item.type === "MATCH" && (
          <p className="mt-2 text-sm font-semibold text-[var(--foreground)]">
            {item.teamNames[0] ?? item.title} <span className="text-[var(--text-2)]">vs.</span> {item.opponentName ?? "TBD"}
          </p>
        )}
        {item.type === "TOURNAMENT" && (
          <div className="mt-2">
            <p className="text-sm font-semibold text-[var(--foreground)]">{item.title}</p>
            {item.teamNames.length > 0 && <p className="mt-0.5 text-xs text-[var(--text-2)]">{item.teamNames.join(", ")}</p>}
          </div>
        )}

        <div className="mt-2 space-y-1">
          <ResourceChips icon={MapPin} refs={item.pitchAllocations} emptyLabel="Kein Platz zugewiesen" overridden={item.pitchOverridden} />
          {item.type !== "TOURNAMENT" && (
            <ResourceChips
              icon={DoorOpen}
              refs={item.dressingRoomAllocations}
              emptyLabel={item.type === "MATCH" ? "Heimkabine offen" : undefined}
              overridden={item.dressingRoomOverridden}
            />
          )}
          {item.type === "MATCH" && item.awayDressingRoomAllocations.length > 0 && (
            <ResourceChips icon={DoorOpen} refs={item.awayDressingRoomAllocations} emptyLabel="Gastkabine offen" />
          )}
          {item.type === "TOURNAMENT" &&
            item.participantAllocations.map((participant) =>
              participant.dressingRoomAllocations.length > 0 ? (
                <div key={participant.participantId} className="flex flex-wrap items-center gap-1.5">
                  <span className="text-[11px] text-[var(--muted)]">{participant.participantLabel}:</span>
                  <ResourceChips icon={DoorOpen} refs={participant.dressingRoomAllocations} overridden={participant.dressingRoomOverridden} />
                </div>
              ) : null,
            )}
        </div>

        {planName && <OverrideIndicator item={item} planName={planName} locale={locale} timezone={timezone} />}
        <ConflictBadge item={item} />

        {overrideEditing && (
          <WeekplannerActivityOverridePanel activityKey={activityKey}>
            {timeEditor}
            <WeekplannerAllocationOverrideEditor
              planId={overrideEditing.planId}
              planName={overrideEditing.planName}
              activityType={item.type}
              activityId={activityId}
              allocationGroup="PITCH_HALL"
              label="Spielfeld/Halle"
              standardplanAllocations={toStandardplanRows(item.pitchAllocations)}
              initialOverrideAllocations={overrideEditing.overridesByKey[planOverrideKey(item.type, activityId, "PITCH_HALL")] ?? []}
              facilityGroups={overrideEditing.facilityGroupsByAllocationGroup.PITCH_HALL}
              startAt={item.startAt.toISOString()}
              endAt={item.endAt.toISOString()}
            />
            {item.type !== "TOURNAMENT" && (
              <WeekplannerAllocationOverrideEditor
                planId={overrideEditing.planId}
                planName={overrideEditing.planName}
                activityType={item.type}
                activityId={activityId}
                allocationGroup="DRESSING_ROOM"
                label={item.type === "MATCH" ? "Garderobe (Heim)" : "Garderobe"}
                standardplanAllocations={toStandardplanRows(item.dressingRoomAllocations)}
                initialOverrideAllocations={overrideEditing.overridesByKey[planOverrideKey(item.type, activityId, "DRESSING_ROOM")] ?? []}
                facilityGroups={overrideEditing.facilityGroupsByAllocationGroup.DRESSING_ROOM}
                startAt={item.startAt.toISOString()}
                endAt={item.endAt.toISOString()}
              />
            )}
            {item.type === "TOURNAMENT" &&
              item.participantAllocations.map((participant) => (
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
                    overrideEditing.overridesByKey[planOverrideKey("TOURNAMENT", activityId, "DRESSING_ROOM", participant.participantId)] ?? []
                  }
                  facilityGroups={overrideEditing.facilityGroupsByAllocationGroup.DRESSING_ROOM}
                  startAt={item.startAt.toISOString()}
                  endAt={item.endAt.toISOString()}
                />
              ))}
          </WeekplannerActivityOverridePanel>
        )}
      </div>
    </div>
  );
}

export default function DayPlannerPage({
  day,
  dayParam,
  previousParam,
  nextParam,
  todayParam,
  weekParam,
  locale = "de-CH",
  timezone = "Europe/Zurich",
  plans = [],
  activePlanId = null,
  canManagePlans = false,
  overrideEditing,
}: DayPlannerPageProps) {
  const conflictCount = day.items.filter((item) => item.conflicts.length > 0).length;
  const planName = activePlanId ? plans.find((p) => p.id === activePlanId)?.name ?? null : null;
  const today = isToday(day.dayKey, todayParam);

  return (
    <div className="space-y-6">
      <AdminSectionHeader
        eyebrow="Planung"
        title="Tagesplanung"
        description="Was passiert heute an der Sportanlage, wann und wo — Trainings, Heimspiele und Heimturniere in einer chronologischen Tagesansicht."
      />

      <SectionCard noPadding>
        <div className="flex flex-wrap items-center justify-between gap-3 px-5 py-4">
          <div>
            <p
              className={cn(
                "text-xs font-semibold uppercase tracking-[0.14em]",
                today ? "text-[var(--sce-primary)]" : "text-[var(--muted)]",
              )}
              data-testid="dayplanner-day-heading"
            >
              {formatDayHeading(day.dayKey, locale, timezone)}
            </p>
            <div className="mt-2">
              <DayPlannerPlanSelect dayParam={dayParam} weekParam={weekParam} plans={plans} activePlanId={activePlanId} />
            </div>
          </div>

          <div className="flex items-center gap-2">
            <Link
              href={dayHref(previousParam)}
              aria-label="Vorheriger Tag"
              data-testid="dayplanner-previous-day"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text-2)] transition hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
            >
              <ChevronLeft className="h-4 w-4" />
            </Link>

            <Link
              href={dayHref(todayParam)}
              data-testid="dayplanner-today"
              className="inline-flex h-9 items-center rounded-lg border border-[var(--border)] px-3.5 text-sm font-semibold text-[var(--text-2)] transition hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
            >
              Heute
            </Link>

            <Link
              href={dayHref(nextParam)}
              aria-label="Nächster Tag"
              data-testid="dayplanner-next-day"
              className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[var(--border)] text-[var(--text-2)] transition hover:bg-[var(--surface-2)] hover:text-[var(--foreground)]"
            >
              <ChevronRight className="h-4 w-4" />
            </Link>
          </div>
        </div>
      </SectionCard>

      {activePlanId === null && canManagePlans && (
        <div
          className="flex flex-wrap items-start gap-2 rounded-xl border border-[var(--border)] bg-[var(--surface-2)] px-4 py-2.5 text-sm text-[var(--text-2)]"
          data-testid="dayplanner-standardplan-safety-note"
        >
          <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--muted)]" />
          <span>
            Standardplan aktiv — Platz- und Garderobenzuteilungen sind hier nur lesbar. Um sie zu ändern, öffnen Sie TrainingCenter,
            Matchcenter oder TournamentCenter — oder wählen Sie oben einen Alternativplan.
          </span>
        </div>
      )}

      {conflictCount > 0 && (
        <div
          className="flex items-center gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-800"
          data-testid="dayplanner-conflict-summary"
        >
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          {conflictCount} {conflictCount === 1 ? "Eintrag" : "Einträge"} mit geteilter Ressourcenbelegung an diesem Tag
        </div>
      )}

      {day.items.length === 0 ? (
        <SectionCard noPadding>
          <EmptyState icon={<Dumbbell className="h-8 w-8" />} heading="Keine Einträge" description="Für diesen Tag gibt es keine Trainings, Heimspiele oder Heimturniere." />
        </SectionCard>
      ) : (
        <SectionCard noPadding>
          <WeekplannerOverridePanelProvider>
            <div className="divide-y divide-[var(--border)]" data-testid="dayplanner-timeline">
              {day.items.map((item) => (
                <TimelineRow key={item.id} item={item} locale={locale} timezone={timezone} planName={planName} overrideEditing={overrideEditing} />
              ))}
            </div>
          </WeekplannerOverridePanelProvider>
        </SectionCard>
      )}
    </div>
  );
}
