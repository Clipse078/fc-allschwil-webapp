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
import { Screen2CenterRotator } from "@/components/infoboard/screen2/Screen2CenterRotator";
import { Screen2LowerSponsorZone } from "@/components/infoboard/screen2/Screen2LowerSponsorZone";
import { resolveTenantTransportConfig } from "@/lib/transport/transport-config";
import type { TransportResult } from "@/lib/transport/transport-types";
import { AnlageplanMapScene } from "./AnlageplanMapScene";
import styles from "./InfoboardAnlageplan.module.css";

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
  /** Tenant key for transport refresh + rotator configuration. */
  tenantKey?: string | null;
  /** Initial normalized transport payload from the server boundary. */
  transport?: TransportResult | null;
};

// ── Main component ────────────────────────────────────────────────────────────

export function InfoboardAnlageplan({
  payload,
  weather,
  richEventCards = false,
  branding,
  shellConfig,
  liveClock = true,
  tenantKey = null,
  transport = null,
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
  const transportConfig = tenantKey ? resolveTenantTransportConfig(tenantKey) : null;

  const anlageplanCenter = (
    <div data-testid="anlageplan-slide" className={styles.anlageplanSlide}>
      <div className={styles.mapRow}>
        <div
          data-testid="anlageplan-map-canvas"
          className={`${styles.mapCanvas}${backgroundUrl ? "" : ` ${styles.mapCanvasNoBackground}`}`}
        >
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
      <Screen2LowerSponsorZone />
    </div>
  );

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
      <div data-testid="anlageplan-main-region" className={styles.mainRegion}>
        <Screen2BodyShell
          center={
            transportConfig && tenantKey ? (
              <Screen2CenterRotator
                tenantKey={tenantKey}
                timezone={tz}
                initialTransport={transport}
                refreshIntervalSeconds={transportConfig.refreshIntervalSeconds}
                anlageplanDurationMs={transportConfig.rotatorIntervalMs}
                transportDurationMs={transportConfig.rotatorIntervalMs}
                live={liveClock}
              >
                {anlageplanCenter}
              </Screen2CenterRotator>
            ) : (
              anlageplanCenter
            )
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
