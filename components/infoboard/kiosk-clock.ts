"use client";
/**
 * components/infoboard/kiosk-clock.ts
 *
 * INFOBOARD-CLOCK-01 — Shared live-clock hook and format helpers for kiosk displays.
 *
 * Reused by:
 *   - LiveClockScreen1  (InfoboardScreen1 header — TAGESUEBERSICHT)
 *   - LiveClockAnlageplan (InfoboardAnlageplan header — ANLAGENUEBERSICHT)
 *
 * Invariants:
 *   - All formatters accept an explicit IANA timeZone — never rely on the
 *     browser's local timezone.
 *   - useKioskClock starts from initialTimeIso (the SSR-rendered value) so
 *     the initial client render matches the server output and React hydration
 *     succeeds without mismatch.
 *   - Clock syncs to real client time 1 s after mount, then re-reads every
 *     30 s — guaranteeing at least one update per minute.
 *   - Europe/Zurich is the canonical FCA display timezone; callers must pass
 *     feed.tenant.timezone explicitly.
 */

import { useEffect, useState } from "react";

// ── Format helpers ─────────────────────────────────────────────────────────────

/** HH:mm in the given IANA timezone (de-CH locale, 24 h). */
export function formatKioskTime(isoString: string, timeZone: string): string {
  return new Intl.DateTimeFormat("de-CH", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone,
    hour12: false,
  }).format(new Date(isoString));
}

/** Long weekday in the given IANA timezone (de-DE locale). */
export function formatKioskWeekday(isoString: string, timeZone: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    weekday: "long",
    timeZone,
  }).format(new Date(isoString));
}

/** "D. Month YYYY" in the given IANA timezone (de-DE locale). */
export function formatKioskDateLine(isoString: string, timeZone: string): string {
  return new Intl.DateTimeFormat("de-DE", {
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone,
  }).format(new Date(isoString));
}

// ── Hook ───────────────────────────────────────────────────────────────────────

/**
 * Live-ticking clock hook for Infoboard kiosk display components.
 *
 * Returns the current moment as a UTC ISO-8601 string.
 *
 * Behaviour:
 *   - Initial value is `initialTimeIso` so the first client render matches
 *     the SSR-rendered HTML — no React hydration warning.
 *   - 1 s after mount the state is synced to the real browser time, picking
 *     up any drift between the server request and client hydration.
 *   - Thereafter a 30 s interval keeps the value current (≥ 2 updates/min).
 *   - The effect has no dependencies so it runs once per mount and is fully
 *     cleaned up on unmount.
 */
export function useKioskClock(initialTimeIso: string, live = true): string {
  const [timeIso, setTimeIso] = useState(initialTimeIso);

  useEffect(() => {
    if (!live) return undefined;

    // Short initial sync — lets the server-rendered time hydrate cleanly before
    // switching to the live browser clock.
    const syncId = setTimeout(() => {
      setTimeIso(new Date().toISOString());
    }, 1_000);

    // Recurring tick every 30 s; guarantees ≥ 1 update per minute.
    const tickId = setInterval(() => {
      setTimeIso(new Date().toISOString());
    }, 30_000);

    return () => {
      clearTimeout(syncId);
      clearInterval(tickId);
    };
  }, [live]);

  return live ? timeIso : initialTimeIso;
}
