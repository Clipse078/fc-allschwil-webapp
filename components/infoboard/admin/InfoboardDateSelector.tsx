/**
 * components/infoboard/admin/InfoboardDateSelector.tsx
 *
 * Admin-only date selector for the Infoboard Screen 1 preview.
 *
 * Renders "Heute" and "Morgen" links that update the `date` query parameter
 * on the admin page (/dashboard/infoboard?date=YYYY-MM-DD).
 *
 * This component affects only the admin preview; the public production Screen 1
 * at /infoboard/screen-1 is not modified by any interaction here.
 *
 * Design constraints:
 *   - Client component required for `useSearchParams` / `usePathname`.
 *   - Uses only established SportClubEvo dashboard design tokens.
 *   - German UI copy throughout.
 *   - Date calculations use Intl.DateTimeFormat with explicit tenant timezone
 *     to avoid server-local timezone dependency.
 *   - Uses YYYY-MM-DD format in the URL query parameter.
 *   - Selecting a date does not persist any data.
 *   - Selecting a date does not alter Event records.
 *   - Selecting a date does not affect the public production board.
 */

"use client";

import Link from "next/link";

// ── Types ─────────────────────────────────────────────────────────────────────

export type InfoboardDateSelectorProps = {
  /** The currently selected date key (YYYY-MM-DD). */
  readonly selectedDate: string;
  /** Today's date key in the tenant timezone (YYYY-MM-DD). */
  readonly todayKey: string;
  /** Tomorrow's date key in the tenant timezone (YYYY-MM-DD). */
  readonly tomorrowKey: string;
};

// ── InfoboardDateSelector ─────────────────────────────────────────────────────

export function InfoboardDateSelector({
  selectedDate,
  todayKey,
  tomorrowKey,
}: InfoboardDateSelectorProps) {
  const isToday = selectedDate === todayKey;
  const isTomorrow = selectedDate === tomorrowKey;

  return (
    <div className="flex items-center gap-2">
      <span className="text-[0.72rem] text-[var(--muted)]">Datum:</span>
      <div className="flex items-center gap-1 rounded-[var(--radius-lg)] border border-[var(--border)] bg-[var(--surface-2)] p-1">
        <Link
          href="/dashboard/infoboard"
          aria-pressed={isToday}
          className={`rounded-[calc(var(--radius-lg)-2px)] px-3 py-1 text-[0.75rem] font-semibold transition ${
            isToday
              ? "bg-white text-[var(--foreground)] shadow-sm"
              : "text-[var(--muted)] hover:text-[var(--foreground)]"
          }`}
        >
          Heute
        </Link>
        <Link
          href={`/dashboard/infoboard?date=${tomorrowKey}`}
          aria-pressed={isTomorrow}
          className={`rounded-[calc(var(--radius-lg)-2px)] px-3 py-1 text-[0.75rem] font-semibold transition ${
            isTomorrow
              ? "bg-white text-[var(--foreground)] shadow-sm"
              : "text-[var(--muted)] hover:text-[var(--foreground)]"
          }`}
        >
          Morgen
        </Link>
      </div>
    </div>
  );
}
