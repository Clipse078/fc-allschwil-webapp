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

type InfoboardPageRotatorProps = {
  /** Pre-rendered page content (server-side). One child per page. */
  children: ReactNode;
  /** Rotation interval in milliseconds. Defaults to 12 000 ms (12 s). */
  intervalMs?: number;
};

export function InfoboardPageRotator({
  children,
  intervalMs = 12_000,
}: InfoboardPageRotatorProps): ReactNode {
  const childArray = Children.toArray(children);
  const pageCount = childArray.length;
  const [currentPage, setCurrentPage] = useState(0);

  useEffect(() => {
    if (pageCount <= 1) return undefined;
    const id = setInterval(() => {
      setCurrentPage((p) => (p + 1) % pageCount);
    }, intervalMs);
    return () => clearInterval(id);
  }, [pageCount, intervalMs]);

  // Single page: return directly without wrapper overhead.
  if (pageCount <= 1) {
    return childArray[0] ?? null;
  }

  return childArray[currentPage] ?? null;
}
