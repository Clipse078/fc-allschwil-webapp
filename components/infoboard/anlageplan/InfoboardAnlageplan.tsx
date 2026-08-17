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
import type { PitchEventSummary } from "@/lib/publishing/event-types";
import { groupFacilityPitches } from "@/lib/publishing/infoboard/facility-group";
import { resolveBackgroundTransform } from "@/lib/infoboard/anlageplan-types";
import { KioskShellHeader } from "@/components/infoboard/shared/KioskShellHeader";
import type { WeatherResult } from "@/lib/weather/weather-types";
import { KioskShellFooter } from "@/components/infoboard/shared/KioskShellFooter";
import { AnlageplanMapScene } from "./AnlageplanMapScene";
import { NextActivityRow } from "./AnlageplanMapElements";

// ── Component props ───────────────────────────────────────────────────────────

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
};

// ── Main component ────────────────────────────────────────────────────────────

export function InfoboardAnlageplan({
  payload,
  weather,
  richEventCards = false,
  branding,
}: InfoboardAnlageplanProps): ReactElement {
  const { screen2, anlageplanConfig, backgroundUrl, currentTimeIso } = payload;
  const tz = screen2.feed.tenant.timezone;
  const bgTransform = payload.backgroundTransform ?? resolveBackgroundTransform(anlageplanConfig);

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

  // Collect NEXT activities for the right rail from VISIBLE pitches only
  // (de-duplicate by event id). Suppressed resources never appear in the rail.
  const seenIds = new Set<string>();
  const nextActivities: Array<{ event: PitchEventSummary; resourceLabel: string }> = [];
  for (const pitch of visiblePitches) {
    const label = pitch.displayLabel ?? pitch.code;
    if (pitch.nextEvent && !seenIds.has(pitch.nextEvent.eventId)) {
      seenIds.add(pitch.nextEvent.eventId);
      nextActivities.push({ event: pitch.nextEvent, resourceLabel: label });
    }
  }
  nextActivities.sort((a, b) => a.event.startAt.localeCompare(b.event.startAt));

  const hasContent =
    visiblePitches.some((p) => p.currentEvent || p.nextEvent) ||
    nextActivities.length > 0;

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
        subtitle="ANLAGENÜBERSICHT"
        subtitleEnabled
        initialTimeIso={currentTimeIso}
        timezone={tz}
        weather={weather}
        showTime
        showDate
      />

      {/* ── BODY: map canvas + activity rail ──────────────────────────── */}
      <div
        style={{
          flex: 1,
          display: "flex",
          minHeight: 0,
          padding: "0.6vh 0.9vw",
          gap: "0.8vw",
        }}
      >
        {/* ── MAP CANVAS (~78%) ─────────────────────────────────────────── */}
        <div
          data-testid="anlageplan-map-canvas"
          style={{
            flex: "1 1 80%",
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

        {/* ── ACTIVITY RAIL (~22%) ──────────────────────────────────────── */}
        <aside
          data-testid="anlageplan-activity-rail"
          style={{
            flex: "0 0 20%",
            maxWidth: "20%",
            display: "flex",
            flexDirection: "column",
            gap: "0.6vh",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              fontSize: "clamp(13px, 1.5vh, 19px)",
              letterSpacing: "0.18em",
              color: "rgba(255,255,255,0.50)",
              textTransform: "uppercase",
              marginBottom: "0.4vh",
              flexShrink: 0,
              fontWeight: 600,
            }}
          >
            NÄCHSTE AKTIVITÄTEN
          </div>

          {nextActivities.length > 0 ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.5vh",
                overflow: "hidden",
                flex: 1,
              }}
            >
              {nextActivities.map(({ event, resourceLabel }) => (
                <NextActivityRow
                  key={event.eventId}
                  event={event}
                  resourceLabel={resourceLabel}
                  tz={tz}
                />
              ))}
            </div>
          ) : (
            <div
              style={{
                flex: 1,
                display: "flex",
                flexDirection: "column",
                alignItems: "flex-start",
                justifyContent: "flex-start",
                paddingTop: "1.5vh",
                gap: "0.6vh",
              }}
            >
              <span
                style={{
                  fontSize: "clamp(11px, 1.4vh, 18px)",
                  color: "rgba(255,255,255,0.30)",
                  letterSpacing: "0.08em",
                  fontWeight: 500,
                  lineHeight: 1.3,
                }}
              >
                {hasContent ? "Aktuell keine weiteren Aktivitäten" : "Keine Aktivitäten heute"}
              </span>
            </div>
          )}
        </aside>
      </div>

      {/* ── SHARED FOOTER ─────────────────────────────────────────────── */}
      <KioskShellFooter
        productLogoSrc={branding.productLogoSrc}
        leftLabel={branding.facilityName ?? "SPORTANLAGE"}
      />
    </div>
  );
}
