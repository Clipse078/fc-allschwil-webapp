/**
 * components/infoboard/anlageplan/InfoboardAnlageplan.tsx
 *
 * INFOBOARD-MAP-02 — Public Anlageplan kiosk display.
 *
 * Layout (16:9, dark premium shell):
 *   ┌────────────────────────────────────────────────────────┐
 *   │ SHARED KIOSK HEADER (logo / name / time / date)        │
 *   ├──────────┬──────────────────────────────┬──────────────┤
 *   │ SPONSOR  │ MAP CANVAS (center zone)     │ SPONSOR      │
 *   │ RAIL     │ AnlageplanMapScene           │ RAIL         │
 *   │ (left)   │ (bg + zones + markers)       │ (right)      │
 *   ├──────────┴──────────────────────────────┴──────────────┤
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
 *   - 100% canvas height inside PhysicalInfoboardViewport, no scroll
 *   - DARK theme only
 *   - Uses KioskShellHeader + KioskShellFooter (shared with Screen 1)
 *   - NO editor geometry: no selection outlines, no bounding boxes, no drag handles
 */

import type { ReactElement, CSSProperties } from "react";
import type { AnlageplanLivePayload } from "@/lib/publishing/infoboard/anlageplan-live-service";
import { groupFacilityPitches } from "@/lib/publishing/infoboard/facility-group";
import { resolveBackgroundTransform } from "@/lib/infoboard/anlageplan-types";
import { KioskShellHeader } from "@/components/infoboard/shared/KioskShellHeader";
import { KIOSK_SHELL_CSS_VARS } from "@/lib/infoboard/kiosk-shell-sizing";
import type { WeatherResult } from "@/lib/weather/weather-types";
import { KioskShellFooter } from "@/components/infoboard/shared/KioskShellFooter";
import { Screen2BodyShell } from "@/components/infoboard/screen2/Screen2BodyShell";
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
  /** Preview-only: keep the supplied simulated moment fixed. */
  liveClock?: boolean;
};

// ── Main component ────────────────────────────────────────────────────────────

export function InfoboardAnlageplan({
  payload,
  weather,
  richEventCards = false,
  branding,
  shellConfig,
  liveClock = true,
}: InfoboardAnlageplanProps): ReactElement {
  const { screen2, anlageplanConfig, backgroundUrl, currentTimeIso } = payload;
  const tz = screen2.feed.tenant.timezone;
  const bgTransform = payload.backgroundTransform ?? resolveBackgroundTransform(anlageplanConfig);

  // Per-board shell config (all default ON for backward compat)
  const showTime = shellConfig?.showTime !== false;
  const showDate = shellConfig?.showDate !== false;
  const showWeather = shellConfig?.showWeather === true;
  const subtitleEnabled = shellConfig?.subtitleEnabled !== false;
  const subtitleText = shellConfig?.subtitleText?.trim() ?? null;
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
        height: "100%",
        minHeight: 0,
        overflow: "hidden",
        background: "#060B12",
        color: "#ffffff",
        fontFamily: "var(--font-inter, Inter, system-ui, -apple-system, sans-serif)",
        ...KIOSK_SHELL_CSS_VARS,
      } as CSSProperties}
    >
      {/* ── SHARED HEADER ─────────────────────────────────────────────── */}
      <KioskShellHeader
        clubLogoSrc={branding.clubLogoSrc}
        clubName={branding.clubName ?? "FC ALLSCHWIL"}
        subtitle={subtitleText}
        subtitleEnabled={subtitleEnabled}
        initialTimeIso={currentTimeIso}
        timezone={tz}
        weather={showWeather ? weather : null}
        showTime={showTime}
        showDate={showDate}
        liveClock={liveClock}
        liveWeather={liveClock}
      />

      {/* ── BODY: sponsor rails + centered Anlageplan canvas ───────────── */}
      <div data-testid="anlageplan-main-region" style={{ flex: 1, minHeight: 0, width: "100%" }}>
        <Screen2BodyShell
          center={
            <div
              data-testid="anlageplan-map-canvas"
              style={{
                width: "100%",
                height: "100%",
                maxWidth: "100%",
                maxHeight: "100%",
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
          }
        />
      </div>

      {/* ── SHARED FOOTER ─────────────────────────────────────────────── */}
      <KioskShellFooter
        productLogoSrc={branding.productLogoSrc}
        announcement={announcement ?? undefined}
      />
    </div>
  );
}
