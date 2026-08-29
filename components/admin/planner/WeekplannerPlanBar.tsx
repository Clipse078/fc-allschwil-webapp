"use client";

/**
 * components/admin/planner/WeekplannerPlanBar.tsx
 *
 * WOCHENPLAN-2.0-01H-D — unified Wochenplan selector with single active plan
 * semantics. Viewing a plan is independent from activation.
 */

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Check, Loader2, Plus } from "lucide-react";
import { Dialog } from "@/components/ui/Dialog";
import { Button } from "@/components/ui/Button";
import type { WochenplanPlanDto } from "@/lib/wochenplan/plan-types";
import type { WeekplannerPlanDto } from "@/lib/weekplanner/plan-types";
import { WeekplannerPlanCreateDialog } from "./WeekplannerPlanCreateDialog";

type Props = {
  weekParam: string;
  wochenplanPlans: WochenplanPlanDto[];
  weekplannerPlans: WeekplannerPlanDto[];
  /** Current ?plan= query value — WochenplanPlan id or legacy WeekplannerPlan id. */
  selectedPlanParam: string | null;
  materializedWeekplannerPlanId: string | null;
  canManage: boolean;
};

function buildWeekplannerHref(weekParam: string, wochenplanPlanId: string | null): string {
  const params = new URLSearchParams({ week: weekParam });
  if (wochenplanPlanId) params.set("plan", wochenplanPlanId);
  return `/dashboard/planner/week?${params.toString()}`;
}

function formatPlanOptionLabel(plan: WochenplanPlanDto): string {
  const status = plan.isActive ? "Aktiv" : "Entwurf";
  return `${plan.name} — ${status}`;
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
  const [isActivateDialogOpen, setIsActivateDialogOpen] = useState(false);

  const defaultPlan = wochenplanPlans.find((p) => p.isDefault) ?? wochenplanPlans[0] ?? null;
  const selectedValue = selectedPlanParam ?? defaultPlan?.id ?? "";
  const viewedWochenplanPlan =
    wochenplanPlans.find((p) => p.id === selectedValue) ??
    (selectedValue
      ? null
      : defaultPlan);
  const viewedLegacyPlan =
    !viewedWochenplanPlan && selectedValue
      ? weekplannerPlans.find((p) => p.id === selectedValue) ?? null
      : null;
  const viewedPlan = viewedWochenplanPlan ?? viewedLegacyPlan;
  const activePlan = wochenplanPlans.find((p) => p.isActive) ?? null;
  const isViewingActive = viewedWochenplanPlan?.isActive ?? false;

  const legacyAdHocPlans = weekplannerPlans.filter((p) => !p.wochenplanPlanId);

  const handleSelect = useCallback(
    (value: string) => {
      router.push(buildWeekplannerHref(weekParam, value || null));
    },
    [router, weekParam],
  );

  const handleActivate = useCallback(() => {
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
        setIsActivateDialogOpen(false);
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Fehler beim Aktivieren");
      }
    });
  }, [viewedWochenplanPlan, router]);

  if (wochenplanPlans.length === 0) return null;

  return (
    <div className="space-y-2" data-testid="weekplanner-plan-bar">
      <div className="flex flex-wrap items-center gap-2">
        <label
          htmlFor="weekplanner-plan-select"
          className="text-xs font-semibold uppercase tracking-[0.14em] text-[var(--muted)]"
        >
          Wochenplan
        </label>

        <select
          id="weekplanner-plan-select"
          data-testid="weekplanner-plan-select"
          value={selectedValue}
          onChange={(e) => handleSelect(e.target.value)}
          className="min-w-[12rem] rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-sm font-medium text-[var(--foreground)] focus:border-[var(--sce-primary)] focus:outline-none"
        >
          {wochenplanPlans.map((plan) => (
            <option key={plan.id} value={plan.id}>
              {formatPlanOptionLabel(plan)}
            </option>
          ))}
          {legacyAdHocPlans.length > 0 ? (
            <optgroup label="Legacy-Wochenpläne">
              {legacyAdHocPlans.map((plan) => (
                <option key={plan.id} value={plan.id}>
                  {plan.name}
                </option>
              ))}
            </optgroup>
          ) : null}
        </select>

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

        {canManage && viewedWochenplanPlan && !isViewingActive ? (
          <button
            type="button"
            onClick={() => setIsActivateDialogOpen(true)}
            disabled={isPending}
            data-testid="weekplanner-plan-activate-button"
            className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-2)] transition hover:bg-[var(--surface-2)] disabled:opacity-50"
          >
            {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
            Als aktiven Plan verwenden
          </button>
        ) : null}
      </div>

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
                Aktuell aktiv: {activePlan.name}
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
        open={isActivateDialogOpen}
        onClose={() => setIsActivateDialogOpen(false)}
        title="Aktiven Wochenplan wechseln"
        description={
          viewedWochenplanPlan
            ? `${viewedWochenplanPlan.name} wird zum aktiven Wochenplan. Website und Infoboard verwenden danach diesen Plan.`
            : undefined
        }
        size="sm"
        footer={
          <>
            <Button variant="secondary" onClick={() => setIsActivateDialogOpen(false)}>
              Abbrechen
            </Button>
            <Button onClick={() => startTransition(handleActivate)} disabled={isPending}>
              {isPending ? "Aktiviere…" : "Aktivieren"}
            </Button>
          </>
        }
      />
    </div>
  );
}
