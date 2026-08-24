/**
 * lib/publishing/infoboard/screen1-capacity-admission.ts
 *
 * Deterministic capacity-aware admission for Screen 1 display items.
 *
 * Separates two concerns:
 *   capacity  — how many event blocks appear on the board
 *   density   — how rows fit inside one admitted block (handled per-card in UI)
 *
 * Priority (task INFOBOARD-SCREEN1-URGENT-07C):
 *   1. Events currently active ("current" temporal bucket)
 *   2. Next upcoming time block ("next")
 *   3. Additional future blocks ordered by start time ("later")
 *   4. Admit another block only when total demand fits within maxCapacity
 *
 * Uses the same demand model as InfoboardScreen1 (CARD_DEMAND_PAGE_MAX).
 * No browser measurements — pure semantic demand scores.
 */

export type Screen1TemporalBucket = "current" | "next" | "later";

export const SCREEN1_CAPACITY_MAX = 12.0;

/**
 * Admits display items respecting Screen 1 physical capacity.
 *
 * Current and next buckets are always admitted (never drop more-relevant
 * content). Later items are admitted only when cumulative demand stays
 * within `maxCapacity`.
 *
 * Preserves original ordering within each priority tier.
 */
export function admitDisplayItemsByCapacity<T>(
  items: readonly T[],
  demands: readonly number[],
  getTemporal: (item: T) => Screen1TemporalBucket,
  maxCapacity: number = SCREEN1_CAPACITY_MAX,
): T[] {
  if (items.length === 0) return [];

  const current: { item: T; demand: number }[] = [];
  const next: { item: T; demand: number }[] = [];
  const later: { item: T; demand: number }[] = [];

  for (let i = 0; i < items.length; i++) {
    const entry = { item: items[i], demand: demands[i] ?? 1.0 };
    const temporal = getTemporal(items[i]);
    if (temporal === "current") current.push(entry);
    else if (temporal === "next") next.push(entry);
    else later.push(entry);
  }

  const admitted: T[] = [];
  let totalDemand = 0;

  for (const { item, demand } of current) {
    admitted.push(item);
    totalDemand += demand;
  }

  for (const { item, demand } of next) {
    admitted.push(item);
    totalDemand += demand;
  }

  for (const { item, demand } of later) {
    if (totalDemand + demand <= maxCapacity) {
      admitted.push(item);
      totalDemand += demand;
    }
  }

  return admitted;
}
