"use client";
/**
 * components/infoboard/screen1/LiveClockScreen1.tsx
 *
 * INFOBOARD-CLOCK-01 — Live-ticking clock for the InfoboardScreen1 header center zone.
 *
 * Replaces the static time/date rendering in InfoboardScreen1 with a client
 * component that advances every 30 s via useKioskClock.
 *
 * Visual output is identical to the previous static rendering:
 *   showTime=true:  <HH:mm> | <Weekday>  +  <D. Month YYYY>
 *   showTime=false, showDate=true: <D. Month YYYY> (headerDateFallback style)
 *   both false: null
 *
 * Invariants:
 *   - Mirrors the exact CSS module class names used by InfoboardScreen1.
 *   - Does not render differently on server vs. first client paint (hydration safe).
 *   - Does not touch auth, feed content, or event data.
 */

import type { ReactElement } from "react";
import {
  useKioskClock,
  formatKioskTime,
  formatKioskWeekday,
  formatKioskDateLine,
} from "@/components/infoboard/kiosk-clock";
import styles from "./InfoboardScreen1.module.css";

export type LiveClockScreen1Props = {
  initialTimeIso: string;
  timezone: string;
  showTime: boolean;
  showDate: boolean;
};

export function LiveClockScreen1({
  initialTimeIso,
  timezone,
  showTime,
  showDate,
}: LiveClockScreen1Props): ReactElement | null {
  const timeIso = useKioskClock(initialTimeIso);

  const currentTime = formatKioskTime(timeIso, timezone);
  const weekday = formatKioskWeekday(timeIso, timezone);
  const dateLine = formatKioskDateLine(timeIso, timezone);

  if (showTime) {
    return (
      <div className={styles.headerTimeBlock}>
        <time className={styles.headerCurrentTime} dateTime={timeIso}>
          {currentTime}
        </time>
        {showDate && (
          <span className={styles.headerTimeSeparator} aria-hidden="true">
            |
          </span>
        )}
        {showDate && (
          <div className={styles.headerDateBlock}>
            <span className={styles.headerWeekday}>{weekday}</span>
            <span className={styles.headerDateLine}>{dateLine}</span>
          </div>
        )}
      </div>
    );
  }

  if (showDate) {
    return <span className={styles.headerDateFallback}>{dateLine}</span>;
  }

  return null;
}
