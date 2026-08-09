"use client";

/**
 * components/admin/planner/DayPlannerPlanSelect.tsx
 *
 * DAYPLANNER-01A — the compact "[Standardplan ▼]" plan variant selector for
 * the Day Planning header (product spec's premium day header layout).
 *
 * Reuses the EXACT same WeekplannerPlan architecture as
 * WeekplannerPlanBar.tsx (same plans list, same "" = Standardplan
 * sentinel) — just a leaner, day-header-sized control with no inline
 * create/rename/archive/delete affordances. Full plan lifecycle management
 * stays on Wochenplanner (linked below) to avoid a second plan-management
 * UI; Day Planning only ever *selects* an existing plan and (per
 * DAYPLANNER-01A scope) edits its overrides.
 */

import Link from "next/link";
import { useCallback } from "react";
import { useRouter } from "next/navigation";
import type { WeekplannerPlanDto } from "@/lib/weekplanner/plan-types";

const STANDARDPLAN_VALUE = "";

type Props = {
  dayParam: string;
  weekParam: string;
  plans: WeekplannerPlanDto[];
  activePlanId: string | null;
};

function buildDayHref(dayParam: string, planId: string | null): string {
  const params = new URLSearchParams({ day: dayParam });
  if (planId) params.set("plan", planId);
  return `/dashboard/planner/day?${params.toString()}`;
}

export function DayPlannerPlanSelect({ dayParam, weekParam, plans, activePlanId }: Props) {
  const router = useRouter();

  const handleSelect = useCallback(
    (value: string) => {
      router.push(buildDayHref(dayParam, value || null));
    },
    [router, dayParam],
  );

  return (
    <div className="flex flex-wrap items-center gap-2" data-testid="dayplanner-plan-bar">
      <select
        id="dayplanner-plan-select"
        data-testid="dayplanner-plan-select"
        value={activePlanId ?? STANDARDPLAN_VALUE}
        onChange={(e) => handleSelect(e.target.value)}
        className="h-9 rounded-lg border border-[var(--border)] bg-white px-3 text-sm font-medium text-[var(--foreground)] focus:border-[var(--sce-primary)] focus:outline-none"
      >
        <option value={STANDARDPLAN_VALUE}>Standardplan</option>
        {plans.map((plan) => (
          <option key={plan.id} value={plan.id}>
            {plan.name}
          </option>
        ))}
      </select>

      {plans.length === 0 && (
        <Link
          href={`/dashboard/planner/week?week=${encodeURIComponent(weekParam)}`}
          className="text-xs font-medium text-[var(--sce-primary)] hover:underline"
          data-testid="dayplanner-manage-plans-link"
        >
          Alternativplan im Wochenplanner erstellen
        </Link>
      )}
    </div>
  );
}
