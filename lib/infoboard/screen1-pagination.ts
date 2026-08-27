/**
 * Screen-1 pagination with soft page preferences and mandatory forward compaction.
 *
 * Manual page preferences are inputs to pagination, not persisted page results.
 * Every recompute applies preferences then compacts cards forward when capacity
 * allows — expired earlier cards therefore pull later cards back automatically.
 */

import { resolveDisplayItemKey } from "./screen1-studio-keys";
import type { Screen1StudioConfig } from "./screen1-studio-types";

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

/** Minimum preceding cards required before a soft defer can apply. */
export const SCREEN1_SOFT_DEFER_MIN_PRECEDING_CARDS = 3;

function prefersNextPage(
  item: PaginableDisplayItem,
  studio: Screen1StudioConfig | null | undefined,
): boolean {
  if (studio == null) return false;
  const key = resolveDisplayItemKey(item as Parameters<typeof resolveDisplayItemKey>[0]);
  return studio.cardOverrides[key]?.preferNextPage === true;
}

/**
 * Pulls cards from the start of page N+1 onto page N when capacity allows.
 * Preserves chronological order. Capacity always wins.
 *
 * Cards with `preferNextPage` are not pulled forward — they only move when
 * the active list is recomputed without preceding cards (auto-compaction).
 */
export function compactPagesForward<T extends PaginableDisplayItem>(
  pages: T[][],
  getDemand: (item: T) => number,
  maxDemand: number,
  studio?: Screen1StudioConfig | null,
): T[][] {
  if (pages.length <= 1) return pages;

  const result = pages.map((page) => [...page]);

  function pageDemand(page: T[]): number {
    return page.reduce((sum, item) => sum + getDemand(item), 0);
  }

  for (let pageIdx = 0; pageIdx < result.length - 1; pageIdx++) {
    while (result[pageIdx + 1]?.length) {
      const nextItem = result[pageIdx + 1]![0]!;
      if (prefersNextPage(nextItem, studio)) {
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
      currentPage.length >= SCREEN1_SOFT_DEFER_MIN_PRECEDING_CARDS &&
      prefersNextPage(item, studio) &&
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
    (item) => resolveDisplayItemKey(item as Parameters<typeof resolveDisplayItemKey>[0]),
  );
  const outputKeys: string[] = [];

  for (const page of pages) {
    for (const item of page) {
      outputKeys.push(
        resolveDisplayItemKey(item as Parameters<typeof resolveDisplayItemKey>[0]),
      );
    }
  }

  const inputSet = new Set(inputKeys);
  const outputSet = new Set(outputKeys);
  const missing = [...inputSet].filter((k) => !outputSet.has(k)).length;
  const duplicates = outputKeys.length - outputSet.size;
  const orderValid = inputKeys.every((key, idx) => outputKeys[idx] === key);

  return { ok: missing === 0 && duplicates === 0 && orderValid, duplicates, missing, orderValid };
}
