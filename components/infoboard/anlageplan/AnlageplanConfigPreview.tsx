"use client";

/**
 * components/infoboard/anlageplan/AnlageplanConfigPreview.tsx
 *
 * INFOBOARD-MAP-02-C1 — Canonical board-specific Anlageplan overview preview.
 *
 * Renders a scaled miniature of the actual configured ANLAGENUEBERSICHT board:
 *   - Real background image (admin-uploaded facility photo)
 *   - Real zone positions and display labels (configured by admin)
 *   - Real marker positions (configured by admin)
 *   - FREI state for resource zones (no live activity data loaded here,
 *     no fabricated teams/events/times)
 *
 * Uses the same AnlageplanMapScene as the public kiosk — identical geometry.
 * The administrator sees their exact map layout, not a generic placeholder.
 *
 * Scaling approach:
 *   container-type: inline-size + calc(100cqi / PREVIEW_WIDTH) scale,
 *   identical to InboardMiniPreview.
 *
 * pointer-events: none — non-interactive thumbnail.
 */

import type { ReactElement } from "react";
import { parseAnlageplanJson, emptyAnlageplanConfig, resolveBackgroundTransform } from "@/lib/infoboard/anlageplan-types";
import { AnlageplanMapScene } from "./AnlageplanMapScene";

// ── Constants ─────────────────────────────────────────────────────────────────

const PREVIEW_WIDTH = 1920;
const PREVIEW_HEIGHT = Math.round(PREVIEW_WIDTH / (16 / 9));

// ── Props ─────────────────────────────────────────────────────────────────────

export type AnlageplanConfigPreviewProps = {
  /** Raw AnlageplanConfig JSON stored in Infoboard.anlageplanJson. null = empty board. */
  anlageplanJson: string | null;
  /** Blob CDN URL of the uploaded background site-plan image. null = no image. */
  backgroundUrl: string | null;
  className?: string;
};

// ── Component ─────────────────────────────────────────────────────────────────

export function AnlageplanConfigPreview({
  anlageplanJson,
  backgroundUrl,
  className = "",
}: AnlageplanConfigPreviewProps): ReactElement {
  const config = parseAnlageplanJson(anlageplanJson) ?? emptyAnlageplanConfig();
  const bgTransform = resolveBackgroundTransform(config);

  return (
    <div
      className={`overflow-hidden ${className}`}
      style={{ containerType: "inline-size" } as React.CSSProperties}
      aria-hidden="true"
      data-testid="anlageplan-config-preview"
    >
      {/*
       * Scale the PREVIEW_WIDTH-wide board to fit the container.
       * container-type: inline-size lets us use 100cqi = container width.
       * transform-origin: top left — clips from the top of the kiosk.
       */}
      <div
        style={{
          width: PREVIEW_WIDTH,
          height: PREVIEW_HEIGHT,
          transformOrigin: "top left",
          transform: `scale(calc(100cqi / ${PREVIEW_WIDTH}))`,
          background: "#060B12",
          display: "flex",
          flexDirection: "column",
          fontFamily: "system-ui, sans-serif",
          overflow: "hidden",
          pointerEvents: "none",
        }}
      >
        {/* ── Kiosk header bar (matches KioskShellHeader visual) ─────── */}
        <div
          style={{
            height: 90,
            background: "#0A1828",
            borderBottom: "3px solid #e87722",
            display: "flex",
            alignItems: "center",
            padding: "0 40px",
            justifyContent: "space-between",
            flexShrink: 0,
          }}
        >
          {/* Left: logo placeholder + club name */}
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div
              style={{
                width: 56,
                height: 56,
                borderRadius: "50%",
                background: "rgba(255,255,255,0.10)",
                flexShrink: 0,
              }}
            />
            <div>
              <div
                style={{
                  fontSize: 28,
                  fontWeight: 800,
                  letterSpacing: "0.06em",
                  color: "#fff",
                  lineHeight: 1,
                }}
              >
                FC ALLSCHWIL
              </div>
              <div
                style={{
                  fontSize: 11,
                  letterSpacing: "0.16em",
                  color: "rgba(255,255,255,0.45)",
                  marginTop: 3,
                }}
              >
                SPORTANLAGE IM BRÜEL
              </div>
            </div>
          </div>
          {/* Right: clock placeholder */}
          <div style={{ textAlign: "right" }}>
            <div
              style={{
                fontSize: 52,
                fontWeight: 700,
                color: "#fff",
                lineHeight: 1,
                letterSpacing: "0.02em",
              }}
            >
              ——:——
            </div>
          </div>
        </div>

        {/* ── Subtitle bar ──────────────────────────────────────────── */}
        <div
          style={{
            height: 44,
            background: "#0A1828",
            borderBottom: "1px solid rgba(99,135,175,0.16)",
            display: "flex",
            alignItems: "center",
            padding: "0 40px",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontSize: 16,
              fontWeight: 600,
              letterSpacing: "0.16em",
              color: "#6E87A0",
            }}
          >
            ANLAGENÜBERSICHT
          </span>
        </div>

        {/* ── Body: actual map + empty rail ─────────────────────────── */}
        <div
          style={{
            flex: 1,
            display: "flex",
            padding: "12px 20px",
            gap: 16,
            minHeight: 0,
          }}
        >
          {/* Map canvas (actual board config) */}
          <div
            data-testid="anlageplan-config-preview-canvas"
            style={{
              flex: "1 1 78%",
              position: "relative",
              borderRadius: 12,
              overflow: "hidden",
              background: backgroundUrl ? "transparent" : "#0d1520",
              border: "1px solid rgba(255,255,255,0.06)",
            }}
          >
            {/* Actual map scene — real background, real zones, real markers */}
            <AnlageplanMapScene
              config={config}
              backgroundUrl={backgroundUrl}
              bgTransform={bgTransform}
              pitchMap={null}
              timezone="UTC"
            />
          </div>

          {/* Minimal activity rail placeholder */}
          <div
            style={{
              flex: "0 0 22%",
              maxWidth: "22%",
              display: "flex",
              flexDirection: "column",
              gap: 8,
            }}
          >
            <div
              style={{
                fontSize: 10,
                letterSpacing: "0.18em",
                color: "rgba(255,255,255,0.30)",
                textTransform: "uppercase",
                marginBottom: 4,
              }}
            >
              NÄCHSTE AKTIVITÄTEN
            </div>
            {/* Subtle empty state — does not fabricate any activity data */}
            <div
              style={{
                fontSize: 9,
                color: "rgba(255,255,255,0.15)",
                letterSpacing: "0.10em",
              }}
            >
              KEINE AKTIVITÄTEN
            </div>
          </div>
        </div>

        {/* ── Footer ──────────────────────────────────────────────────── */}
        <div
          style={{
            height: 46,
            background: "#0A1828",
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "0 40px",
            flexShrink: 0,
          }}
        >
          <span
            style={{
              fontSize: 12,
              color: "rgba(255,255,255,0.3)",
              letterSpacing: "0.10em",
              textTransform: "uppercase",
            }}
          >
            SPORTANLAGE
          </span>
          <span style={{ fontSize: 11, color: "rgba(255,255,255,0.20)" }}>
            POWERED BY SportClubEvo
          </span>
        </div>
      </div>
    </div>
  );
}
