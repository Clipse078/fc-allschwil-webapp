/**
 * components/infoboard/anlageplan/InfoboardAnlageplan.tsx
 *
 * INFOBOARD-MAP-02 — Public Anlageplan kiosk display.
 *
 * Layout (16:9, dark premium shell):
 *   ┌────────────────────────────────────────────────────────┐
 *   │ SHARED KIOSK HEADER (logo / name / time / date)        │
 *   ├──────────────────────────────────────┬─────────────────┤
 *   │                                      │ NÄCHSTE         │
 *   │  MAP CANVAS (~78% width)             │ AKTIVITÄTEN     │
 *   │  AnlageplanMapScene                  │ (~22% width)    │
 *   │  (bg + zones + markers)              │                 │
 *   ├──────────────────────────────────────┴─────────────────┤
 *   │ SHARED KIOSK FOOTER                                    │
 *   └────────────────────────────────────────────────────────┘
 *
 * Map scene rendered by AnlageplanMapScene — identical geometry to
 * the designer canvas and the overview preview thumbnail.
 *
 * Invariants:
 *   - Pure server component (no "use client", no effects, no fetch)
 *   - No Prisma imports, no DB access
 *   - No new Date() without argument
 *   - No null/undefined rendered as strings
 *   - 100dvh, no scroll
 *   - DARK theme only
 *   - Uses KioskShellHeader + KioskShellFooter (shared with Screen 1)
 *   - NO editor geometry: no selection outlines, no bounding boxes, no drag handles
 */

import type { ReactElement, CSSProperties } from "react";
import type { AnlageplanLivePayload } from "@/lib/publishing/infoboard/anlageplan-live-service";
import { groupFacilityPitches } from "@/lib/publishing/infoboard/facility-group";
import { resolveBackgroundTransform } from "@/lib/infoboard/anlageplan-types";
import { KioskShellHeader } from "@/components/infoboard/shared/KioskShellHeader";
import type { WeatherResult } from "@/lib/weather/weather-types";
import { KioskShellFooter } from "@/components/infoboard/shared/KioskShellFooter";
import { AnlageplanMapScene } from "./AnlageplanMapScene";

// ── Component props ───────────────────────────────────────────────────────────

export type InfoboardAnlageplanShellConfig = {
  readonly subtitleEnabled?: boolean;
  readonly subtitleText?: string | null;
  readonly showTime?: boolean;
  readonly showDate?: boolean;
  readonly showWeather?: boolean;
  readonly announcement?: {
    readonly enabled: boolean;
    readonly text: string | null;
    readonly backgroundColor?: string | null;
    readonly textColor?: string | null;
  } | null;
};

export type InfoboardAnlageplanProps = {
  payload: AnlageplanLivePayload;
  weather?: WeatherResult | null;
  richEventCards?: boolean;
  branding: {
    clubLogoSrc?: string | null;
    productLogoSrc?: string | null;
    clubName?: string | null;
    facilityName?: string | null;
  };
  shellConfig?: InfoboardAnlageplanShellConfig | null;
};

// ── Main component ────────────────────────────────────────────────────────────

export function InfoboardAnlageplan({
  payload,
  weather,
  richEventCards = false,
  branding,
  shellConfig,
}: InfoboardAnlageplanProps): ReactElement {
  const { screen2, anlageplanConfig, backgroundUrl, currentTimeIso } = payload;
  const tz = screen2.feed.tenant.timezone;
  const bgTransform = payload.backgroundTransform ?? resolveBackgroundTransform(anlageplanConfig);

  // Per-board shell config (all default ON for backward compat)
  const showTime = shellConfig?.showTime !== false;
  const showDate = shellConfig?.showDate !== false;
  const showWeather = shellConfig?.showWeather === true;
  const subtitleEnabled = shellConfig?.subtitleEnabled !== false;
  const subtitleText = shellConfig?.subtitleText?.trim() || "ANLAGENÜBERSICHT";
  const announcement = shellConfig?.announcement ?? null;

  // ── Apply canonical facility hierarchy (groupFacilityPitches) ────────────
  // This is the SINGLE canonical call — do not apply hierarchy again in the
  // map scene, rail, or any other rendering section. All three consume the
  // same resolved visiblePitches / suppressedCodes.
  //
  // Facility hierarchy is a domain presentation invariant. Styling or Designer
  // changes must never alter which physical resources are simultaneously shown.
  const { visiblePitches, suppressedCodes } = groupFacilityPitches(screen2.feed.pitches);

  // Build pitch occupancy lookup from VISIBLE pitches only.
  const pitchMap = new Map(visiblePitches.map((p) => [p.code, p]));

  return (
    <div
      data-testid="infoboard-anlageplan-root"
      data-theme="dark"
      style={{
        position: "relative",
        display: "flex",
        flexDirection: "column",
        width: "100%",
        height: "100dvh",
        overflow: "hidden",
        background: "#060B12",
        color: "#ffffff",
        // Inter as the canonical body typeface — matches Screen 1 + Screen 2
        // root. KioskShellHeader inherits this, ensuring FC ALLSCHWIL, date,
        // and subtitle render with the same typography as Screen 1.
        fontFamily: "var(--font-inter, Inter, system-ui, -apple-system, sans-serif)",
        // ── Design token parity with Screen 1 ──────────────────────────────
        // LiveClockScreen1 uses CSS module classes from InfoboardScreen1.module.css
        // that reference --ib-* custom properties. Those variables are defined on
        // the Screen 1 .root selector and are NOT automatically inherited here.
        // Setting the same token values on this root ensures the shared header clock
        // renders at identical physical size on both screens.
        "--ib-fs-header-time": "clamp(2.6rem, 3.4vw, 4rem)",
        "--ib-fs-header-date": "clamp(0.7rem, 0.9vw, 1rem)",
        "--ib-text": "#E8EEF4",
        "--ib-text-muted": "#6E87A0",
        "--ib-border-strong": "rgba(99, 135, 175, 0.32)",
      } as CSSProperties}
    >
      {/* ── SHARED HEADER ─────────────────────────────────────────────── */}
      <KioskShellHeader
        clubLogoSrc={branding.clubLogoSrc}
        clubName={branding.clubName ?? "FC ALLSCHWIL"}
        facilityLine={branding.facilityName ?? undefined}
        subtitle={subtitleText}
        subtitleEnabled={subtitleEnabled}
        initialTimeIso={currentTimeIso}
        timezone={tz}
        weather={showWeather ? weather : null}
        showTime={showTime}
        showDate={showDate}
      />

      {/* ── BODY: map canvas ───────────────────────────────────────────── */}
      {/*
       * FRAMING INVARIANT: the map canvas is constrained to 16:9 to match
       * the designer canvas aspect ratio (AnlageplanDesignerClient also uses
       * aspectRatio: 16/9). This ensures that the persisted BackgroundTransform
       * and normalized zone coordinates produce identical visual framing in
       * both the designer and the live kiosk — including the tree line at the
       * top of the source image. Without this constraint the live canvas is
       * wider than 16:9 (header + footer reduce the available height while
       * the full viewport width remains), causing object-fit: cover to crop
       * more from the top/bottom than the designer preview shows.
       *
       * Side effect: narrow dark gutters (≈ 110 px at 1920 × 1080) appear on
       * each side of the canvas. These are filled by the page background
       * (#060B12) and are intentional — they are not accidental gaps within
       * the map content.
       */}
      <div
        style={{
          flex: 1,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          minHeight: 0,
          padding: "0.6vh 0.9vw",
        }}
      >
        {/* ── MAP CANVAS — 16:9 to match designer coordinate system ─── */}
        <div
          data-testid="anlageplan-map-canvas"
          style={{
            height: "100%",
            aspectRatio: "16/9",
            position: "relative",
            borderRadius: "clamp(6px, 0.8vh, 14px)",
            overflow: "hidden",
            background: backgroundUrl ? "transparent" : "#0d1520",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          {/* Canonical shared map scene — identical geometry to designer + preview.
              suppressedCodes: zones for hierarchy-suppressed resources are
              completely omitted (not shown as FREI). This prop is absent/empty
              in the designer path so admins can see all configured zones. */}
          <AnlageplanMapScene
            config={anlageplanConfig}
            backgroundUrl={backgroundUrl}
            bgTransform={bgTransform}
            pitchMap={pitchMap}
            suppressedCodes={suppressedCodes}
            timezone={tz}
            richEventCards={richEventCards}
          />
        </div>
      </div>

      {/* ── SHARED FOOTER ─────────────────────────────────────────────── */}
      <KioskShellFooter
        productLogoSrc={branding.productLogoSrc}
        leftLabel={branding.facilityName ?? "SPORTANLAGE"}
        announcement={announcement ?? undefined}
      />
    </div>
  );
}
