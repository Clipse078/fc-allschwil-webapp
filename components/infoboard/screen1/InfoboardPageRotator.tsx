/**
 * components/infoboard/screen1/InfoboardPageRotator.tsx
 *
 * CLIENT COMPONENT — automatic page rotation for Infoboard Screen 1.
 *
 * Used only when the complete visible activity set exceeds the per-page
 * demand threshold (CARD_DEMAND_PAGE_MAX). On normal days, the visible set
 * fits on a single page and this component is a zero-overhead pass-through.
 *
 * Design:
 *   - Calm page switch every `intervalMs` milliseconds (default 12 s).
 *   - No flashy transitions — content swap only.
 *   - Never splits a card in the middle (pages are pre-computed server-side).
 *   - Page 1 always shows first regardless of client hydration timing.
 *
 * Invariants:
 *   - Children are server-rendered page elements passed from InfoboardScreen1.
 *   - No data fetching, no URL parameters, no scroll.
 *   - Uses 'use client' so the setInterval side-effect runs only in the browser.
 */
"use client";

import { useState, useEffect, Children } from "react";
import type { ReactNode } from "react";
import styles from "./InfoboardScreen1.module.css";

type InfoboardPageRotatorProps = {
  /** Pre-rendered page content (server-side). One child per page. */
  children: ReactNode;
  /** Rotation interval in milliseconds. Defaults to 12 000 ms (12 s). */
  intervalMs?: number;
  /** Identity of the paginated feed; changes restart rolling from Page 1. */
  contentKey?: string;
};

function normalizePageIndex(index: number, pageCount: number): number {
  if (pageCount <= 0) return 0;
  return ((index % pageCount) + pageCount) % pageCount;
}

export function InfoboardPageRotator({
  children,
  intervalMs = 12_000,
  contentKey,
}: InfoboardPageRotatorProps): ReactNode {
  const childArray = Children.toArray(children);
  const pageCount = childArray.length;

  if (pageCount <= 0) {
    return null;
  }

  // Single page: return directly without wrapper overhead.
  if (pageCount <= 1) {
    return childArray[0] ?? null;
  }

  // A changed feed identity or page count remounts only the small stateful
  // stage. This starts repacked content at Page 1 without synchronously
  // setting state from an effect.
  const rotationKey = `${contentKey ?? "stable"}:${pageCount}`;
  return (
    <RotatingPages
      key={rotationKey}
      pages={childArray}
      intervalMs={intervalMs}
    />
  );
}

function RotatingPages({
  pages,
  intervalMs,
}: {
  pages: ReactNode[];
  intervalMs: number;
}): ReactNode {
  const pageCount = pages.length;
  const [currentPage, setCurrentPage] = useState(0);
  const visiblePage = normalizePageIndex(currentPage, pageCount);
  const activeChild = pages[visiblePage] ?? pages[0] ?? null;

  // Same-size feed refreshes preserve the interval. A changed page count
  // remounts this stage through rotationKey and therefore restarts at Page 1.
  useEffect(() => {
    if (intervalMs <= 0) return undefined;

    const id = window.setInterval(() => {
      setCurrentPage((prev) => (prev + 1) % pageCount);
    }, intervalMs);

    return () => window.clearInterval(id);
  }, [intervalMs, pageCount]);

  return (
    <div
      className={styles.pageRotator}
      data-testid="infoboard-page-rotator"
      data-page-count={pageCount}
      data-active-page={visiblePage}
    >
      {activeChild}
    </div>
  );
}
