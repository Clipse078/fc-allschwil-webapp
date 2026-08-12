"use client";

/**
 * components/infoboard/screen1/AnnouncementTicker.tsx
 *
 * Client component for the announcement bar scrolling text.
 *
 * Behavior:
 *   - Short text that fits within the viewport → rendered static (no animation).
 *   - Text that overflows → scrolls horizontally at constant speed, seamless loop.
 *   - Overflow is detected via getBoundingClientRect (scrollWidth > viewportWidth).
 *   - Respects prefers-reduced-motion: no animation when motion is reduced.
 *   - Single line only (white-space: nowrap), no ellipsis, no wrapping.
 *   - The fixed icon stays outside this component (in the parent Footer).
 *   - No <marquee>; uses CSS @keyframes with translateX.
 *
 * Seamless loop technique:
 *   When overflow is detected, a second (aria-hidden) copy is appended inside the
 *   same flex track, separated by a fixed gap. The track animates from
 *   translateX(0) → translateX(-(firstCopyWidth + gap)). When the first copy
 *   exits the viewport, the second copy is at the same visual position as the
 *   first was at the start, producing a seamless loop.
 */

import { useEffect, useRef, useState } from "react";
import styles from "./InfoboardScreen1.module.css";

/** Gap (px) between the end of one text repetition and the start of the next. */
const GAP_PX = 96;

/** Scroll speed in pixels per second. Tuned for TV-distance readability. */
const SPEED_PX_PER_S = 70;

/** Minimum animation duration in seconds (protects against very short overflows). */
const MIN_DURATION_S = 10;

type AnnouncementTickerProps = {
  text: string;
};

export function AnnouncementTicker({ text }: AnnouncementTickerProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const firstCopyRef = useRef<HTMLSpanElement>(null);
  const [shouldScroll, setShouldScroll] = useState(false);
  const [cssVars, setCssVars] = useState<React.CSSProperties>({});

  useEffect(() => {
    const viewport = viewportRef.current;
    const firstCopy = firstCopyRef.current;
    if (!viewport || !firstCopy) return;

    const mq = typeof window !== "undefined"
      ? window.matchMedia?.("(prefers-reduced-motion: reduce)")
      : null;

    if (mq?.matches) {
      setShouldScroll(false);
      setCssVars({});
      return;
    }

    const textW = firstCopy.getBoundingClientRect().width;
    const viewportW = viewport.getBoundingClientRect().width;

    if (textW > viewportW) {
      const dist = textW + GAP_PX;
      const duration = Math.max(MIN_DURATION_S, dist / SPEED_PX_PER_S);
      setCssVars({
        "--ticker-dist": `-${dist}px`,
        "--ticker-duration": `${duration}s`,
      } as React.CSSProperties);
      setShouldScroll(true);
    } else {
      setShouldScroll(false);
      setCssVars({});
    }
  }, [text]);

  return (
    <div
      ref={viewportRef}
      className={styles.tickerViewport}
      data-testid="announcement-ticker-viewport"
    >
      <span
        className={
          shouldScroll ? styles.tickerTrackAnimated : styles.tickerTrackStatic
        }
        style={cssVars}
        data-testid="announcement-ticker-track"
        data-scrolling={shouldScroll ? "true" : "false"}
      >
        <span ref={firstCopyRef} data-testid="announcement-ticker-text">
          {text}
        </span>
        {shouldScroll && (
          <span aria-hidden="true" data-testid="announcement-ticker-clone">
            {text}
          </span>
        )}
      </span>
    </div>
  );
}
