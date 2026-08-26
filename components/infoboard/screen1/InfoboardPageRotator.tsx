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

import { useState, useEffect, useRef, Children } from "react";
import type { ReactNode } from "react";
import styles from "./InfoboardScreen1.module.css";

type InfoboardPageRotatorProps = {
  /** Pre-rendered page content (server-side). One child per page. */
  children: ReactNode;
  /** Rotation interval in milliseconds. Defaults to 12 000 ms (12 s). */
  intervalMs?: number;
};

function normalizePageIndex(index: number, pageCount: number): number {
  if (pageCount <= 0) return 0;
  return ((index % pageCount) + pageCount) % pageCount;
}

export function InfoboardPageRotator({
  children,
  intervalMs = 12_000,
}: InfoboardPageRotatorProps): ReactNode {
  const childArray = Children.toArray(children);
  const pageCount = childArray.length;
  const pageCountRef = useRef(pageCount);
  pageCountRef.current = pageCount;

  const [currentPage, setCurrentPage] = useState(0);
  const visiblePage = normalizePageIndex(currentPage, pageCount);
  const activeChild = childArray[visiblePage] ?? childArray[0] ?? null;

  // Keep state aligned when feed refresh changes the page count after hydration.
  useEffect(() => {
    setCurrentPage((prev) => normalizePageIndex(prev, pageCount));
  }, [pageCount]);

  // Stable interval — depends only on intervalMs so feed refreshes do not reset
  // the rotation clock when pageCount stays above one.
  useEffect(() => {
    if (intervalMs <= 0) return undefined;

    const id = window.setInterval(() => {
      const count = pageCountRef.current;
      if (count <= 1) return;
      setCurrentPage((prev) => (prev + 1) % count);
    }, intervalMs);

    return () => window.clearInterval(id);
  }, [intervalMs]);

  if (pageCount <= 0) {
    return null;
  }

  // Single page: return directly without wrapper overhead.
  if (pageCount <= 1) {
    return activeChild;
  }

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
