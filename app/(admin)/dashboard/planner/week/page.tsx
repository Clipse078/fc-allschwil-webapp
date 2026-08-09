import { notFound } from "next/navigation";
import { requireAnyPermission } from "@/lib/permissions/require-any-permission";
import { PERMISSIONS } from "@/lib/permissions/permissions";
import { getActiveTenant } from "@/lib/tenants/active-tenant";
import { resolveTrainingWeekWindow, TRAINING_DEFAULT_TIMEZONE } from "@/lib/training/date-range";
import { getWeekplannerWeek } from "@/lib/weekplanner/queries";
import WeekPlannerPage from "@/components/admin/planner/WeekPlannerPage";

type PlannerWeekPageProps = {
  searchParams?: Promise<{
    week?: string;
  }>;
};

/**
 * WEEKPLANNER-01A — canonical Weekplanner foundation.
 *
 * Reuses the existing /dashboard/planner/week route (the only pre-existing
 * Weekplanner surface) rather than introducing a duplicate — evolved from a
 * season-scoped generic-Event listing into a read-only aggregation of the
 * three canonical planning inputs (TrainingSession, HOME Event(MATCH),
 * HOME Event(TOURNAMENT)). See lib/weekplanner/queries.ts.
 *
 * Permission: reuses the exact permission set already gating the "Planung"
 * sidebar section (TrainingCenter + TournamentCenter + Veranstaltungen) —
 * Weekplanner has no permission contract of its own to invent, and its
 * three inputs are already governed by these VIEW permissions.
 */
export default async function PlannerWeekPageRoute({
  searchParams,
}: PlannerWeekPageProps) {
  await requireAnyPermission([
    PERMISSIONS.TRAININGS_VIEW,
    PERMISSIONS.TRAININGS_MANAGE,
    PERMISSIONS.EVENTS_VIEW,
    PERMISSIONS.EVENTS_MANAGE,
  ]);

  const tenantContext = await getActiveTenant();
  if (!tenantContext) notFound();

  const timezone = tenantContext.timezone ?? TRAINING_DEFAULT_TIMEZONE;
  const params = (await searchParams) ?? {};

  const now = new Date();
  const weekWindow = resolveTrainingWeekWindow({ weekParam: params.week, now, timeZone: timezone });
  const todayParam = resolveTrainingWeekWindow({ now, timeZone: timezone }).param;

  const week = await getWeekplannerWeek(tenantContext.id, {
    from: weekWindow.from,
    to: weekWindow.to,
    days: weekWindow.days,
    param: weekWindow.param,
    previousParam: weekWindow.previousParam,
    nextParam: weekWindow.nextParam,
  });

  return (
    <WeekPlannerPage
      week={week}
      todayParam={todayParam}
      locale={tenantContext.locale ?? "de-CH"}
      timezone={timezone}
    />
  );
}
