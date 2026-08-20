"use client";

/**
 * components/infoboard/screen1/AnnouncementTicker.tsx
 *
 * Client component for the announcement bar scrolling text.
 *
 * Normal mode:
 *   - Short text that fits → static (no animation, no overflow).
 *   - Text that overflows → horizontal scroll, seamless loop (CSS @keyframes).
 *   - Overflow detected via getBoundingClientRect.
 *   - ResizeObserver re-evaluates whenever the viewport width changes.
 *
 * prefers-reduced-motion mode:
 *   - No animation, no overflow clipping.
 *   - Text wraps naturally so the full message is always accessible.
 *   - Icon and colors are unchanged (both live on the parent Footer).
 *
 * Seamless loop technique (normal mode):
 *   Two copies of the text are placed in the same inline-flex track, separated
 *   by a fixed gap. The track animates translateX(0) →
 *   translateX(-(firstCopyWidth + gap)). When the first copy exits, the second
 *   copy occupies the exact start position → seamless.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import styles from "./InfoboardScreen1.module.css";

/** Gap (px) between the end of one text repetition and the start of the next. */
const GAP_PX = 96;

/** Scroll speed in pixels per second — tuned for TV-distance readability. */
const SPEED_PX_PER_S = 50;


type AnnouncementTickerProps = {
  text: string;
};

export function AnnouncementTicker({ text }: AnnouncementTickerProps) {
  const viewportRef = useRef<HTMLDivElement>(null);
  const firstCopyRef = useRef<HTMLSpanElement>(null);

  const [shouldScroll, setShouldScroll] = useState(false);
  const [reducedMotion, setReducedMotion] = useState(false);
  const [cssVars, setCssVars] = useState<React.CSSProperties>({});

  /**
   * Core measurement function — reads current DOM geometry and updates state.
   *
   * Stable ref-based function (no React state dependencies) so it can safely
   * be used as a ResizeObserver callback without re-subscribing on every render.
   */
  const measure = useCallback(() => {
    const viewport = viewportRef.current;
    const firstCopy = firstCopyRef.current;
    if (!viewport || !firstCopy) return;

    const mq =
      typeof window !== "undefined"
        ? window.matchMedia?.("(prefers-reduced-motion: reduce)")
        : null;

    if (mq?.matches) {
      // Reduced-motion: disable animation; let text wrap freely.
      setReducedMotion(true);
      setShouldScroll(false);
      setCssVars({});
      return;
    }

    setReducedMotion(false);

    const textW = firstCopy.getBoundingClientRect().width;
    const viewportW = viewport.getBoundingClientRect().width;

    if (textW > viewportW) {
      const dist = textW + GAP_PX;
      const duration = dist / SPEED_PX_PER_S;
      setCssVars({
        "--ticker-dist": `-${dist}px`,
        "--ticker-duration": `${duration}s`,
      } as React.CSSProperties);
      setShouldScroll(true);
    } else {
      setShouldScroll(false);
      setCssVars({});
    }
  }, []); // stable — only uses refs and window APIs

  /** Re-measure when text changes. */
  useEffect(() => {
    measure();
  }, [text, measure]);

  /**
   * ResizeObserver — re-evaluates overflow whenever the viewport resizes.
   * Handles font-load, orientation-change, and panel-resize scenarios.
   * Falls back gracefully if ResizeObserver is unavailable.
   */
  useEffect(() => {
    const viewport = viewportRef.current;
    if (!viewport || typeof ResizeObserver === "undefined") return;

    const ro = new ResizeObserver(() => {
      measure();
    });
    ro.observe(viewport);
    return () => {
      ro.disconnect();
    };
  }, [measure]);

  return (
    <div
      ref={viewportRef}
      className={
        reducedMotion ? styles.tickerViewportReduced : styles.tickerViewport
      }
      data-testid="announcement-ticker-viewport"
      data-reduced-motion={reducedMotion ? "true" : undefined}
    >
      <span
        className={
          reducedMotion
            ? styles.tickerTrackReduced
            : shouldScroll
              ? styles.tickerTrackAnimated
              : styles.tickerTrackStatic
        }
        style={cssVars}
        data-testid="announcement-ticker-track"
        data-scrolling={shouldScroll ? "true" : "false"}
      >
        <span ref={firstCopyRef} data-testid="announcement-ticker-text">
          {text}
        </span>
        {!reducedMotion && shouldScroll && (
          <span aria-hidden="true" data-testid="announcement-ticker-clone">
            {text}
          </span>
        )}
      </span>
    </div>
  );
}
