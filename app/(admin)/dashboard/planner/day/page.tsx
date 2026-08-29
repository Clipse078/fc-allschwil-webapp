import { notFound } from "next/navigation";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { hasPermission } from "@/lib/permissions/has-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getActiveTenant } from "@/lib/tenants/active-tenant";
import { resolveTrainingDayWindow, resolveTrainingWeekWindow, TRAINING_DEFAULT_TIMEZONE } from "@/lib/training/date-range";
import { getWeekplannerDay } from "@/lib/weekplanner/queries";
import { planOverrideKey } from "@/lib/weekplanner/plan-override-key";
import { listWeekplannerPlans, listWeekplannerPlanAllocations } from "@/lib/weekplanner/plan-service";
import { getFacilitiesForTenant } from "@/lib/facilities/queries";
import { classifyFacilityResourceType } from "@/lib/training/allocation-groups";
import DayPlannerPage from "@/components/admin/planner/DayPlannerPage";
import type { WeekplannerOverrideRow } from "@/components/admin/planner/WeekplannerAllocationOverrideEditor";
import type { FacilityGroup } from "@/components/admin/training/FacilityResourceSelector";

type PlannerDayPageProps = {
  searchParams?: Promise<{
    /** "YYYY-MM-DD" Europe/Zurich calendar date. */
    day?: string;
    /** DAYPLANNER-01A — selected WeekplannerPlan id. Absent/invalid = Standardplan. */
    plan?: string;
  }>;
};

/**
 * DAYPLANNER-01A — Canonical Day Planning Foundation.
 *
 * Evolves the pre-existing /dashboard/planner/day route (previously backed
 * by the legacy season-scoped generic-Event lib/planner/queries.ts) into a
 * ONE-DAY operational projection of the SAME canonical + effective planning
 * state Wochenplanner already resolves — see
 * lib/weekplanner/queries.ts#getWeekplannerDay's doc comment. No new
 * planning engine, no new database model.
 *
 * Permission + plan-selection contract intentionally mirrors
 * app/(admin)/dashboard/planner/week/page.tsx byte-for-byte: WeekplannerPlan
 * is week-scoped, so this resolves the Monday-week containing the selected
 * day (via the already-tested resolveTrainingWeekWindow) purely to look up
 * that week's plans — the SAME plans Wochenplanner offers for that week.
 */
export default async function PlannerDayPageRoute({ searchParams }: PlannerDayPageProps) {
  const session = await requireAnyPermission([
    PERMISSIONS.TRAININGS_VIEW,
    PERMISSIONS.TRAININGS_MANAGE,
    PERMISSIONS.EVENTS_VIEW,
    PERMISSIONS.EVENTS_MANAGE,
  ]);

  const tenantContext = await getActiveTenant();
  if (!tenantContext) notFound();

  const canManagePlans =
    hasPermission(session, PERMISSIONS.TRAININGS_MANAGE) || hasPermission(session, PERMISSIONS.EVENTS_MANAGE);

  const timezone = tenantContext.timezone ?? TRAINING_DEFAULT_TIMEZONE;
  const params = (await searchParams) ?? {};

  const now = new Date();
  const dayWindow = resolveTrainingDayWindow({ dayParam: params.day, now, timeZone: timezone });
  const todayParam = resolveTrainingDayWindow({ now, timeZone: timezone }).param;
  const weekWindow = resolveTrainingWeekWindow({ weekParam: dayWindow.date, now, timeZone: timezone });

  const plans = await listWeekplannerPlans(tenantContext.id, weekWindow.param);
  const requestedPlanId = params.plan?.trim();
  const activePlan = requestedPlanId ? plans.find((plan) => plan.id === requestedPlanId) ?? null : null;

  const day = await getWeekplannerDay(
    tenantContext.id,
    {
      from: dayWindow.from,
      to: dayWindow.to,
      date: dayWindow.date,
      param: dayWindow.param,
      previousParam: dayWindow.previousParam,
      nextParam: dayWindow.nextParam,
    },
    activePlan?.id,
  );

  // DAYPLANNER-01A — override editing is only ever built when an
  // alternative plan is selected AND the caller can manage plans, mirroring
  // Wochenplanner exactly — the Standardplan view and read-only viewers
  // never see editing affordances (VIEW vs. MANAGE contract).
  const overrideEditing =
    canManagePlans && activePlan
      ? {
          planId: activePlan.id,
          planName: activePlan.name,
          overridesByKey: await buildOverridesByKey(tenantContext.id, activePlan.id),
          facilityGroupsByAllocationGroup: await buildFacilityGroupsByAllocationGroup(tenantContext.id),
        }
      : undefined;

  return (
    <DayPlannerPage
      day={day}
      dayParam={dayWindow.param}
      previousParam={dayWindow.previousParam}
      nextParam={dayWindow.nextParam}
      todayParam={todayParam}
      weekParam={weekWindow.param}
      locale={tenantContext.locale ?? "de-CH"}
      timezone={timezone}
      plans={plans}
      activePlanId={activePlan?.id ?? null}
      canManagePlans={canManagePlans}
      overrideEditing={overrideEditing}
    />
  );
}

async function buildOverridesByKey(
  tenantId: string,
  planId: string,
): Promise<Record<string, WeekplannerOverrideRow[]>> {
  const allocations = await listWeekplannerPlanAllocations(tenantId, planId);
  const byKey: Record<string, WeekplannerOverrideRow[]> = {};

  for (const allocation of allocations) {
    const key = planOverrideKey(
      allocation.activityType,
      allocation.activityId,
      allocation.allocationGroup,
      allocation.participantId,
    );
    const list = byKey[key] ?? [];
    list.push({
      id: allocation.id,
      facilityResourceId: allocation.facilityResourceId,
      facilityResourceName: allocation.facilityResourceName,
      facilityResourceCode: allocation.facilityResourceCode,
      occupancyBeforeMinutes: allocation.occupancyBeforeMinutes,
      occupancyAfterMinutes: allocation.occupancyAfterMinutes,
    });
    byKey[key] = list;
  }

  return byKey;
}

async function buildFacilityGroupsByAllocationGroup(
  tenantId: string,
): Promise<{ PITCH_HALL: FacilityGroup[]; DRESSING_ROOM: FacilityGroup[] }> {
  const facilities = await getFacilitiesForTenant(tenantId);

  function groupsFor(group: "PITCH_HALL" | "DRESSING_ROOM"): FacilityGroup[] {
    return facilities
      .map((facility) => ({
        facilityId: facility.id,
        facilityName: facility.name,
        resources: facility.resources
          .filter((resource) => classifyFacilityResourceType(resource.type) === group)
          .map((resource) => ({
            id: resource.id,
            name: resource.name,
            code: resource.code,
            type: resource.type,
            facilityId: facility.id,
            facilityName: facility.name,
          })),
      }))
      .filter((facilityGroup) => facilityGroup.resources.length > 0);
  }

  return { PITCH_HALL: groupsFor("PITCH_HALL"), DRESSING_ROOM: groupsFor("DRESSING_ROOM") };
}
