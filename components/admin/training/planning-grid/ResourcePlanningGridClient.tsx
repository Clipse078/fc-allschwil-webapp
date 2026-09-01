"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState, useTransition } from "react";
import { AlertTriangle, CalendarDays, ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/cn";
import { EmptyState } from "@/components/ui/page/EmptyState";
import { Dialog } from "@/components/ui/Dialog";
import { Sheet } from "@/components/ui/Sheet";
import { useToast } from "@/hooks/use-toast";
import { timeRangesOverlap } from "@/lib/facilities/allocation-rules";
import {
  activityOverlapsSegment,
  blockSegmentFragment,
  buildDaySegmentTimeline,
  buildMajorTimelineTicks,
  buildMinorTimelineMarkers,
  formatTimelineLabel,
  listAvailableDaySegments,
  minutesToPercent,
  resolveDefaultDaySegment,
  type DaySegmentKey,
} from "@/lib/training/planning-grid/day-segments";
import type {
  PlanningGridViewModel,
  PlanningResourceCategoryKey,
  ResourceDropTargetState,
  ResourceLane,
  ResourceReassignmentScope,
  ScheduledActivityBlock,
} from "@/lib/training/planning-grid/types";
import { resourceMatchesCategory } from "@/lib/training/planning-grid/resource-categories";

type Props = {
  viewModel: PlanningGridViewModel;
  dayLabel: string;
  dayParam: string;
  previousDayParam: string;
  nextDayParam: string;
  canManage: boolean;
  locale?: string;
  timezone?: string;
  basePath?: string;
  daypartParam?: string | null;
};

type PendingReassignment = {
  block: ScheduledActivityBlock;
  targetLane: ResourceLane;
  scope: ResourceReassignmentScope;
};

function buildPlanningHref(
  basePath: string,
  params: Record<string, string | undefined>,
): string {
  const search = new URLSearchParams();
  search.set("tab", "planungsraster");
  for (const [key, value] of Object.entries(params)) {
    if (value) search.set(key, value);
  }
  return `${basePath}?${search.toString()}`;
}

function formatTimeRange(startAt: string, endAt: string, locale: string, timezone: string): string {
  const fmt = new Intl.DateTimeFormat(locale, { hour: "2-digit", minute: "2-digit", timeZone: timezone });
  return `${fmt.format(new Date(startAt))}–${fmt.format(new Date(endAt))}`;
}

function evaluateDropTarget(
  dragged: ScheduledActivityBlock,
  targetLane: ResourceLane,
  blocks: readonly ScheduledActivityBlock[],
  category: PlanningResourceCategoryKey,
): ResourceDropTargetState {
  if (!resourceMatchesCategory(targetLane.resourceType, category)) return "INVALID_TYPE";

  const conflict = blocks.some(
    (block) =>
      block.sessionId !== dragged.sessionId &&
      block.resourceId === targetLane.resourceId &&
      timeRangesOverlap({
        startA: dragged.startAt,
        endA: dragged.endAt,
        startB: block.startAt,
        endB: block.endAt,
      }),
  );
  return conflict ? "CONFLICT" : "AVAILABLE";
}

export default function ResourcePlanningGridClient({
  viewModel,
  dayLabel,
  dayParam,
  previousDayParam,
  nextDayParam,
  canManage,
  locale = "de-CH",
  timezone = "Europe/Zurich",
  basePath = "/dashboard/training",
  daypartParam = null,
}: Props) {
  const router = useRouter();
  const { toast } = useToast();
  const [isPending, startTransition] = useTransition();
  const [draggedBlock, setDraggedBlock] = useState<ScheduledActivityBlock | null>(null);
  const [hoverLaneId, setHoverLaneId] = useState<string | null>(null);
  const [highlightConflictId, setHighlightConflictId] = useState<string | null>(null);
  const [selectedBlock, setSelectedBlock] = useState<ScheduledActivityBlock | null>(null);
  const [pendingReassignment, setPendingReassignment] = useState<PendingReassignment | null>(null);
  const [showConflictPanel, setShowConflictPanel] = useState(false);
  const [resourceChangeBlock, setResourceChangeBlock] = useState<ScheduledActivityBlock | null>(null);

  const {
    resourceGroups,
    lanes,
    blocks,
    unplannedBlocks,
    conflicts,
    conflictCount,
    categories,
    facilities,
    teams,
    filters,
    category,
    showFacilityFilter,
    density,
    date,
    suggestedDaySegment,
  } = viewModel;

  const allDayBlocks = useMemo(() => [...blocks, ...unplannedBlocks], [blocks, unplannedBlocks]);
  const availableSegments = useMemo(
    () => listAvailableDaySegments(allDayBlocks, timezone),
    [allDayBlocks, timezone],
  );
  const activeDaySegment = useMemo(
    () =>
      resolveDefaultDaySegment({
        date,
        blocks: allDayBlocks,
        timeZone: timezone,
        daypartParam,
      }),
    [allDayBlocks, date, daypartParam, timezone],
  );
  const segmentTimeline = useMemo(
    () => buildDaySegmentTimeline(activeDaySegment),
    [activeDaySegment],
  );
  const majorTicks = useMemo(() => buildMajorTimelineTicks(segmentTimeline), [segmentTimeline]);
  const minorMarkers = useMemo(() => buildMinorTimelineMarkers(segmentTimeline), [segmentTimeline]);
  const allPlannedBlocks = useMemo(
    () => blocks.filter((block) => block.resourceId),
    [blocks],
  );

  const laneHeightClass =
    density === "comfortable" ? "min-h-[3.25rem]" : density === "normal" ? "min-h-[2.75rem]" : "min-h-[2.25rem]";

  const refresh = useCallback(() => {
    startTransition(() => router.refresh());
  }, [router]);

  const submitReassignment = useCallback(
    async (pending: PendingReassignment) => {
      const res = await fetch("/api/training/planning-grid/reassign", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          sessionId: pending.block.sessionId,
          targetResourceId: pending.targetLane.resourceId,
          category,
          scope: pending.scope,
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.error ?? "Änderung fehlgeschlagen");
      toast.success("Ressourcenänderung übernommen");
      setPendingReassignment(null);
      setDraggedBlock(null);
      refresh();
    },
    [category, refresh, toast],
  );

  const handleDropOnLane = (lane: ResourceLane) => {
    if (!draggedBlock || !canManage) return;
    const state = evaluateDropTarget(draggedBlock, lane, allPlannedBlocks, category);
    if (state !== "AVAILABLE") {
      toast.danger(state === "CONFLICT" ? "Konflikt — Zielressource ist belegt" : "Ungültiges Ziel");
      setDraggedBlock(null);
      setHoverLaneId(null);
      return;
    }
    setPendingReassignment({ block: draggedBlock, targetLane: lane, scope: "occurrence" });
    setDraggedBlock(null);
    setHoverLaneId(null);
  };

  const hrefParams = {
    day: dayParam,
    category,
    daypart: activeDaySegment,
    facility: filters.facilityId ?? undefined,
    team: filters.teamSeasonId ?? undefined,
    conflicts: filters.conflictsOnly ? "1" : undefined,
    unallocated: filters.unallocatedOnly ? "1" : undefined,
  };

  const segmentBlocks = useMemo(
    () =>
      blocks.filter(
        (block) =>
          Boolean(block.resourceId) &&
          activityOverlapsSegment(block.startAt, block.endAt, activeDaySegment, timezone),
      ),
    [activeDaySegment, blocks, timezone],
  );

  const segmentUnplanned = useMemo(
    () =>
      unplannedBlocks.filter((block) =>
        activityOverlapsSegment(block.startAt, block.endAt, activeDaySegment, timezone),
      ),
    [activeDaySegment, timezone, unplannedBlocks],
  );

  const mobileBlocks = useMemo(
    () => [...segmentBlocks, ...segmentUnplanned],
    [segmentBlocks, segmentUnplanned],
  );

  if (lanes.length === 0 && unplannedBlocks.length === 0) {
    return (
      <div className="space-y-4">
        <PlanningToolbar
          dayLabel={dayLabel}
          dayParam={dayParam}
          previousDayParam={previousDayParam}
          nextDayParam={nextDayParam}
          basePath={basePath}
          hrefParams={hrefParams}
          categories={categories}
          facilities={facilities}
          teams={teams}
          filters={filters}
          showFacilityFilter={showFacilityFilter}
          conflictCount={conflictCount}
          onToggleConflicts={() => setShowConflictPanel((v) => !v)}
          availableSegments={availableSegments}
          activeDaySegment={activeDaySegment}
        />
        <EmptyState
          icon={<CalendarDays className="h-8 w-8" />}
          heading="Keine Ressourcen konfiguriert"
          description="Für die gewählte Kategorie sind keine planbaren Ressourcen vorhanden."
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <PlanningToolbar
        dayLabel={dayLabel}
        dayParam={dayParam}
        previousDayParam={previousDayParam}
        nextDayParam={nextDayParam}
        basePath={basePath}
        hrefParams={hrefParams}
        categories={categories}
        facilities={facilities}
        teams={teams}
        filters={filters}
        showFacilityFilter={showFacilityFilter}
        conflictCount={conflictCount}
        onToggleConflicts={() => setShowConflictPanel((v) => !v)}
        availableSegments={availableSegments}
        activeDaySegment={activeDaySegment}
      />

      {/* Desktop / tablet grid */}
      <div className="hidden md:block overflow-x-auto rounded-xl border border-[var(--border)] bg-[var(--surface)]">
        <div className="min-w-[640px]">
          <div
            className="sticky top-0 z-20 grid border-b border-[var(--border)] bg-[var(--surface-2)]"
            style={{ gridTemplateColumns: "12rem 1fr" }}
          >
            <div className="sticky left-0 z-30 border-r border-[var(--border)] bg-[var(--surface-2)] px-3 py-2 text-xs font-semibold uppercase text-[var(--muted)]">
              Ressource
            </div>
            <SegmentTimelineAxis majorTicks={majorTicks} minorMarkers={minorMarkers} timeline={segmentTimeline} />
          </div>

          {resourceGroups.map((group) => (
            <div key={group.facilityId}>
              {resourceGroups.length > 1 && (
                <div
                  className="grid border-b border-[var(--border)] bg-[var(--surface-2)]"
                  style={{ gridTemplateColumns: "12rem 1fr" }}
                >
                  <div className="sticky left-0 z-10 border-r border-[var(--border)] bg-[var(--surface-2)] px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-[var(--text-2)]">
                    {group.facilityName}
                  </div>
                  <div className="bg-[var(--surface-2)]" />
                </div>
              )}
              {group.lanes.map((lane) => {
                const laneBlocks = segmentBlocks.filter((block) => block.resourceId === lane.resourceId);
                const showFacilityInLane = resourceGroups.length === 1 && group.lanes.length > 1;
                const dropState =
                  draggedBlock && hoverLaneId === lane.resourceId
                    ? evaluateDropTarget(draggedBlock, lane, allPlannedBlocks, category)
                    : null;

                return (
                  <div
                    key={lane.resourceId}
                    className={cn("grid border-b border-[var(--border)] last:border-b-0", laneHeightClass)}
                    style={{ gridTemplateColumns: "12rem 1fr" }}
                    data-testid={`resource-lane-${lane.resourceId}`}
                    onDragOver={(event) => {
                      if (!draggedBlock || !canManage) return;
                      event.preventDefault();
                      setHoverLaneId(lane.resourceId);
                    }}
                    onDragLeave={() => setHoverLaneId((current) => (current === lane.resourceId ? null : current))}
                    onDrop={(event) => {
                      event.preventDefault();
                      handleDropOnLane(lane);
                    }}
                  >
                    <div className="sticky left-0 z-10 flex flex-col justify-center border-r border-[var(--border)] bg-[var(--surface)] px-3 py-2">
                      {showFacilityInLane && (
                        <span className="truncate text-[0.6rem] font-semibold uppercase tracking-wide text-[var(--muted)]">
                          {lane.facilityName}
                        </span>
                      )}
                      <span className="truncate text-sm font-medium text-[var(--foreground)]">{lane.resourceName}</span>
                    </div>
                    <div
                      className={cn(
                        "relative bg-[var(--surface)]",
                        dropState === "AVAILABLE" && "ring-2 ring-inset ring-emerald-400/60",
                        dropState === "CONFLICT" && "ring-2 ring-inset ring-red-400/60",
                        dropState === "INVALID_TYPE" && "ring-2 ring-inset ring-slate-300",
                      )}
                    >
                      {laneBlocks.map((block) => (
                        <ActivityBlock
                          key={block.sessionId}
                          block={block}
                          segment={activeDaySegment}
                          locale={locale}
                          timezone={timezone}
                          highlighted={highlightConflictId ? block.conflicts.some((c) => c.id === highlightConflictId) : false}
                          draggable={canManage}
                          onDragStart={() => setDraggedBlock(block)}
                          onDragEnd={() => {
                            setDraggedBlock(null);
                            setHoverLaneId(null);
                          }}
                          onClick={() => setSelectedBlock(block)}
                          onChangeResource={() => setResourceChangeBlock(block)}
                          canManage={canManage}
                        />
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          ))}

          {segmentUnplanned.length > 0 && !filters.conflictsOnly && (
            <UnplannedSection
              blocks={segmentUnplanned}
              locale={locale}
              timezone={timezone}
              canManage={canManage}
              onDragStart={setDraggedBlock}
              onDragEnd={() => setDraggedBlock(null)}
              onSelect={setSelectedBlock}
            />
          )}
        </div>
      </div>

      {/* Mobile list */}
      <div className="space-y-3 md:hidden">
        <DaySegmentSwitcher
          availableSegments={availableSegments}
          activeDaySegment={activeDaySegment}
          basePath={basePath}
          hrefParams={hrefParams}
          compact
        />
        {mobileBlocks.map((block) => (
          <MobileActivityCard
            key={block.sessionId}
            block={block}
            locale={locale}
            timezone={timezone}
            canManage={canManage}
            lanes={lanes}
            onSelect={() => setSelectedBlock(block)}
            onChangeResource={() => setResourceChangeBlock(block)}
          />
        ))}
      </div>

      <Sheet
        open={showConflictPanel && conflicts.length > 0}
        onClose={() => setShowConflictPanel(false)}
        title="Konflikte"
        description="Überschneidende Ressourcenbelegungen"
      >
        <ul className="space-y-3">
          {conflicts.map((conflict) => (
            <li key={conflict.id}>
              <button
                type="button"
                className="w-full rounded-lg border border-amber-200 bg-amber-50/50 px-3 py-2 text-left"
                onClick={() => {
                  setHighlightConflictId(conflict.id);
                  setShowConflictPanel(false);
                }}
              >
                <p className="text-sm font-semibold text-[var(--foreground)]">{conflict.resourceName}</p>
                <p className="text-xs text-[var(--text-2)]">
                  {formatTimeRange(conflict.startAt, conflict.endAt, locale, timezone)}
                </p>
                <p className="mt-1 text-xs text-amber-800">{conflict.activityLabels.join(" ↔ ")}</p>
              </button>
            </li>
          ))}
        </ul>
      </Sheet>

      <Sheet
        open={Boolean(selectedBlock)}
        onClose={() => setSelectedBlock(null)}
        title={selectedBlock?.session.teamName ?? "Training"}
        description={selectedBlock?.session.trainingSeriesTitle}
      >
        {selectedBlock && (
          <ActivityDetailContent
            block={selectedBlock}
            locale={locale}
            timezone={timezone}
            canManage={canManage}
            onChangeResource={() => {
              setResourceChangeBlock(selectedBlock);
              setSelectedBlock(null);
            }}
            editHref={`/dashboard/training/sessions/${selectedBlock.sessionId}/edit`}
          />
        )}
      </Sheet>

      <ResourceChangeDialog
        open={Boolean(resourceChangeBlock)}
        block={resourceChangeBlock}
        lanes={lanes}
        category={category}
        allBlocks={allPlannedBlocks}
        onClose={() => setResourceChangeBlock(null)}
        onConfirm={(lane, scope) => {
          if (!resourceChangeBlock) return;
          setPendingReassignment({ block: resourceChangeBlock, targetLane: lane, scope });
          setResourceChangeBlock(null);
        }}
      />

      <Dialog
        open={Boolean(pendingReassignment)}
        onClose={() => setPendingReassignment(null)}
        title="Ressourcenänderung"
        size="sm"
        footer={
          <>
            <button type="button" className="fca-button-secondary text-sm" onClick={() => setPendingReassignment(null)}>
              Abbrechen
            </button>
            <button
              type="button"
              className="fca-button-primary text-sm"
              disabled={isPending}
              onClick={() => {
                if (!pendingReassignment) return;
                startTransition(async () => {
                  try {
                    await submitReassignment(pendingReassignment);
                  } catch (err) {
                    toast.danger(err instanceof Error ? err.message : "Änderung fehlgeschlagen");
                  }
                });
              }}
            >
              Änderung übernehmen
            </button>
          </>
        }
      >
        {pendingReassignment && (
          <div className="space-y-3 text-sm">
            <p className="font-semibold">{pendingReassignment.block.session.teamName}</p>
            <p className="text-[var(--text-2)]">
              {formatTimeRange(
                pendingReassignment.block.startAt,
                pendingReassignment.block.endAt,
                locale,
                timezone,
              )}
            </p>
            <p>
              {pendingReassignment.block.resourceName ?? "Ungeplant"} → {pendingReassignment.targetLane.resourceName}
            </p>
            <fieldset className="space-y-2">
              <legend className="text-xs font-semibold uppercase text-[var(--muted)]">Änderung anwenden auf</legend>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="scope"
                  checked={pendingReassignment.scope === "occurrence"}
                  onChange={() =>
                    setPendingReassignment({ ...pendingReassignment, scope: "occurrence" })
                  }
                />
                Nur diesen Termin
              </label>
              <label className="flex items-center gap-2">
                <input
                  type="radio"
                  name="scope"
                  checked={pendingReassignment.scope === "series"}
                  onChange={() =>
                    setPendingReassignment({ ...pendingReassignment, scope: "series" })
                  }
                />
                Alle zukünftigen Termine dieser Serie
              </label>
            </fieldset>
          </div>
        )}
      </Dialog>
    </div>
  );
}

function PlanningToolbar({
  dayLabel,
  dayParam,
  previousDayParam,
  nextDayParam,
  basePath,
  hrefParams,
  categories,
  facilities,
  teams,
  filters,
  showFacilityFilter,
  conflictCount,
  onToggleConflicts,
  availableSegments,
  activeDaySegment,
}: {
  dayLabel: string;
  dayParam: string;
  previousDayParam: string;
  nextDayParam: string;
  basePath: string;
  hrefParams: Record<string, string | undefined>;
  categories: PlanningGridViewModel["categories"];
  facilities: PlanningGridViewModel["facilities"];
  teams: PlanningGridViewModel["teams"];
  filters: PlanningGridViewModel["filters"];
  showFacilityFilter: boolean;
  conflictCount: number;
  onToggleConflicts: () => void;
  availableSegments: { key: DaySegmentKey; label: string }[];
  activeDaySegment: DaySegmentKey;
}) {
  const todayParam = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Europe/Zurich",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  return (
    <div
      className="sticky top-0 z-30 space-y-3 rounded-xl border border-[var(--border)] bg-[var(--surface)] p-3 shadow-sm"
      data-testid="planning-grid-toolbar"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-1">
          <Link
            href={buildPlanningHref(basePath, { ...hrefParams, day: previousDayParam })}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)]"
            aria-label="Vorheriger Tag"
          >
            <ChevronLeft className="h-4 w-4" />
          </Link>
          <Link
            href={buildPlanningHref(basePath, { ...hrefParams, day: todayParam })}
            className="rounded-lg border border-[var(--border)] px-3 py-1.5 text-xs font-semibold"
          >
            Heute
          </Link>
          <Link
            href={buildPlanningHref(basePath, { ...hrefParams, day: nextDayParam })}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[var(--border)]"
            aria-label="Nächster Tag"
          >
            <ChevronRight className="h-4 w-4" />
          </Link>
        </div>
        <span className="text-sm font-semibold">{dayLabel}</span>
        {conflictCount > 0 && (
          <button
            type="button"
            onClick={onToggleConflicts}
            className="inline-flex items-center gap-1.5 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1 text-xs font-semibold text-amber-800"
            data-testid="planning-conflict-count"
          >
            <AlertTriangle className="h-3.5 w-3.5" aria-hidden />
            {conflictCount} Konflikt{conflictCount === 1 ? "" : "e"}
          </button>
        )}
      </div>

      <DaySegmentSwitcher
        availableSegments={availableSegments}
        activeDaySegment={activeDaySegment}
        basePath={basePath}
        hrefParams={hrefParams}
      />

      <div className="flex flex-wrap gap-2">
        {categories.length > 1 &&
          categories.map((cat) => (
            <Link
              key={cat.key}
              href={buildPlanningHref(basePath, { ...hrefParams, category: cat.key })}
              className={cn(
                "rounded-full border px-3 py-1 text-xs font-semibold",
                hrefParams.category === cat.key
                  ? "border-[var(--sce-primary)] bg-[var(--sce-primary-light)] text-[var(--sce-primary)]"
                  : "border-[var(--border)] text-[var(--text-2)]",
              )}
            >
              {cat.label}
            </Link>
          ))}

        {showFacilityFilter && (
          <select
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs"
            value={filters.facilityId ?? ""}
            onChange={(event) => {
              const value = event.target.value;
              window.location.href = buildPlanningHref(basePath, {
                ...hrefParams,
                facility: value || undefined,
              });
            }}
          >
            <option value="">Anlage: Alle</option>
            {facilities.map((facility) => (
              <option key={facility.id} value={facility.id}>
                {facility.name}
              </option>
            ))}
          </select>
        )}

        {teams.length > 1 && (
          <select
            className="rounded-lg border border-[var(--border)] bg-[var(--surface)] px-2 py-1 text-xs"
            value={filters.teamSeasonId ?? ""}
            onChange={(event) => {
              const value = event.target.value;
              window.location.href = buildPlanningHref(basePath, {
                ...hrefParams,
                team: value || undefined,
              });
            }}
          >
            <option value="">Team: Alle</option>
            {teams.map((team) => (
              <option key={team.id} value={team.id}>
                {team.name}
              </option>
            ))}
          </select>
        )}

        <Link
          href={buildPlanningHref(basePath, {
            ...hrefParams,
            conflicts: filters.conflictsOnly ? undefined : "1",
          })}
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-semibold",
            filters.conflictsOnly ? "border-amber-400 bg-amber-50 text-amber-800" : "border-[var(--border)]",
          )}
        >
          Nur Konflikte
        </Link>
        <Link
          href={buildPlanningHref(basePath, {
            ...hrefParams,
            unallocated: filters.unallocatedOnly ? undefined : "1",
          })}
          className={cn(
            "rounded-full border px-3 py-1 text-xs font-semibold",
            filters.unallocatedOnly ? "border-amber-400 bg-amber-50 text-amber-800" : "border-[var(--border)]",
          )}
        >
          Nur Ungeplant
        </Link>
      </div>
    </div>
  );
}

function SegmentTimelineAxis({
  timeline,
  majorTicks,
  minorMarkers,
}: {
  timeline: PlanningGridViewModel["timeline"];
  majorTicks: number[];
  minorMarkers: number[];
}) {
  return (
    <div className="relative h-10" data-testid="segment-timeline-axis">
      {minorMarkers.map((marker) => (
        <div
          key={`minor-${marker}`}
          className="absolute top-0 bottom-0 w-px bg-[var(--border)]/50"
          style={{ left: `${minutesToPercent(marker, timeline)}%` }}
          aria-hidden
        />
      ))}
      {majorTicks.map((tick) => (
        <span
          key={tick}
          className="absolute top-2 -translate-x-1/2 text-[0.7rem] font-medium text-[var(--muted)]"
          style={{ left: `${minutesToPercent(tick, timeline)}%` }}
          data-testid={`timeline-major-${formatTimelineLabel(tick)}`}
        >
          {formatTimelineLabel(tick)}
        </span>
      ))}
    </div>
  );
}

function DaySegmentSwitcher({
  availableSegments,
  activeDaySegment,
  basePath,
  hrefParams,
  compact = false,
}: {
  availableSegments: { key: DaySegmentKey; label: string }[];
  activeDaySegment: DaySegmentKey;
  basePath: string;
  hrefParams: Record<string, string | undefined>;
  compact?: boolean;
}) {
  return (
    <div className={cn("space-y-1", compact ? "" : "border-t border-[var(--border)] pt-2")} data-testid="day-segment-switcher">
      <p className="text-[0.65rem] font-semibold uppercase tracking-wide text-[var(--muted)]">Tagesabschnitt</p>
      <div className={cn("flex flex-wrap gap-1", compact ? "" : "")} role="group" aria-label="Tagesabschnitt">
        {availableSegments.map((segment) => {
          const isActive = segment.key === activeDaySegment;
          return (
            <Link
              key={segment.key}
              href={buildPlanningHref(basePath, { ...hrefParams, daypart: segment.key })}
              data-testid={`day-segment-${segment.key}`}
              aria-pressed={isActive}
              className={cn(
                "rounded-md border px-2 py-1 text-[0.7rem] font-semibold transition-colors",
                isActive
                  ? "border-[var(--sce-primary)] bg-[var(--sce-primary-light)] text-[var(--sce-primary)]"
                  : "border-[var(--border)] text-[var(--text-2)] hover:border-[var(--sce-primary)]/40",
              )}
            >
              {segment.label}
            </Link>
          );
        })}
      </div>
    </div>
  );
}

function ActivityBlock({
  block,
  segment,
  locale,
  timezone,
  highlighted,
  draggable,
  onDragStart,
  onDragEnd,
  onClick,
  onChangeResource,
  canManage,
}: {
  block: ScheduledActivityBlock;
  segment: DaySegmentKey;
  locale: string;
  timezone: string;
  highlighted: boolean;
  draggable: boolean;
  onDragStart: () => void;
  onDragEnd: () => void;
  onClick: () => void;
  onChangeResource: () => void;
  canManage: boolean;
}) {
  const fragment = blockSegmentFragment(block, segment, timezone);
  if (!fragment) return null;

  return (
    <button
      type="button"
      draggable={draggable}
      onDragStart={onDragStart}
      onDragEnd={onDragEnd}
      onClick={onClick}
      className={cn(
        "absolute top-1 bottom-1 overflow-hidden rounded-md border px-2 py-1 text-left shadow-sm transition",
        block.hasConflict
          ? "border-amber-400 bg-amber-50 text-amber-950"
          : "border-[var(--border)] bg-[var(--sce-primary-light)] text-[var(--foreground)]",
        highlighted && "ring-2 ring-amber-500",
        fragment.continuesBefore && "rounded-l-none border-l-2 border-l-dashed border-l-amber-500",
        fragment.continuesAfter && "rounded-r-none border-r-2 border-r-dashed border-r-amber-500",
      )}
      style={{ left: `${fragment.leftPercent}%`, width: `${fragment.widthPercent}%` }}
      data-testid={`activity-block-${block.sessionId}`}
      data-conflict={block.hasConflict ? "true" : "false"}
      data-continues-before={fragment.continuesBefore ? "true" : "false"}
      data-continues-after={fragment.continuesAfter ? "true" : "false"}
      aria-label={`${block.session.teamName}, ${formatTimeRange(block.startAt, block.endAt, locale, timezone)}${block.hasConflict ? ", Konflikt" : ""}`}
    >
      {fragment.continuesBefore && (
        <span className="absolute left-0.5 top-1 text-[0.55rem] font-bold text-amber-700" aria-hidden>
          ‹
        </span>
      )}
      <span className="block truncate text-xs font-semibold">{block.session.teamName}</span>
      <span className="block truncate text-[0.65rem] opacity-80">
        {formatTimeRange(block.startAt, block.endAt, locale, timezone)}
      </span>
      {block.secondaryResourceLabel && (
        <span className="block truncate text-[0.6rem] opacity-70">{block.secondaryResourceLabel}</span>
      )}
      {block.hasConflict && (
        <span className="block truncate text-[0.6rem] font-medium text-amber-800">Konflikt</span>
      )}
      {fragment.continuesAfter && (
        <span className="absolute right-0.5 top-1 text-[0.55rem] font-bold text-amber-700" aria-hidden>
          ›
        </span>
      )}
      {canManage && (
        <span
          role="button"
          tabIndex={0}
          className="mt-1 block text-[0.6rem] underline"
          onClick={(event) => {
            event.stopPropagation();
            onChangeResource();
          }}
          onKeyDown={(event) => {
            if (event.key === "Enter") {
              event.stopPropagation();
              onChangeResource();
            }
          }}
        >
          Ressource ändern
        </span>
      )}
    </button>
  );
}

function UnplannedSection({
  blocks,
  locale,
  timezone,
  canManage,
  onDragStart,
  onDragEnd,
  onSelect,
}: {
  blocks: ScheduledActivityBlock[];
  locale: string;
  timezone: string;
  canManage: boolean;
  onDragStart: (block: ScheduledActivityBlock) => void;
  onDragEnd: () => void;
  onSelect: (block: ScheduledActivityBlock) => void;
}) {
  return (
    <div className="border-t border-[var(--border)] bg-[var(--surface-2)]" data-testid="unplanned-lane">
      <div className="px-3 py-2 text-xs font-semibold uppercase text-[var(--muted)]">
        Ungeplant ({blocks.length})
      </div>
      <div className="flex flex-wrap gap-2 px-3 pb-3">
        {blocks.map((block) => (
          <button
            key={block.sessionId}
            type="button"
            draggable={canManage}
            onDragStart={() => onDragStart(block)}
            onDragEnd={onDragEnd}
            onClick={() => onSelect(block)}
            className="rounded-lg border border-dashed border-amber-300 bg-amber-50/50 px-3 py-2 text-left text-xs"
          >
            <span className="font-semibold">{block.session.teamName}</span>
            <span className="block text-[var(--text-2)]">
              {formatTimeRange(block.startAt, block.endAt, locale, timezone)}
            </span>
          </button>
        ))}
      </div>
    </div>
  );
}

function MobileActivityCard({
  block,
  locale,
  timezone,
  canManage,
  lanes,
  onSelect,
  onChangeResource,
}: {
  block: ScheduledActivityBlock;
  locale: string;
  timezone: string;
  canManage: boolean;
  lanes: ResourceLane[];
  onSelect: () => void;
  onChangeResource: () => void;
}) {
  return (
    <div
      className={cn(
        "rounded-xl border p-3",
        block.hasConflict ? "border-amber-300 bg-amber-50" : "border-[var(--border)] bg-[var(--surface)]",
      )}
    >
      <button type="button" className="w-full text-left" onClick={onSelect}>
        <p className="font-semibold">{block.session.teamName}</p>
        <p className="text-xs text-[var(--text-2)]">
          {formatTimeRange(block.startAt, block.endAt, locale, timezone)}
        </p>
        <p className="text-xs">{block.resourceName ?? "Ungeplant"}</p>
      </button>
      {canManage && (
        <button type="button" className="mt-2 text-xs font-semibold text-[var(--sce-primary)]" onClick={onChangeResource}>
          Ressource ändern
        </button>
      )}
    </div>
  );
}

function ActivityDetailContent({
  block,
  locale,
  timezone,
  canManage,
  onChangeResource,
  editHref,
}: {
  block: ScheduledActivityBlock;
  locale: string;
  timezone: string;
  canManage: boolean;
  onChangeResource: () => void;
  editHref: string;
}) {
  return (
    <div className="space-y-3 text-sm">
      <p>{formatTimeRange(block.startAt, block.endAt, locale, timezone)}</p>
      <p>
        <span className="text-[var(--muted)]">Ressource: </span>
        {block.resourceName ?? "Ungeplant"}
      </p>
      {block.hasConflict && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-amber-800">
          Ressourcenkonflikt — {block.conflicts.map((c) => c.activityLabels.join(" ↔ ")).join("; ")}
        </p>
      )}
      {canManage && (
        <button type="button" className="fca-button-secondary text-sm" onClick={onChangeResource}>
          Ressource ändern
        </button>
      )}
      <Link href={editHref} className="block text-sm text-[var(--sce-primary)]">
        Details bearbeiten
      </Link>
    </div>
  );
}

function ResourceChangeDialog({
  open,
  block,
  lanes,
  category,
  allBlocks,
  onClose,
  onConfirm,
}: {
  open: boolean;
  block: ScheduledActivityBlock | null;
  lanes: ResourceLane[];
  category: PlanningResourceCategoryKey;
  allBlocks: ScheduledActivityBlock[];
  onClose: () => void;
  onConfirm: (lane: ResourceLane, scope: ResourceReassignmentScope) => void;
}) {
  const [query, setQuery] = useState("");
  const [scope, setScope] = useState<ResourceReassignmentScope>("occurrence");

  const filteredLanes = useMemo(() => {
    const q = query.trim().toLowerCase();
    return lanes.filter((lane) => !q || lane.resourceName.toLowerCase().includes(q));
  }, [lanes, query]);

  if (!block) return null;

  return (
    <Dialog open={open} onClose={onClose} title="Ressource ändern" size="md">
      <div className="space-y-3">
        <input
          type="search"
          placeholder="Ressource suchen…"
          className="w-full rounded-lg border border-[var(--border)] px-3 py-2 text-sm"
          value={query}
          onChange={(event) => setQuery(event.target.value)}
          data-testid="resource-change-search"
        />
        <fieldset className="space-y-1 text-xs">
          <legend className="font-semibold uppercase text-[var(--muted)]">Änderung anwenden auf</legend>
          <label className="flex items-center gap-2">
            <input type="radio" checked={scope === "occurrence"} onChange={() => setScope("occurrence")} />
            Nur diesen Termin
          </label>
          <label className="flex items-center gap-2">
            <input type="radio" checked={scope === "series"} onChange={() => setScope("series")} />
            Alle zukünftigen Termine dieser Serie
          </label>
        </fieldset>
        <ul className="max-h-64 space-y-1 overflow-y-auto">
          {filteredLanes.map((lane) => {
            const state = evaluateDropTarget(block, lane, allBlocks, category);
            return (
              <li key={lane.resourceId}>
                <button
                  type="button"
                  disabled={state !== "AVAILABLE"}
                  className={cn(
                    "flex w-full items-center justify-between rounded-lg border px-3 py-2 text-left text-sm",
                    state === "AVAILABLE"
                      ? "border-[var(--border)] hover:bg-[var(--surface-2)]"
                      : "cursor-not-allowed border-[var(--border)] opacity-50",
                  )}
                  onClick={() => onConfirm(lane, scope)}
                  data-testid={`resource-option-${lane.resourceId}`}
                >
                  <span>{lane.resourceName}</span>
                  <span className="text-xs">
                    {state === "AVAILABLE" && "✓ Verfügbar"}
                    {state === "CONFLICT" && "✕ Konflikt"}
                    {state === "INVALID_TYPE" && "Ungültig"}
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      </div>
    </Dialog>
  );
}
