"use client";

/**
 * components/admin/planner/WeekplannerPlanBar.tsx
 *
 * WEEKPLANNER-01B/E + WOCHENPLAN-2.0-01F — unified Wochenplan selector for the
 * operational week planner. Administrators see one concept ("Wochenplan") with
 * named variants from tenant-level WochenplanPlan definitions.
 *
 * Selecting a non-default variant triggers server-side materialization of the
 * linked WeekplannerPlan for the requested week (via ?plan=<wochenplanPlanId>).
 *
 * View vs public vs operational state:
 *   - VIEW: which WochenplanPlan variant is selected for editing (?plan=)
 *   - PUBLIC: WochenplanPlan.isActive (öffentlicher Plan)
 *   - OPERATIONAL: WeekplannerPlan.isActive (Betriebsplan for this week)
 */

import { useCallback, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { Loader2, Plus, Power, PowerOff } from "lucide-react";
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

export function WeekplannerPlanBar({
  weekParam,
  wochenplanPlans,
  weekplannerPlans,
  selectedPlanParam,
  materializedWeekplannerPlanId,
  canManage,
}: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const [isCreateDialogOpen, setIsCreateDialogOpen] = useState(false);

  const defaultPlan = wochenplanPlans.find((p) => p.isDefault) ?? wochenplanPlans[0] ?? null;
  const selectedValue = selectedPlanParam ?? defaultPlan?.id ?? "";
  const viewedPlan =
    wochenplanPlans.find((p) => p.id === selectedValue) ??
    (selectedValue
      ? weekplannerPlans.find((p) => p.id === selectedValue) ?? null
      : defaultPlan);
  const publicPlan = wochenplanPlans.find((p) => p.isActive) ?? null;
  const operationalPlan = weekplannerPlans.find((p) => p.isActive) ?? null;
  const materializedPlan = materializedWeekplannerPlanId
    ? weekplannerPlans.find((p) => p.id === materializedWeekplannerPlanId) ?? null
    : null;

  const legacyAdHocPlans = weekplannerPlans.filter((p) => !p.wochenplanPlanId);

  const handleSelect = useCallback(
    (value: string) => {
      router.push(buildWeekplannerHref(weekParam, value || null));
    },
    [router, weekParam],
  );

  const handleActivateOperational = useCallback(() => {
    if (!materializedPlan) return;
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/weekplanner/plans/${materializedPlan.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ active: true }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error((data as { error?: string }).error ?? `Fehler: HTTP ${res.status}`);
        }
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Fehler beim Aktivieren");
      }
    });
  }, [materializedPlan, router]);

  const handleDeactivateOperational = useCallback(() => {
    if (!materializedPlan) return;
    setError(null);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/weekplanner/plans/${materializedPlan.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ active: false }),
        });
        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          throw new Error((data as { error?: string }).error ?? `Fehler: HTTP ${res.status}`);
        }
        router.refresh();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Fehler beim Deaktivieren");
      }
    });
  }, [materializedPlan, router]);

  if (wochenplanPlans.length === 0) return null;

  const viewingAlternative =
    viewedPlan &&
    ("isDefault" in viewedPlan ? !viewedPlan.isDefault : true);

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
          className="rounded-lg border border-[var(--border)] bg-white px-3 py-1.5 text-sm font-medium text-[var(--foreground)] focus:border-[var(--sce-primary)] focus:outline-none"
        >
          {wochenplanPlans.map((plan) => (
            <option key={plan.id} value={plan.id}>
              {plan.name}
              {plan.isActive ? " (öffentlich)" : ""}
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

        {canManage && viewingAlternative && materializedPlan ? (
          materializedPlan.isActive ? (
            <button
              type="button"
              onClick={() => startTransition(handleDeactivateOperational)}
              disabled={isPending}
              data-testid="weekplanner-plan-deactivate-button"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-2)] transition hover:bg-[var(--surface-2)] disabled:opacity-50"
            >
              {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <PowerOff className="h-3 w-3" />}
              Betriebsplan deaktivieren
            </button>
          ) : (
            <button
              type="button"
              onClick={() => startTransition(handleActivateOperational)}
              disabled={isPending}
              data-testid="weekplanner-plan-activate-button"
              className="inline-flex items-center gap-1.5 rounded-lg border border-[var(--border)] px-2.5 py-1.5 text-xs font-medium text-[var(--text-2)] transition hover:bg-[var(--surface-2)] disabled:opacity-50"
            >
              {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Power className="h-3 w-3" />}
              Als Betriebsplan aktivieren
            </button>
          )
        ) : null}
      </div>

      {error && (
        <p className="text-xs text-rose-600" role="alert" data-testid="weekplanner-plan-bar-error">
          {error}
        </p>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <div
          className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700"
          data-testid="weekplanner-public-plan-banner"
        >
          Öffentlicher Plan · {publicPlan?.name ?? "—"}
        </div>
        <div
          className="inline-flex items-center gap-1.5 rounded-full border border-emerald-200 bg-emerald-50 px-3 py-1 text-xs font-semibold text-emerald-700"
          data-testid="weekplanner-operational-plan-banner"
        >
          Betriebsplan · {operationalPlan ? operationalPlan.name : "Standardplan"}
        </div>
        {viewedPlan && publicPlan && ("id" in viewedPlan ? viewedPlan.id !== publicPlan.id : true) ? (
          <div
            className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-700"
            data-testid="weekplanner-viewed-plan-banner"
          >
            Ansicht · {viewedPlan.name}
          </div>
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
    </div>
  );
}
