"use client";

/**
 * components/admin/planner/WeekplannerPlanBar.tsx
 *
 * WOCHENPLAN-2.0-01H-E5 — premium plan switcher with publish + hard-delete.
 * Viewing a plan is independent from activation.
 */

import { useCallback, useRef, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Check,
  ChevronDown,
  Loader2,
  MoreHorizontal,
  Plus,
  Trash2,
} from "lucide-react";
import { PopoverContent } from "@/components/ui/Popover";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import { cn } from "@/lib/cn";
import type { WochenplanPlanDto } from "@/lib/wochenplan/plan-types";
import type { WeekplannerPlanDto } from "@/lib/weekplanner/plan-types";
import { WeekplannerPlanCreateDialog } from "./WeekplannerPlanCreateDialog";

type Props = {
  weekParam: string;
  wochenplanPlans: WochenplanPlanDto[];
  weekplannerPlans: WeekplannerPlanDto[];
  selectedPlanParam: string | null;
  materializedWeekplannerPlanId: string | null;
  canManage: boolean;
};

function buildWeekplannerHref(weekParam: string, wochenplanPlanId: string | null): string {
  const params = new URLSearchParams({ week: weekParam });
  if (wochenplanPlanId) params.set("plan", wochenplanPlanId);
  return `/dashboard/planner/week?${params.toString()}`;
}

function PlanStatusBadge({ isActive }: { isActive: boolean }) {
  return (
    <span
      className={cn(
        "rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide",
        isActive ? "bg-emerald-50 text-emerald-700" : "bg-amber-50 text-amber-700",
      )}
    >
      {isActive ? "Aktiv" : "Entwurf"}
    </span>
  );
}

export function WeekplannerPlanBar({
  weekParam,
  wochenplanPlans,
  weekplannerPlans,
  selectedPlanParam,
  materializedWeekplannerPlanId: _materializedWeekplannerPlanId,
  canManage,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);
  const [isPublishDialogOpen, setIsPublishDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [planPendingDelete, setPlanPendingDelete] = useState<WochenplanPlanDto | null>(null);
  const [switcherOpen, setSwitcherOpen] = useState(false);
  const [overflowPlanId, setOverflowPlanId] = useState<string | null>(null);
  const switcherAnchorRef = useRef<HTMLButtonElement>(null);

  const defaultPlan = wochenplanPlans.find((p) => p.isDefault) ?? wochenplanPlans[0] ?? null;
  const selectedValue = selectedPlanParam ?? defaultPlan?.id ?? "";
  const viewedWochenplanPlan =
    wochenplanPlans.find((p) => p.id === selectedValue) ??
    (selectedValue ? null : defaultPlan);
  const viewedLegacyPlan =
    !viewedWochenplanPlan && selectedValue
      ? weekplannerPlans.find((p) => p.id === selectedValue) ?? null
      : null;
  const viewedPlan = viewedWochenplanPlan ?? viewedLegacyPlan;
  const activePlan = wochenplanPlans.find((p) => p.isActive) ?? null;
  const isViewingActive = viewedWochenplanPlan?.isActive ?? false;
  const draftPlans = wochenplanPlans.filter((p) => !p.isActive);

  const handleSelect = useCallback(
    (value: string) => {
      setSwitcherOpen(false);
      router.push(buildWeekplannerHref(weekParam, value || null));
    },
    [router, weekParam],
  );

  const handlePublish = useCallback(() => {
    if (!viewedWochenplanPlan || viewedWochenplanPlan.isActive) return;
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/wochenplan/plans/${viewedWochenplanPlan.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ active: true }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error((data as { error?: string }).error ?? `Fehler: HTTP ${res.status}`);
        }
        setIsPublishDialogOpen(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Fehler beim Veröffentlichen");
      }
    });
  }, [viewedWochenplanPlan, router]);

  const handleDelete = useCallback(() => {
    if (!planPendingDelete) return;
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/wochenplan/plans/${planPendingDelete.id}`, {
          method: "DELETE",
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error((data as { error?: string }).error ?? `Fehler: HTTP ${res.status}`);
        }
        setIsDeleteDialogOpen(false);
        setPlanPendingDelete(null);
        if (viewedWochenplanPlan?.id === planPendingDelete.id) {
          router.push(buildWeekplannerHref(weekParam, activePlan?.id ?? defaultPlan?.id ?? null));
        }
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Fehler beim Löschen");
      }
    });
  }, [planPendingDelete, viewedWochenplanPlan?.id, activePlan?.id, defaultPlan?.id, weekParam, router]);

  if (wochenplanPlans.length === 0) return null;

  return (
    <div className="space-y-2" data-testid="weekplanner-plan-bar">
      <div className="flex flex-wrap items-center gap-2">
        <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
          Wochenplan
        </span>

        <button
          ref={switcherAnchorRef}
          type="button"
          data-testid="weekplanner-plan-switcher"
          onClick={() => setSwitcherOpen((open) => !open)}
          className="inline-flex min-w-[12rem] items-center justify-between gap-2 rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-sm font-medium text-[var(--foreground)] transition hover:bg-[var(--surface-2)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--sce-primary)]"
          aria-haspopup="listbox"
          aria-expanded={switcherOpen}
        >
          <span className="flex min-w-0 items-center gap-2">
            {isViewingActive ? <Check className="h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden="true" /> : null}
            <span className="truncate">{viewedPlan?.name ?? "Plan wählen"}</span>
            {viewedWochenplanPlan ? <PlanStatusBadge isActive={viewedWochenplanPlan.isActive} /> : null}
          </span>
          <ChevronDown className="h-4 w-4 shrink-0 text-[var(--muted)]" aria-hidden="true" />
        </button>

        {canManage && viewedWochenplanPlan && !isViewingActive ? (
          <button
            type="button"
            onClick={() => setIsPublishDialogOpen(true)}
            disabled={isPending}
            data-testid="weekplanner-plan-publish-button"
            className="inline-flex items-center gap-1.5 rounded-lg bg-[var(--sce-primary)] px-3 py-1.5 text-sm font-semibold text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {isPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : null}
            Veröffentlichen
          </button>
        ) : null}

        {canManage ? (
          <button
            type="button"
            onClick={() => setIsCreateDialogOpen(true)}
            data-testid="weekplanner-plan-create-button"
            className="inline-flex items-center gap-1.5 rounded-lg border border-dashed border-[var(--border-strong)] px-3 py-1.5 text-sm font-medium text-[var(--text-2)] transition hover:bg-[var(--surface-2)]"
          >
            <Plus className="h-3.5 w-3.5" />
            Neuer Plan
          </button>
        ) : null}
      </div>

      <PopoverContent
        open={switcherOpen}
        onOpenChange={setSwitcherOpen}
        anchorRef={switcherAnchorRef}
        matchAnchorWidth
        maxHeight={360}
        className="p-0"
      >
        <div className="px-3 py-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[var(--muted)]">
          Plan auswählen
        </div>

        {activePlan ? (
          <div className="border-t border-[var(--border)] px-1 py-1">
            <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">Aktiv</p>
            <PlanSwitcherRow
              plan={activePlan}
              selected={viewedWochenplanPlan?.id === activePlan.id}
              canManage={canManage}
              onSelect={() => handleSelect(activePlan.id)}
              onDelete={() => {
                setSwitcherOpen(false);
                setPlanPendingDelete(activePlan);
                setIsDeleteDialogOpen(true);
              }}
              onOverflowToggle={(open) => setOverflowPlanId(open ? activePlan.id : null)}
              overflowOpen={overflowPlanId === activePlan.id}
            />
          </div>
        ) : null}

        {draftPlans.length > 0 ? (
          <div className="border-t border-[var(--border)] px-1 py-1">
            <p className="px-2 py-1 text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]">Entwürfe</p>
            {draftPlans.map((plan) => (
              <PlanSwitcherRow
                key={plan.id}
                plan={plan}
                selected={viewedWochenplanPlan?.id === plan.id}
                canManage={canManage}
                onSelect={() => handleSelect(plan.id)}
                onDelete={() => {
                  setSwitcherOpen(false);
                  setPlanPendingDelete(plan);
                  setIsDeleteDialogOpen(true);
                }}
                onOverflowToggle={(open) => setOverflowPlanId(open ? plan.id : null)}
                overflowOpen={overflowPlanId === plan.id}
              />
            ))}
          </div>
        ) : null}

        {canManage ? (
          <div className="border-t border-[var(--border)] p-1">
            <button
              type="button"
              onClick={() => {
                setSwitcherOpen(false);
                setIsCreateDialogOpen(true);
              }}
              className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-[var(--text-2)] transition hover:bg-[var(--surface-2)]"
            >
              <Plus className="h-4 w-4" />
              Neuer Plan
            </button>
          </div>
        ) : null}
      </PopoverContent>

      {error && (
        <p className="text-xs text-rose-600" role="alert" data-testid="weekplanner-plan-bar-error">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2 text-xs">
        {isViewingActive ? (
          <div
            className="inline-flex items-center gap-1.5 font-semibold text-emerald-700"
            data-testid="weekplanner-active-plan-banner"
          >
            <Check className="h-3.5 w-3.5" aria-hidden="true" />
            Aktiver Plan · {viewedPlan?.name ?? activePlan?.name ?? "—"}
          </div>
        ) : viewedPlan ? (
          <>
            <div
              className="inline-flex items-center gap-1.5 font-semibold text-amber-700"
              data-testid="weekplanner-draft-plan-banner"
            >
              Entwurf · {viewedPlan.name}
            </div>
            {activePlan ? (
              <span className="text-[var(--muted)]" data-testid="weekplanner-current-active-reference">
                Aktiver Plan: {activePlan.name}
              </span>
            ) : null}
          </>
        ) : null}
      </div>

      <WeekplannerPlanCreateDialog
        open={isCreateDialogOpen}
        weekParam={weekParam}
        wochenplanPlans={wochenplanPlans}
        onClose={() => setIsCreateDialogOpen(false)}
        onCreated={(planId) => {
          setIsCreateDialogOpen(false);
          router.push(buildWeekplannerHref(weekParam, planId));
          router.refresh();
        }}
      />

      <Dialog
        open={isPublishDialogOpen}
        onClose={() => setIsPublishDialogOpen(false)}
        title={viewedWochenplanPlan ? `${viewedWochenplanPlan.name} veröffentlichen?` : "Plan veröffentlichen"}
        description={
          viewedWochenplanPlan
            ? `Dieser Plan wird zum aktiven Wochenplan und wird für Website und Infoboard verwendet.${
                activePlan
                  ? ` Der aktuell aktive Plan "${activePlan.name}" wird als Entwurf gespeichert.`
                  : ""
              }`
            : undefined
        }
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsPublishDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={handlePublish} disabled={isPending} data-testid="weekplanner-plan-publish-confirm">
              {isPending ? "Veröffentliche…" : "Plan veröffentlichen"}
            </Button>
          </>
        }
      />

      <Dialog
        open={isDeleteDialogOpen}
        onClose={() => {
          setIsDeleteDialogOpen(false);
          setPlanPendingDelete(null);
        }}
        title={planPendingDelete ? `"${planPendingDelete.name}" endgültig löschen?` : "Plan löschen"}
        description="Dieser Entwurf und seine Wochenplanung werden dauerhaft gelöscht. Diese Aktion kann nicht rückgängig gemacht werden."
        size="sm"
        footer={
          <>
            <Button
              variant="secondary"
              onClick={() => {
                setIsDeleteDialogOpen(false);
                setPlanPendingDelete(null);
              }}
            >
              Abbrechen
            </Button>
            <Button
              variant="danger"
              onClick={handleDelete}
              disabled={isPending}
              data-testid="weekplanner-plan-delete-confirm"
            >
              {isPending ? "Lösche…" : "Plan endgültig löschen"}
            </Button>
          </>
        }
      />
    </div>
  );
}

function PlanSwitcherRow({
  plan,
  selected,
  canManage,
  onSelect,
  onDelete,
  onOverflowToggle,
  overflowOpen,
}: {
  plan: WochenplanPlanDto;
  selected: boolean;
  canManage: boolean;
  onSelect: () => void;
  onDelete: () => void;
  onOverflowToggle: (open: boolean) => void;
  overflowOpen: boolean;
}) {
  const localOverflowRef = useRef<HTMLButtonElement>(null);
  const showOverflow = canManage && !plan.isActive && !plan.isDefault;

  return (
    <div className="flex items-center gap-1 rounded-md px-1 py-0.5 hover:bg-[var(--surface-2)]">
      <button
        type="button"
        role="option"
        aria-selected={selected}
        data-testid={`weekplanner-plan-option-${plan.id}`}
        onClick={onSelect}
        className="flex min-w-0 flex-1 items-center gap-2 rounded-md px-2 py-2 text-left text-sm"
      >
        {selected ? <Check className="h-3.5 w-3.5 shrink-0 text-[var(--sce-primary)]" /> : <span className="w-3.5" />}
        <span className="min-w-0 flex-1 truncate font-medium">{plan.name}</span>
        <PlanStatusBadge isActive={plan.isActive} />
      </button>

      {showOverflow ? (
        <>
          <button
            ref={localOverflowRef}
            type="button"
            aria-label={`Aktionen für ${plan.name}`}
            data-testid={`weekplanner-plan-overflow-${plan.id}`}
            onClick={(e) => {
              e.stopPropagation();
              onOverflowToggle(!overflowOpen);
            }}
            className="rounded-md p-1.5 text-[var(--muted)] transition hover:bg-white hover:text-[var(--foreground)]"
          >
            <MoreHorizontal className="h-4 w-4" />
          </button>
          <PopoverContent
            open={overflowOpen}
            onOpenChange={onOverflowToggle}
            anchorRef={localOverflowRef}
            matchAnchorWidth={false}
            maxHeight={120}
            className="min-w-[12rem] p-1"
          >
            <button
              type="button"
              onClick={onDelete}
              data-testid={`weekplanner-plan-delete-${plan.id}`}
              className="flex w-full items-center gap-2 rounded-md px-2 py-2 text-left text-sm text-rose-700 transition hover:bg-rose-50"
            >
              <Trash2 className="h-4 w-4" />
              Plan endgültig löschen
            </button>
          </PopoverContent>
        </>
      ) : null}
    </div>
  );
}

export { buildWeekplannerHref };
