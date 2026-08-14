"use client";
/**
 * components/infoboard/anlageplan/LiveClockAnlageplan.tsx
 *
 * INFOBOARD-CLOCK-01 — Live-ticking time/date block for the InfoboardAnlageplan header.
 *
 * Replaces the static time/date rendering in InfoboardAnlageplan with a client
 * component that advances every 30 s via useKioskClock.
 *
 * Visual output is identical to the previous static rendering:
 *   • Large HH:mm (3.8vh, bold)
 *   • Smaller "Weekday, D. Month" below (1.2vh, muted)
 *
 * Invariants:
 *   - Inline styles are kept identical to InfoboardAnlageplan to avoid any
 *     visual change.
 *   - Does not render differently on server vs. first client paint (hydration safe).
 *   - Does not touch auth, feed content, map data, or event data.
 */

import type { ReactElement } from "react";
import {
  useKioskClock,
  formatKioskTime,
  formatKioskDateLine,
} from "@/components/infoboard/kiosk-clock";

export type LiveClockAnlageplanProps = {
  initialTimeIso: string;
  timezone: string;
};

export function LiveClockAnlageplan({
  initialTimeIso,
  timezone,
}: LiveClockAnlageplanProps): ReactElement {
  const timeIso = useKioskClock(initialTimeIso);

  const currentTime = formatKioskTime(timeIso, timezone);
  const currentDate = formatKioskDateLine(timeIso, timezone);

  return (
    <div className="text-right shrink-0">
      <div
        style={{
          fontSize: "3.8vh",
          fontWeight: 700,
          letterSpacing: "0.04em",
          lineHeight: 1,
        }}
      >
        {currentTime}
      </div>
      <div
        style={{
          fontSize: "1.2vh",
          color: "rgba(255,255,255,0.50)",
          marginTop: "0.2vh",
          letterSpacing: "0.06em",
        }}
      >
        {currentDate}
      </div>
    </div>
  );
}
