/**
 * Tenant-Aware Season Boundary Helpers — Slice 10.3
 *
 * Provides season boundary calculations that use the tenant's config
 * (seasonTransitionMonth / seasonTransitionDay) instead of the hardcoded
 * SWISS_FOOTBALL_SEASON_START_MONTH_INDEX constant in season-logic.ts.
 *
 * Design principles:
 * - Tenant config uses 1-based month numbers (1 = January … 12 = December).
 * - The existing Swiss football constants in season-logic.ts use 0-based indices
 *   (6 = July). The canonical Swiss football season boundary is July 1.
 * - The existing season-logic.ts functions are NOT removed or modified — they
 *   remain the implementation for the season planner, season admin, and team
 *   assignment logic that does not yet carry a TenantContext.
 * - These helpers bridge tenant config into the season boundary calculation.
 *   When tenant config values equal the fc-allschwil defaults (8/1/8), the
 *   results are identical to the Swiss football functions.
 *
 * Relationship to season-logic.ts:
 *   getSeasonStartYearFromDate(date, ctx)
 *     ≡ getSwissFootballSeasonStartYearFromDate(date)   [when ctx has defaults]
 *
 *   getSeasonTransitionDateForYear(year, ctx)
 *     ≡ getSwissFootballSeasonDateRangeFromStartYear(year).startDate [same defaults]
 */

import type { TenantContext } from "@/lib/tenants/context";

type SeasonCtx = Pick<
  TenantContext,
  "seasonStartMonth" | "seasonTransitionDay" | "seasonTransitionMonth"
>;

// ── Core boundary calculation ─────────────────────────────────────────────────

/**
 * Returns the exact UTC Date when the new season officially starts for the
 * given start year. Uses the tenant's seasonTransitionMonth and
 * seasonTransitionDay fields.
 *
 * @example
 *   getSeasonTransitionDateForYear(2026, ctx)
 *   // → Date: 2026-08-01T00:00:00.000Z  (when ctx = defaults)
 */
export function getSeasonTransitionDateForYear(
  startYear: number,
  ctx: SeasonCtx,
): Date {
  return new Date(
    Date.UTC(startYear, ctx.seasonTransitionMonth - 1, ctx.seasonTransitionDay),
  );
}

/**
 * Determines which season start year a date belongs to, using the tenant's
 * transition month and day.
 *
 * Logic: if date ≥ transition point → belongs to this year's season.
 *        if date < transition point → belongs to last year's season.
 *
 * @example
 *   getSeasonStartYearFromDate("2026-07-15", ctx)  // 2025  (before Aug 1)
 *   getSeasonStartYearFromDate("2026-08-01", ctx)  // 2026  (on the transition)
 *   getSeasonStartYearFromDate("2026-09-01", ctx)  // 2026  (after transition)
 */
export function getSeasonStartYearFromDate(
  date: Date | string,
  ctx: SeasonCtx,
): number {
  const d = typeof date === "string" ? new Date(date) : date;
  const year = d.getUTCFullYear();
  const month = d.getUTCMonth() + 1; // convert to 1-based
  const day = d.getUTCDate();

  const tm = ctx.seasonTransitionMonth; // 1-based
  const td = ctx.seasonTransitionDay;

  if (month > tm || (month === tm && day >= td)) {
    return year;
  }
  return year - 1;
}

/**
 * Returns the season start year for "now", using the tenant's transition config.
 * Equivalent to getCurrentSwissFootballSeason().startYear with tenant config.
 */
export function getCurrentSeasonStartYear(
  ctx: SeasonCtx,
  now: Date | string = new Date(),
): number {
  return getSeasonStartYearFromDate(now, ctx);
}

/**
 * Returns the current season's date range (startDate … endDate) using the
 * tenant's transition config and seasonStartMonth.
 *
 * startDate: the transition point for the current season year
 * endDate:   the day before the next season's transition point
 */
export function getCurrentSeasonDateRange(
  ctx: SeasonCtx,
  now: Date | string = new Date(),
): { startYear: number; endYear: number; startDate: Date; endDate: Date } {
  const startYear = getCurrentSeasonStartYear(ctx, now);
  const endYear = startYear + 1;
  const startDate = getSeasonTransitionDateForYear(startYear, ctx);
  // endDate: day before next transition (subtract 1 day from the next transition)
  const nextTransition = getSeasonTransitionDateForYear(endYear, ctx);
  const endDate = new Date(nextTransition.getTime() - 24 * 60 * 60 * 1000);
  return { startYear, endYear, startDate, endDate };
}

/**
 * Returns a formatted season label like "2025/2026".
 */
export function getSeasonLabel(startYear: number): string {
  return `${startYear}/${startYear + 1}`;
}

/**
 * Returns the current season label (e.g. "2025/2026") using tenant config.
 */
export function getCurrentSeasonLabel(
  ctx: SeasonCtx,
  now: Date | string = new Date(),
): string {
  return getSeasonLabel(getCurrentSeasonStartYear(ctx, now));
}
