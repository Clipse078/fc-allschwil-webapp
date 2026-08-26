/**
 * lib/publishing/infoboard/screen1-capacity-admission.ts
 *
 * Deterministic capacity-aware admission for Screen 1 display items.
 *
 * Separates two concerns:
 *   capacity  — how many complete cohort cards appear on the board
 *   density   — how rows fit inside one admitted block (handled per-card in UI)
 *
 * Priority (INFOBOARD-REGRESSION-01F):
 *   1. Events currently active ("current" temporal bucket)
 *   2. Next upcoming time block ("next")
 *   3. Additional future blocks ordered by start time ("later")
 *   4. Admit another complete block only when total demand fits within maxCapacity
 *
 * Under capacity pressure, post-event grace items lose priority before
 * current or imminent events (lifecyclePriority).
 *
 * Uses the same demand model as InfoboardScreen1 (CARD_DEMAND_PAGE_MAX).
 * No browser measurements — pure semantic demand scores.
 */

export type Screen1TemporalBucket = "current" | "next" | "later";

export const SCREEN1_CAPACITY_MAX = 12.0;

export type Screen1AdmissionPriority = 0 | 1 | 2 | 3;

/**
 * Lower number = higher admission priority.
 * Post-event grace items are deprioritized under capacity pressure.
 */
export function lifecycleAdmissionPriority(
  lifecyclePhase: "current" | "pre-event" | "post-event-grace" | "upcoming-same-day",
): Screen1AdmissionPriority {
  if (lifecyclePhase === "current") return 0;
  if (lifecyclePhase === "pre-event") return 1;
  if (lifecyclePhase === "upcoming-same-day") return 2;
  return 3;
}

export type AdmitDisplayItemInput<T> = {
  readonly item: T;
  readonly demand: number;
  readonly temporal: Screen1TemporalBucket;
  readonly lifecyclePriority?: Screen1AdmissionPriority;
};

/**
 * Admits display items respecting Screen 1 physical capacity.
 *
 * Current and next buckets are always admitted (never drop more-relevant
 * content). Later items are admitted only when cumulative demand stays
 * within `maxCapacity`, preferring lower lifecyclePriority values first.
 *
 * Preserves deterministic chronological ordering within the same priority tier.
 */
export function admitDisplayItemsByCapacity<T>(
  items: readonly T[],
  demands: readonly number[],
  getTemporal: (item: T) => Screen1TemporalBucket,
  maxCapacity: number = SCREEN1_CAPACITY_MAX,
  getLifecyclePriority?: (item: T) => Screen1AdmissionPriority,
): T[] {
  if (items.length === 0) return [];

  const entries: AdmitDisplayItemInput<T>[] = items.map((item, index) => ({
    item,
    demand: demands[index] ?? 1.0,
    temporal: getTemporal(item),
    lifecyclePriority: getLifecyclePriority?.(item) ?? 1,
  }));

  const current = entries.filter((entry) => entry.temporal === "current");
  const next = entries.filter((entry) => entry.temporal === "next");
  const later = entries.filter((entry) => entry.temporal === "later");

  const admitted: T[] = [];
  let totalDemand = 0;

  for (const entry of current) {
    admitted.push(entry.item);
    totalDemand += entry.demand;
  }

  for (const entry of next) {
    admitted.push(entry.item);
    totalDemand += entry.demand;
  }

  const laterSorted = [...later].sort((a, b) => {
    const priorityDelta =
      (a.lifecyclePriority ?? 1) - (b.lifecyclePriority ?? 1);
    if (priorityDelta !== 0) return priorityDelta;
    return 0;
  });

  for (const entry of laterSorted) {
    if (totalDemand + entry.demand <= maxCapacity) {
      admitted.push(entry.item);
      totalDemand += entry.demand;
    }
  }

  return admitted;
}

/**
 * Estimates whether additional same-day cohorts should be supplied to the feed
 * when the rolling horizon is sparse but viewport capacity remains.
 *
 * Returns the number of additional complete display-item slots worth targeting
 * beyond the items already in the feed window.
 */
export function estimateSparseDayFillTarget(
  admittedDemand: number,
  maxCapacity: number = SCREEN1_CAPACITY_MAX,
): number {
  if (admittedDemand >= maxCapacity) return 0;
  const remainingDemand = maxCapacity - admittedDemand;
  if (remainingDemand < 1.5) return 0;
  return Math.max(0, Math.floor(remainingDemand / 2.0));
}
