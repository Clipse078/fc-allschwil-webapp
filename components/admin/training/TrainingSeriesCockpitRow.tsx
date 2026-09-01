"use client";

import { useCallback, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, MoreHorizontal, Pencil } from "lucide-react";
import type { FacilityGroup } from "@/components/admin/training/FacilityResourceSelector";
import TrainingSeriesArchiveButton from "./TrainingSeriesArchiveButton";
import TrainingSeriesDeleteControl from "./TrainingSeriesDeleteControl";
import PlanningWorkflowActionsClient from "@/components/admin/shared/PlanningWorkflowActionsClient";
import PlanningWorkflowBadge from "@/components/admin/shared/PlanningWorkflowBadge";
import { PopoverContent } from "@/components/ui/Popover";
import { cn } from "@/lib/cn";
import type { TrainingSeriesCockpitRow as CockpitRow } from "@/lib/training/series-cockpit";

type ResourceGroup = "PITCH_HALL" | "DRESSING_ROOM";

type Props = {
  row: CockpitRow;
  canManage: boolean;
  canDelete: boolean;
  isCoordinator: boolean;
  pitchFacilityGroups: FacilityGroup[];
  dressingRoomFacilityGroups: FacilityGroup[];
};

function formatDate(iso: string | null): string | null {
  if (!iso) return null;
  return new Date(iso).toLocaleDateString("de-CH", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
  });
}

function statusBadgeClasses(status: CockpitRow["status"]): string {
  switch (status) {
    case "ACTIVE":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "INACTIVE":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "ARCHIVED":
      return "border-slate-200 bg-slate-100 text-slate-500";
  }
}

function statusLabel(status: CockpitRow["status"]): string {
  switch (status) {
    case "ACTIVE":
      return "Aktiv";
    case "INACTIVE":
      return "Inaktiv";
    case "ARCHIVED":
      return "Archiviert";
  }
}

function ResourceQuickEdit({
  row,
  group,
  currentName,
  allocationId,
  currentResourceId,
  facilityGroups,
  disabled,
}: {
  row: CockpitRow;
  group: ResourceGroup;
  currentName: string | null;
  allocationId: string | null;
  currentResourceId: string | null;
  facilityGroups: FacilityGroup[];
  disabled: boolean;
}) {
  const router = useRouter();
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const label = group === "PITCH_HALL" ? "Spielfeld" : "Garderobe";

  const handleSelect = useCallback(
    (facilityResourceId: string) => {
      if (disabled || facilityResourceId === currentResourceId) {
        setOpen(false);
        return;
      }

      setError(null);
      startTransition(async () => {
        try {
          if (allocationId) {
            const deleteRes = await fetch(
              `/api/training-series/${row.seriesId}/allocations/${allocationId}`,
              { method: "DELETE" },
            );
            if (!deleteRes.ok) {
              const data = (await deleteRes.json().catch(() => null)) as { error?: string } | null;
              throw new Error(data?.error ?? `${label} konnte nicht aktualisiert werden.`);
            }
          }

          const createRes = await fetch(`/api/training-series/${row.seriesId}/allocations`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ facilityResourceId }),
          });
          const createData = (await createRes.json().catch(() => null)) as { error?: string } | null;
          if (!createRes.ok) {
            throw new Error(createData?.error ?? `${label} konnte nicht zugewiesen werden.`);
          }

          setOpen(false);
          router.refresh();
        } catch (err) {
          setError(err instanceof Error ? err.message : `${label} konnte nicht aktualisiert werden.`);
        }
      });
    },
    [allocationId, currentResourceId, disabled, label, row.seriesId, router],
  );

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((value) => !value)}
        className={cn(
          "group/edit inline-flex min-w-0 items-center gap-1 rounded px-1 py-0.5 text-left transition hover:bg-[var(--surface-2)]",
          disabled && "cursor-default hover:bg-transparent",
        )}
        data-testid={`training-series-cockpit-${group.toLowerCase()}-${row.rowKey}`}
      >
        <span className="truncate text-sm text-[var(--foreground)]">{currentName ?? "—"}</span>
        {!disabled ? (
          <Pencil className="h-3 w-3 shrink-0 text-[var(--muted)] opacity-0 transition group-hover/edit:opacity-100" />
        ) : null}
      </button>
      <PopoverContent open={open} onOpenChange={setOpen} anchorRef={anchorRef} matchAnchorWidth={false}>
        <div className="w-72 space-y-2 p-2">
          <p className="text-xs font-semibold text-[var(--foreground)]">{label} wählen</p>
          <div className="max-h-56 space-y-1 overflow-y-auto">
            {facilityGroups.flatMap((facilityGroup) =>
              facilityGroup.resources.map((resource) => (
                <button
                  key={resource.id}
                  type="button"
                  disabled={isPending}
                  onClick={() => handleSelect(resource.id)}
                  className={cn(
                    "flex w-full items-center justify-between rounded-md px-2 py-1.5 text-left text-xs hover:bg-[var(--surface-2)]",
                    resource.id === currentResourceId && "bg-[var(--blue-light)] text-[var(--blue)]",
                  )}
                >
                  <span>{resource.name}</span>
                  <span className="text-[var(--muted)]">{facilityGroup.facilityName}</span>
                </button>
              )),
            )}
          </div>
          {isPending ? (
            <p className="flex items-center gap-1 text-xs text-[var(--muted)]">
              <Loader2 className="h-3 w-3 animate-spin" />
              Speichern…
            </p>
          ) : null}
          {error ? <p className="text-xs text-rose-600">{error}</p> : null}
        </div>
      </PopoverContent>
    </>
  );
}

function TimeQuickEdit({ row, disabled }: { row: CockpitRow; disabled: boolean }) {
  const router = useRouter();
  const anchorRef = useRef<HTMLButtonElement>(null);
  const [open, setOpen] = useState(false);
  const [startsAt, setStartsAt] = useState(row.startsAt);
  const [endsAt, setEndsAt] = useState(row.endsAt);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  const handleSave = () => {
    if (disabled || !startsAt || !endsAt || startsAt >= endsAt) {
      setError("Start muss vor Ende liegen.");
      return;
    }

    setError(null);
    startTransition(async () => {
      try {
        const weekdaySchedules = row.seriesWeekdaySchedules.map((schedule) =>
          schedule.weekday === row.weekday ? { weekday: schedule.weekday, startsAt, endsAt } : schedule,
        );

        const updateRes = await fetch(`/api/training-series/${row.seriesId}`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            title: row.title,
            weekdaySchedules,
            validFrom: row.validFrom ?? undefined,
            validUntil: row.validUntil ?? undefined,
            timezone: row.timezone,
          }),
        });
        const updateData = (await updateRes.json().catch(() => null)) as { error?: string } | null;
        if (!updateRes.ok) {
          throw new Error(updateData?.error ?? "Zeiten konnten nicht gespeichert werden.");
        }

        setOpen(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Zeiten konnten nicht gespeichert werden.");
      }
    });
  };

  return (
    <>
      <button
        ref={anchorRef}
        type="button"
        disabled={disabled}
        onClick={() => !disabled && setOpen((value) => !value)}
        className={cn(
          "group/edit inline-flex items-center gap-1 rounded px-1 py-0.5 font-mono text-sm tabular-nums text-[var(--foreground)] transition hover:bg-[var(--surface-2)]",
          disabled && "cursor-default hover:bg-transparent",
        )}
        data-testid={`training-series-cockpit-time-${row.rowKey}`}
      >
        {row.startsAt}–{row.endsAt}
        {!disabled ? (
          <Pencil className="h-3 w-3 shrink-0 text-[var(--muted)] opacity-0 transition group-hover/edit:opacity-100" />
        ) : null}
      </button>
      <PopoverContent open={open} onOpenChange={setOpen} anchorRef={anchorRef} matchAnchorWidth={false}>
        <div className="w-56 space-y-2 p-2">
          <p className="text-xs font-semibold text-[var(--foreground)]">Zeit bearbeiten</p>
          <div className="grid grid-cols-2 gap-2">
            <label className="space-y-1">
              <span className="fca-label">Start</span>
              <input type="time" value={startsAt} onChange={(e) => setStartsAt(e.target.value)} className="fca-input" />
            </label>
            <label className="space-y-1">
              <span className="fca-label">Ende</span>
              <input type="time" value={endsAt} onChange={(e) => setEndsAt(e.target.value)} className="fca-input" />
            </label>
          </div>
          <button type="button" onClick={handleSave} disabled={isPending} className="fca-button-primary w-full text-xs">
            {isPending ? "Speichern…" : "Speichern"}
          </button>
          {error ? <p className="text-xs text-rose-600">{error}</p> : null}
        </div>
      </PopoverContent>
    </>
  );
}

export default function TrainingSeriesCockpitRow({
  row,
  canManage,
  canDelete,
  isCoordinator,
  pitchFacilityGroups,
  dressingRoomFacilityGroups,
}: Props) {
  const menuAnchorRef = useRef<HTMLButtonElement>(null);
  const [menuOpen, setMenuOpen] = useState(false);
  const editable = canManage && row.status !== "ARCHIVED";
  const validFrom = formatDate(row.validFrom);
  const validUntil = formatDate(row.validUntil);

  return (
    <article
      className="grid grid-cols-[5.5rem_minmax(0,1.4fr)_minmax(0,1fr)_minmax(0,0.9fr)_auto] items-center gap-3 border-b border-[var(--border)] px-3 py-2 last:border-b-0 hover:bg-[var(--surface-2)]/40"
      data-testid={`training-series-cockpit-row-${row.rowKey}`}
    >
      <div className="min-w-0">
        <TimeQuickEdit row={row} disabled={!editable} />
      </div>

      <div className="min-w-0">
        <p className="truncate text-sm font-semibold text-[var(--foreground)]">{row.title}</p>
        <p className="truncate text-xs text-[var(--text-2)]">{row.teamDisplayName}</p>
      </div>

      <div className="min-w-0">
        <ResourceQuickEdit
          row={row}
          group="PITCH_HALL"
          currentName={row.pitchName}
          allocationId={row.pitchAllocationId}
          currentResourceId={row.pitchResourceId}
          facilityGroups={pitchFacilityGroups}
          disabled={!editable}
        />
      </div>

      <div className="min-w-0">
        <ResourceQuickEdit
          row={row}
          group="DRESSING_ROOM"
          currentName={row.dressingRoomName}
          allocationId={row.dressingRoomAllocationId}
          currentResourceId={row.dressingRoomResourceId}
          facilityGroups={dressingRoomFacilityGroups}
          disabled={!editable}
        />
      </div>

      <div className="flex items-center justify-end gap-1.5">
        <span
          className={cn(
            "hidden xl:inline-flex h-5 items-center rounded-full border px-2 text-[0.62rem] font-semibold",
            statusBadgeClasses(row.status),
          )}
        >
          {statusLabel(row.status)}
        </span>
        {(row.planningStage === "DRAFT" || row.planningStage === "SUBMITTED" ||
          (row.planningStage === "APPROVED" && !isCoordinator)) && (
          <PlanningWorkflowBadge stage={row.planningStage} size="sm" />
        )}
        <span className="hidden lg:inline text-[0.62rem] text-[var(--muted)]">
          {validFrom && validUntil ? `${validFrom}–${validUntil}` : "Unbegrenzt"}
        </span>

        {(editable || canDelete || row.planningStage === "DRAFT") && (
          <>
            <button
              ref={menuAnchorRef}
              type="button"
              onClick={() => setMenuOpen((value) => !value)}
              className="inline-flex h-7 w-7 items-center justify-center rounded-md border border-[var(--border)] bg-white text-[var(--foreground)] hover:bg-[var(--surface-2)]"
              aria-label="Weitere Aktionen"
              data-testid={`training-series-cockpit-menu-${row.rowKey}`}
            >
              <MoreHorizontal className="h-4 w-4" />
            </button>
            <PopoverContent open={menuOpen} onOpenChange={setMenuOpen} anchorRef={menuAnchorRef} matchAnchorWidth={false}>
              <div className="min-w-44 py-1">
                {editable ? (
                  <>
                    <a
                      href={`/dashboard/training/series/${row.seriesId}/edit`}
                      className="block px-3 py-2 text-xs hover:bg-[var(--surface-2)]"
                    >
                      Serie bearbeiten
                    </a>
                    <div className="px-3 py-2">
                      <TrainingSeriesArchiveButton seriesId={row.seriesId} seriesTitle={row.title} />
                    </div>
                  </>
                ) : null}
                {row.status !== "ARCHIVED" ? (
                  <div className="px-3 py-2">
                    <PlanningWorkflowActionsClient
                      recordId={row.seriesId}
                      domain="training"
                      planningStage={row.planningStage}
                      isCoordinator={isCoordinator}
                    />
                  </div>
                ) : null}
                <div className="px-3 py-2">
                  <TrainingSeriesDeleteControl
                    seriesId={row.seriesId}
                    seriesTitle={row.title}
                    canDelete={canDelete}
                    variant="inline"
                  />
                </div>
              </div>
            </PopoverContent>
          </>
        )}
      </div>
    </article>
  );
}
