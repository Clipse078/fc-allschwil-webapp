"use client";

/**
 * components/infoboard/preview/TvScaleWrapper.tsx
 *
 * PREVIEW-ONLY — scales a 1920×1080 board frame to fill the available
 * browser viewport without distorting its proportions.
 *
 * Uses a ResizeObserver to measure the container width and compute the
 * CSS scale factor so the board fills horizontally (maintaining 16:9).
 *
 * The Infoboard content itself is never "use client" — only this thin
 * viewport scaling shell is a client component.
 */

import { type ReactNode, useEffect, useState, useRef } from "react";

const TV_WIDTH = 1920;
const TV_HEIGHT = 1080;

type TvScaleWrapperProps = {
  children: ReactNode;
  /** Optional CSS class applied to the outer container. */
  className?: string;
};

/**
 * Renders children at exactly 1920×1080 pixels, scaled down proportionally
 * to fit the available container width.
 *
 * The outer container preserves the 16:9 aspect ratio using padding-top.
 */
export function TvScaleWrapper({ children, className }: TvScaleWrapperProps) {
  const outerRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = outerRef.current;
    if (!el) return;

    const update = () => {
      const w = el.getBoundingClientRect().width;
      setScale(w / TV_WIDTH);
    };

    update();

    const ro = new ResizeObserver(update);
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  return (
    <div
      ref={outerRef}
      className={className}
      style={{
        position: "relative",
        width: "100%",
        /* Aspect-ratio box: maintains 16:9 as container width changes. */
        paddingTop: `${(TV_HEIGHT / TV_WIDTH) * 100}%`,
        overflow: "hidden",
        background: "#000",
      }}
    >
      <div
        data-testid="tv-scale-inner"
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: TV_WIDTH,
          height: TV_HEIGHT,
          transformOrigin: "top left",
          transform: `scale(${scale})`,
        }}
      >
        {children}
      </div>
    </div>
  );
}
