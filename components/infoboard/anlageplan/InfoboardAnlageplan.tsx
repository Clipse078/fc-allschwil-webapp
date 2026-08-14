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
import type { PitchEventSummary } from "@/lib/publishing/event-types";
import { groupFacilityPitches } from "@/lib/publishing/infoboard/facility-group";
import { resolveBackgroundTransform } from "@/lib/infoboard/anlageplan-types";
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
          padding: "0.8vh 1.2vw",
          gap: "1vw",
        }}
      >
        {/* ── MAP CANVAS (~78%) ─────────────────────────────────────────── */}
        <div
          data-testid="anlageplan-map-canvas"
          style={{
            flex: "1 1 78%",
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
          />
        </div>

        {/* ── ACTIVITY RAIL (~22%) ──────────────────────────────────────── */}
        <aside
          data-testid="anlageplan-activity-rail"
          style={{
            flex: "0 0 22%",
            maxWidth: "22%",
            display: "flex",
            flexDirection: "column",
            gap: "0.5vh",
            overflow: "hidden",
          }}
        >
          <div
            style={{
              fontSize: "clamp(7px, 0.8vh, 10px)",
              letterSpacing: "0.20em",
              color: "rgba(255,255,255,0.35)",
              textTransform: "uppercase",
              marginBottom: "0.3vh",
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
                gap: "0.4vh",
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
                alignItems: "flex-start",
                paddingTop: "1vh",
              }}
            >
              <span
                style={{
                  fontSize: "clamp(7px, 0.85vh, 11px)",
                  color: "rgba(255,255,255,0.20)",
                  letterSpacing: "0.12em",
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
