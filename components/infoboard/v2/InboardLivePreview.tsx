"use client";

/**
 * components/infoboard/v2/InboardLivePreview.tsx
 *
 * Scaled 16:9 live preview of the Infoboard.
 *
 * Uses the same InfoboardScreen1 rendering component as the public kiosk.
 * Activity data comes from the preview fixture (no API call needed).
 * Settings (header, announcement, theme) are reflected immediately from props.
 *
 * Scaling approach:
 *   - InfoboardScreen1 targets 1920×1080 (full HD).
 *   - A CSS transform: scale(ratio) shrinks it to fit the container.
 *   - The wrapper uses aspect-ratio: 16/9 to maintain the correct shape.
 *   - The inner div is 1920px wide and absolutely positioned at top-left.
 *   - A ResizeObserver keeps the scale factor current.
 */

import { useRef, useEffect, useState } from "react";
import { InfoboardScreen1 } from "@/components/infoboard/screen1/InfoboardScreen1";
import {
  PREVIEW_FIXTURE,
  PREVIEW_CURRENT_TIME_ISO,
  PREVIEW_TARGET_TOURNAMENT_EXTENSIONS,
} from "@/components/infoboard/screen1/screen1-preview-fixture";
import type { InfoboardAnnouncementPresentation } from "@/components/infoboard/screen1/screen1-presentation-types";
import type { InfoboardDisplayTheme } from "@/lib/publishing/infoboard/display-theme";

export type InboardLivePreviewProps = {
  theme?: InfoboardDisplayTheme | null;
  headerConfig?: {
    subtitleEnabled?: boolean;
    subtitleText?: string | null;
    showTime?: boolean;
    showDate?: boolean;
  };
  announcement?: {
    enabled: boolean;
    text: string | null;
    bgColor: string | null;
    textColor: string | null;
  } | null;
  /** Optional CSS class applied to the outer wrapper */
  className?: string;
};

const PREVIEW_WIDTH = 1920;

export function InboardLivePreview({
  theme,
  headerConfig,
  announcement,
  className = "",
}: InboardLivePreviewProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const [scale, setScale] = useState(1);

  useEffect(() => {
    const el = wrapperRef.current;
    if (!el) return;

    const obs = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const containerWidth = entry.contentRect.width;
      setScale(containerWidth / PREVIEW_WIDTH);
    });

    obs.observe(el);
    // Initial scale
    setScale(el.offsetWidth / PREVIEW_WIDTH);
    return () => obs.disconnect();
  }, []);

  const announcementPresentation: InfoboardAnnouncementPresentation | undefined =
    announcement?.enabled && announcement.text?.trim()
      ? {
          enabled: true,
          text: announcement.text,
          backgroundColor: announcement.bgColor ?? null,
          textColor: announcement.textColor ?? null,
        }
      : undefined;

  const resolvedTheme: InfoboardDisplayTheme =
    theme === "LIGHT" ? "LIGHT" : "DARK";

  return (
    <div
      ref={wrapperRef}
      className={`relative w-full overflow-hidden rounded-[var(--radius-lg)] ${className}`}
      style={{ aspectRatio: "16 / 9" }}
      aria-label="Infoboard Vorschau"
      data-testid="infoboard-live-preview"
    >
      <div
        style={{
          position: "absolute",
          top: 0,
          left: 0,
          width: PREVIEW_WIDTH,
          height: Math.round(PREVIEW_WIDTH / (16 / 9)),
          transformOrigin: "top left",
          transform: `scale(${scale})`,
        }}
      >
        <InfoboardScreen1
          feed={PREVIEW_FIXTURE}
          announcement={announcementPresentation}
          eventPresentation={PREVIEW_TARGET_TOURNAMENT_EXTENSIONS}
          currentTimeIso={PREVIEW_CURRENT_TIME_ISO}
          theme={resolvedTheme}
          headerConfig={{
            subtitleEnabled: headerConfig?.subtitleEnabled,
            subtitleText: headerConfig?.subtitleText,
            showTime: headerConfig?.showTime,
            showDate: headerConfig?.showDate,
          }}
        />
      </div>
    </div>
  );
}
