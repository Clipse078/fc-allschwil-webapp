"use client";

/**
 * components/infoboard/v2/InboardRoutePreview.tsx
 *
 * Live miniature preview of a canonical Infoboard kiosk route.
 * Embeds the real board page in a same-origin iframe scaled to fit a 16:9
 * card viewport — pixel-for-pixel parity with the 1920×1080 board surface.
 *
 * The iframe is lazy-loaded when the card enters the viewport and does not
 * capture pointer events (clicks pass through to the parent link).
 */

import { useEffect, useRef, useState } from "react";
import {
  KIOSK_LOGICAL_HEIGHT,
  KIOSK_LOGICAL_WIDTH,
} from "@/lib/infoboard/kiosk-viewport";

type InboardRoutePreviewProps = {
  /** Canonical kiosk route, e.g. /infoboard/screen-1 */
  route: string;
  /** Accessible label for the embedded board */
  title: string;
  className?: string;
};

export function InboardRoutePreview({
  route,
  title,
  className = "",
}: InboardRoutePreviewProps) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [shouldLoad, setShouldLoad] = useState(false);

  useEffect(() => {
    const host = hostRef.current;
    if (!host) return;

    if (typeof IntersectionObserver === "undefined") {
      setShouldLoad(true);
      return;
    }

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry?.isIntersecting) {
          setShouldLoad(true);
          observer.disconnect();
        }
      },
      { rootMargin: "240px" },
    );

    observer.observe(host);
    return () => observer.disconnect();
  }, []);

  return (
    <div
      ref={hostRef}
      className={`relative w-full overflow-hidden bg-slate-900 ${className}`}
      style={
        {
          aspectRatio: "16 / 9",
          containerType: "inline-size",
        } as React.CSSProperties
      }
      data-testid="inboard-route-preview"
    >
      {shouldLoad ? (
        <iframe
          src={route}
          title={title}
          loading="lazy"
          tabIndex={-1}
          aria-hidden="true"
          data-testid="inboard-route-preview-iframe"
          className="absolute top-0 left-0 border-0 pointer-events-none select-none"
          style={{
            width: KIOSK_LOGICAL_WIDTH,
            height: KIOSK_LOGICAL_HEIGHT,
            transformOrigin: "top left",
            transform: `scale(calc(100cqi / ${KIOSK_LOGICAL_WIDTH}))`,
          }}
        />
      ) : (
        <div
          className="absolute inset-0 flex items-center justify-center"
          data-testid="inboard-route-preview-placeholder"
          aria-hidden="true"
        >
          <div className="h-8 w-8 animate-pulse rounded-full bg-white/10" />
        </div>
      )}
    </div>
  );
}
