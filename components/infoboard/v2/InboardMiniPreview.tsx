"use client";

/**
 * components/infoboard/v2/InboardMiniPreview.tsx
 *
 * Compact scaled thumbnail of the Infoboard for overview cards.
 * Uses the same InfoboardScreen1 renderer as the kiosk — no fake preview.
 *
 * Scaling: CSS container query units shrink the 1920px board to fit the card
 * thumbnail width (no JS required for the scale calculation).
 * The parent clips to show only the top portion (header + first events).
 */

import { InfoboardScreen1 } from "@/components/infoboard/screen1/InfoboardScreen1";
import {
  PREVIEW_FIXTURE,
  PREVIEW_CURRENT_TIME_ISO,
} from "@/components/infoboard/screen1/screen1-preview-fixture";
import type { InfoboardDisplayTheme } from "@/lib/publishing/infoboard/display-theme";

const PREVIEW_WIDTH = 1920;

type InboardMiniPreviewProps = {
  theme?: "DARK" | "LIGHT" | null;
  className?: string;
};

export function InboardMiniPreview({
  theme,
  className = "",
}: InboardMiniPreviewProps) {
  const resolvedTheme: InfoboardDisplayTheme = theme === "LIGHT" ? "LIGHT" : "DARK";

  return (
    <div
      className={`overflow-hidden ${className}`}
      style={{ containerType: "inline-size" } as React.CSSProperties}
      aria-hidden="true"
      data-testid="inboard-mini-preview"
    >
      {/*
        Scale the 1920px board to fit the container.
        container-type: inline-size lets us use 100cqi = 100% of container width.
        transform-origin: top left so it clips from the top.
       */}
      <div
        style={{
          width: PREVIEW_WIDTH,
          transformOrigin: "top left",
          // calc(100cqi / 1920) scales 1920px → 100% of container
          transform: `scale(calc(100cqi / ${PREVIEW_WIDTH}))`,
        }}
      >
        <InfoboardScreen1
          feed={PREVIEW_FIXTURE}
          currentTimeIso={PREVIEW_CURRENT_TIME_ISO}
          theme={resolvedTheme}
          headerConfig={{
            subtitleEnabled: true,
            showTime: true,
            showDate: true,
          }}
        />
      </div>
    </div>
  );
}
