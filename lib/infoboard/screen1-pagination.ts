/**
 * Screen-1 pagination with soft page preferences and mandatory forward compaction.
 *
 * Manual page preferences are inputs to pagination, not persisted page results.
 * Every recompute applies preferences then compacts cards forward when capacity
 * allows — expired earlier cards therefore pull later cards back automatically.
 *
 * Soft breaks capture predecessor identity at preference creation time via
 * `softBreakAfterKeys`. When the active predecessor context no longer matches,
 * the preference no longer forces a break and normal forward packing applies.
 */

import { resolveDisplayItemKey } from "./screen1-studio-keys";
import type { Screen1CardOverride, Screen1StudioConfig } from "./screen1-studio-types";

/** Minimal display item shape for pagination (matches InfoboardScreen1 DisplayItem). */
export type PaginableDisplayItem =
  | { kind: "event"; item: { event: { id: string; startAt: string; type: string } } }
  | {
      kind: "training-group";
      items: { event: { id: string; startAt: string } }[];
      cohortContinuation?: boolean;
    };

export type PaginationOptions = {
  readonly maxDemand: number;
  readonly studio?: Screen1StudioConfig | null;
};

type DisplayItemLike = Parameters<typeof resolveDisplayItemKey>[0];

function resolveItemKey(item: PaginableDisplayItem): string {
  return resolveDisplayItemKey(item as DisplayItemLike);
}

/** Resolves stable keys for all items preceding `index` in the active list. */
export function resolvePredecessorKeys(
  items: readonly PaginableDisplayItem[],
  index: number,
): string[] {
  return items.slice(0, index).map(resolveItemKey);
}

function keysEqual(left: readonly string[], right: readonly string[]): boolean {
  if (left.length !== right.length) return false;
  return left.every((key, index) => key === right[index]);
}

/**
 * Returns true when a card override's captured predecessor context still matches
 * the current active list at `index`.
 */
export function softBreakContextMatches(
  override: Screen1CardOverride | undefined,
  predecessorKeys: readonly string[],
): boolean {
  if (override?.preferNextPage !== true) return false;
  const captured = override.softBreakAfterKeys;
  if (captured == null || captured.length === 0) return false;
  return keysEqual(captured, predecessorKeys);
}

function getCardOverride(
  item: PaginableDisplayItem,
  studio: Screen1StudioConfig | null | undefined,
): Screen1CardOverride | undefined {
  if (studio == null) return undefined;
  return studio.cardOverrides[resolveItemKey(item)];
}

/**
 * Returns true when the card should start on the next page because its captured
 * soft-break context still matches the current active predecessors.
 */
export function shouldSoftDeferCard(
  item: PaginableDisplayItem,
  index: number,
  items: readonly PaginableDisplayItem[],
  studio: Screen1StudioConfig | null | undefined,
): boolean {
  const predecessorKeys = resolvePredecessorKeys(items, index);
  return softBreakContextMatches(getCardOverride(item, studio), predecessorKeys);
}

function prefersNextPage(
  item: PaginableDisplayItem,
  index: number,
  items: readonly PaginableDisplayItem[],
  studio: Screen1StudioConfig | null | undefined,
): boolean {
  return shouldSoftDeferCard(item, index, items, studio);
}

/**
 * Pulls cards from the start of page N+1 onto page N when capacity allows.
 * Preserves chronological order. Capacity always wins.
 *
 * Cards with an active soft-break context are not pulled forward — they only
 * move when the predecessor context no longer matches (auto-compaction).
 */
export function compactPagesForward<T extends PaginableDisplayItem>(
  pages: T[][],
  getDemand: (item: T) => number,
  maxDemand: number,
  allItems: readonly T[],
  studio?: Screen1StudioConfig | null,
): T[][] {
  if (pages.length <= 1) return pages;

  const result = pages.map((page) => [...page]);

  function pageDemand(page: T[]): number {
    return page.reduce((sum, item) => sum + getDemand(item), 0);
  }

  function globalIndex(item: T): number {
    return allItems.indexOf(item);
  }

  for (let pageIdx = 0; pageIdx < result.length - 1; pageIdx++) {
    while (result[pageIdx + 1]?.length) {
      const nextItem = result[pageIdx + 1]![0]!;
      const nextIndex = globalIndex(nextItem);
      if (
        nextIndex >= 0 &&
        prefersNextPage(nextItem, nextIndex, allItems, studio)
      ) {
        break;
      }
      const nextDemand = getDemand(nextItem);
      if (pageDemand(result[pageIdx]!) + nextDemand <= maxDemand) {
        result[pageIdx]!.push(result[pageIdx + 1]!.shift()!);
        if (result[pageIdx + 1]!.length === 0) {
          result.splice(pageIdx + 1, 1);
        }
      } else {
        break;
      }
    }
  }

  return result.filter((page) => page.length > 0);
}

/**
 * Greedy demand pagination with optional soft prefer-next-page hints.
 * Never splits a card. Applies forward compaction after preference pass.
 *
 * Callers must pre-expand oversized training cohorts before invoking.
 */
export function paginateExpandedDisplayListWithPreferences<T extends PaginableDisplayItem>(
  expandedItems: readonly T[],
  expandedDemands: readonly number[],
  options: PaginationOptions,
): T[][] {
  const { maxDemand, studio } = options;
  if (expandedItems.length === 0) return [];

  const pages: T[][] = [];
  let currentPage: T[] = [];
  let currentDemand = 0;

  for (let i = 0; i < expandedItems.length; i++) {
    const item = expandedItems[i]!;
    const d = expandedDemands[i] ?? 1;

    const mustBreak = currentPage.length > 0 && currentDemand + d > maxDemand;
    const softDefer =
      !mustBreak &&
      shouldSoftDeferCard(item, i, expandedItems, studio) &&
      currentDemand + d <= maxDemand;

    if (mustBreak || softDefer) {
      pages.push(currentPage);
      currentPage = [item];
      currentDemand = d;
    } else {
      currentPage.push(item);
      currentDemand += d;
    }
  }

  if (currentPage.length > 0) pages.push(currentPage);

  return compactPagesForward(
    pages,
    (item) => {
      const idx = expandedItems.indexOf(item);
      return expandedDemands[idx] ?? 1;
    },
    maxDemand,
    expandedItems,
    studio,
  );
}

/**
 * Validates pagination output: no duplicates, no missing items, chronological order.
 */
export function validatePaginationIntegrity(
  inputItems: readonly PaginableDisplayItem[],
  pages: readonly (readonly PaginableDisplayItem[])[],
): { ok: boolean; duplicates: number; missing: number; orderValid: boolean } {
  const inputKeys = inputItems.map(
    (item) => resolveDisplayItemKey(item as DisplayItemLike),
  );
  const outputKeys: string[] = [];

  for (const page of pages) {
    for (const item of page) {
      outputKeys.push(resolveDisplayItemKey(item as DisplayItemLike));
    }
  }

  const inputSet = new Set(inputKeys);
  const outputSet = new Set(outputKeys);
  const missing = [...inputSet].filter((k) => !outputSet.has(k)).length;
  const duplicates = outputKeys.length - outputSet.size;
  const orderValid = inputKeys.every((key, idx) => outputKeys[idx] === key);

  return { ok: missing === 0 && duplicates === 0 && orderValid, duplicates, missing, orderValid };
}
