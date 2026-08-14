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

import type { ReactElement } from "react";
import type { AnlageplanLivePayload } from "@/lib/publishing/infoboard/anlageplan-live-service";
import type {
  PitchOccupancy,
  PitchEventSummary,
} from "@/lib/publishing/event-types";
import { resolveBackgroundTransform } from "@/lib/infoboard/anlageplan-types";
import { deriveSuppressedCodes } from "@/lib/publishing/infoboard/facility-group";
import { KioskShellHeader } from "@/components/infoboard/shared/KioskShellHeader";
import { KioskShellFooter } from "@/components/infoboard/shared/KioskShellFooter";
import { AnlageplanMapScene } from "./AnlageplanMapScene";
import { NextActivityRow } from "./AnlageplanMapElements";

// ── Component props ───────────────────────────────────────────────────────────

export type InfoboardAnlageplanProps = {
  payload: AnlageplanLivePayload;
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
  branding,
}: InfoboardAnlageplanProps): ReactElement {
  const { screen2, anlageplanConfig, backgroundUrl, currentTimeIso } = payload;
  const tz = screen2.feed.tenant.timezone;
  const bgTransform = payload.backgroundTransform ?? resolveBackgroundTransform(anlageplanConfig);

  // INFOBOARD-UX-03: compute which resource codes should be suppressed so that
  // FULL_PITCH and HALF_PITCH representations never appear simultaneously.
  const suppressedCodes = deriveSuppressedCodes(screen2.feed.pitches);

  // Build pitch occupancy lookup: resourceCode → PitchOccupancy.
  // The suppressedCodes set controls which zones the map scene actually renders.
  const pitchMap = new Map<string, PitchOccupancy>(
    screen2.feed.pitches.map((p) => [p.code, p]),
  );

  // Collect NEXT activities for the right rail from canonical (non-suppressed)
  // pitches only, so the rail obeys the same hierarchy rules as the map overlay.
  const seenIds = new Set<string>();
  const nextActivities: Array<{ event: PitchEventSummary; resourceLabel: string }> = [];
  for (const pitch of screen2.feed.pitches) {
    if (suppressedCodes.has(pitch.code)) continue;
    const label = pitch.displayLabel ?? pitch.code;
    if (pitch.nextEvent && !seenIds.has(pitch.nextEvent.eventId)) {
      seenIds.add(pitch.nextEvent.eventId);
      nextActivities.push({ event: pitch.nextEvent, resourceLabel: label });
    }
  }
  nextActivities.sort((a, b) => a.event.startAt.localeCompare(b.event.startAt));

  const hasContent =
    screen2.feed.pitches.some((p) => p.currentEvent || p.nextEvent) ||
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
        fontFamily: "var(--font-sans, system-ui, sans-serif)",
      }}
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
        showTime
        showDate
      />

      {/* ── BODY: map canvas + activity rail ──────────────────────────── */}
      <div
        style={{
          flex: 1,
          display: "flex",
          minHeight: 0,
          padding: "0.6vh 1vw",
          gap: "0.8vw",
        }}
      >
        {/* ── MAP CANVAS (~73%) ─────────────────────────────────────────── */}
        <div
          data-testid="anlageplan-map-canvas"
          style={{
            flex: "1 1 73%",
            position: "relative",
            borderRadius: "clamp(6px, 0.8vh, 14px)",
            overflow: "hidden",
            background: backgroundUrl ? "transparent" : "#0d1520",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          {/* Canonical shared map scene — identical geometry to designer + preview */}
          <AnlageplanMapScene
            config={anlageplanConfig}
            backgroundUrl={backgroundUrl}
            bgTransform={bgTransform}
            pitchMap={pitchMap}
            timezone={tz}
            suppressedCodes={suppressedCodes}
          />
        </div>

        {/* ── ACTIVITY RAIL (~27%) ──────────────────────────────────────── */}
        <aside
          data-testid="anlageplan-activity-rail"
          style={{
            flex: "0 0 27%",
            maxWidth: "27%",
            display: "flex",
            flexDirection: "column",
            gap: "0.8vh",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              fontSize: "clamp(9px, 1.1vh, 14px)",
              letterSpacing: "0.18em",
              color: "rgba(255,255,255,0.50)",
              textTransform: "uppercase",
              fontWeight: 600,
              paddingBottom: "0.4vh",
              borderBottom: "1px solid rgba(255,255,255,0.08)",
              flexShrink: 0,
            }}
          >
            NÄCHSTE AKTIVITÄTEN
          </div>

          {nextActivities.length > 0 ? (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                gap: "0.7vh",
                overflow: "hidden",
                flex: 1,
              }}
            >
              {/* Cap at 5 items — information quality over row count */}
              {nextActivities.slice(0, 5).map(({ event, resourceLabel }) => (
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
                alignItems: "flex-start",
                paddingTop: "1.5vh",
              }}
            >
              <span
                style={{
                  fontSize: "clamp(9px, 1.1vh, 14px)",
                  color: "rgba(255,255,255,0.20)",
                  letterSpacing: "0.10em",
                }}
              >
                {hasContent ? "ALLE FELDER BELEGT" : "KEINE AKTIVITÄTEN"}
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
