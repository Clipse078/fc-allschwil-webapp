/**
 * components/infoboard/anlageplan/InfoboardAnlageplan.tsx
 *
 * INFOBOARD-MAP-02 — Public Anlageplan kiosk display (premium redesign).
 *
 * Answers: "Wo muss ich hin? Was passiert gerade?"
 *
 * Layout (16:9, dark premium shell):
 *   ┌────────────────────────────────────────────────────────┐
 *   │ SHARED KIOSK HEADER (logo / name / time / date)        │
 *   ├──────────────────────────────────────┬─────────────────┤
 *   │                                      │ NÄCHSTE         │
 *   │  MAP CANVAS (~78% width)             │ AKTIVITÄTEN     │
 *   │  background image +                  │ (~22% width)    │
 *   │  premium activity cards on zones +   │                 │
 *   │  facility markers                    │                 │
 *   ├──────────────────────────────────────┴─────────────────┤
 *   │ SHARED KIOSK FOOTER                                    │
 *   └────────────────────────────────────────────────────────┘
 *
 * Invariants:
 *   - Pure server component (no "use client", no effects, no fetch)
 *   - No Prisma imports, no DB access
 *   - No new Date() without argument
 *   - No null/undefined rendered as strings
 *   - 100dvh, no scroll
 *   - DARK theme only (matching FCA brand)
 *   - Uses KioskShellHeader (shared with Screen 1) — INFOBOARD-MAP-02
 *   - Uses KioskShellFooter (shared with Screen 1) — INFOBOARD-MAP-02
 *   - NO editor geometry: no selection outlines, no bounding boxes, no drag handles
 */

import type { ReactElement } from "react";
import type { AnlageplanLivePayload } from "@/lib/publishing/infoboard/anlageplan-live-service";
import type {
  PitchOccupancy,
  PitchEventSummary,
} from "@/lib/publishing/event-types";
import type {
  ResourceZoneElement,
  MarkerElement,
} from "@/lib/infoboard/anlageplan-types";
import {
  isResourceZone,
  isMarker,
  isDuBistHier,
  MARKER_ICONS,
  resolveBackgroundTransform,
} from "@/lib/infoboard/anlageplan-types";
import { KioskShellHeader } from "@/components/infoboard/shared/KioskShellHeader";
import { KioskShellFooter } from "@/components/infoboard/shared/KioskShellFooter";

// ── Time formatting ───────────────────────────────────────────────────────────

function fmtTime(isoString: string, tz: string): string {
  return new Intl.DateTimeFormat("de-CH", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: tz,
    hour12: false,
  }).format(new Date(isoString));
}

// ── Activity type visual tokens ───────────────────────────────────────────────

type ActivityTypeTokens = {
  label: string;
  accentColor: string;
  accentBg: string;
  badgeBg: string;
  badgeColor: string;
};

function activityTypeTokens(type: string, isCurrent: boolean): ActivityTypeTokens {
  switch (type) {
    case "MATCH":
      return {
        label: "SPIEL",
        accentColor: isCurrent ? "#f87171" : "#ef4444",
        accentBg: isCurrent ? "rgba(239,68,68,0.12)" : "rgba(239,68,68,0.06)",
        badgeBg: "rgba(239,68,68,0.20)",
        badgeColor: "#fca5a5",
      };
    case "TOURNAMENT":
      return {
        label: "TURNIER",
        accentColor: isCurrent ? "#fbbf24" : "#f59e0b",
        accentBg: isCurrent ? "rgba(245,158,11,0.12)" : "rgba(245,158,11,0.06)",
        badgeBg: "rgba(245,158,11,0.20)",
        badgeColor: "#fde68a",
      };
    case "TRAINING":
    default:
      return {
        label: "TRAINING",
        accentColor: isCurrent ? "#60a5fa" : "#3b82f6",
        accentBg: isCurrent ? "rgba(59,130,246,0.12)" : "rgba(59,130,246,0.06)",
        badgeBg: "rgba(59,130,246,0.20)",
        badgeColor: "#93c5fd",
      };
  }
}

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

  // Build pitch occupancy lookup: resourceCode → PitchOccupancy
  const pitchMap = new Map<string, PitchOccupancy>(
    screen2.feed.pitches.map((p) => [p.code, p]),
  );

  // Separate map elements by type
  const zones = anlageplanConfig.elements.filter(isResourceZone);
  const markers = anlageplanConfig.elements.filter(
    (e): e is MarkerElement => isMarker(e) && !isDuBistHier(e),
  );
  const duBistHierEl = anlageplanConfig.elements.find(isDuBistHier) as MarkerElement | undefined;

  // Collect NEXT activities for the right rail (de-duplicate by event id)
  const seenIds = new Set<string>();
  const nextActivities: Array<{ event: PitchEventSummary; resourceLabel: string }> = [];
  for (const pitch of screen2.feed.pitches) {
    const label = pitch.displayLabel ?? pitch.code;
    if (pitch.nextEvent && !seenIds.has(pitch.nextEvent.eventId)) {
      seenIds.add(pitch.nextEvent.eventId);
      nextActivities.push({ event: pitch.nextEvent, resourceLabel: label });
    }
  }
  // Sort by start time
  nextActivities.sort((a, b) => a.event.startAt.localeCompare(b.event.startAt));

  // Current activities (for map overlay annotation only — shown on cards)
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
      {/* ── SHARED HEADER (canonical Screen 1 shell) ───────────────────── */}
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
          {!backgroundUrl && (
            <div
              style={{
                position: "absolute",
                inset: 0,
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                color: "rgba(255,255,255,0.12)",
                fontSize: "clamp(10px, 1.4vh, 18px)",
                letterSpacing: "0.18em",
                zIndex: 0,
                pointerEvents: "none",
              }}
            >
              ANLAGEPLAN
            </div>
          )}

          {/*
           * Shared map scene — background image + all overlays live inside
           * this container so that zoom/pan keeps zones visually aligned
           * with the image. Designer and kiosk use identical transform.
           */}
          <div
            style={{
              position: "absolute",
              inset: 0,
              transform: `translate(${bgTransform.offsetX * 100}%, ${bgTransform.offsetY * 100}%) scale(${bgTransform.scale})`,
              transformOrigin: "center center",
            }}
          >
            {/* Background image */}
            {backgroundUrl && (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={backgroundUrl}
                alt="Sportanlage"
                style={{
                  position: "absolute",
                  inset: 0,
                  width: "100%",
                  height: "100%",
                  objectFit: "cover",
                }}
              />
            )}

            {/* Premium resource cards on their mapped zones */}
            {zones.map((zone) => {
              const occupancy = zone.resourceCode
                ? pitchMap.get(zone.resourceCode)
                : null;
              return (
                <PremiumResourceCard
                  key={zone.id}
                  zone={zone}
                  occupancy={occupancy ?? null}
                  tz={tz}
                />
              );
            })}

            {/* Facility markers */}
            {markers.map((marker) => (
              <FacilityMarker key={marker.id} marker={marker} />
            ))}

            {/* Du bist hier marker */}
            {duBistHierEl && <DuBistHierMarker marker={duBistHierEl} />}
          </div>
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

      {/* ── SHARED FOOTER (canonical Screen 1 shell) ──────────────────── */}
      <KioskShellFooter
        productLogoSrc={branding.productLogoSrc}
        leftLabel={branding.facilityName ?? "SPORTANLAGE"}
      />
    </div>
  );
}

// ── PremiumResourceCard ───────────────────────────────────────────────────────

/**
 * Replaces the editor-style translucent rectangle with a compact dark
 * operational card anchored to the zone position.
 *
 * PUBLIC MUST NOT show:
 *   - selection outlines
 *   - resize geometry
 *   - translucent zone rectangles
 *   - editor labels
 *
 * Instead it renders a clean, TV-readable activity card.
 */
function PremiumResourceCard({
  zone,
  occupancy,
  tz,
}: {
  zone: ResourceZoneElement;
  occupancy: PitchOccupancy | null;
  tz: string;
}): ReactElement {
  const hasCurrent = occupancy?.currentEvent != null;
  const hasNext = zone.showNextActivity && occupancy?.nextEvent != null && !hasCurrent;
  const isFree = !hasCurrent && !hasNext;

  const activeEvent = occupancy?.currentEvent ?? occupancy?.nextEvent;
  const isCurrent = hasCurrent;

  if (isFree) {
    return (
      <div
        data-testid="resource-card-free"
        style={{
          position: "absolute",
          left: `${zone.rect.x * 100}%`,
          top: `${zone.rect.y * 100}%`,
          width: `${zone.rect.width * 100}%`,
          height: `${zone.rect.height * 100}%`,
          transform: zone.rect.rotation ? `rotate(${zone.rect.rotation}deg)` : undefined,
          display: "flex",
          alignItems: "flex-start",
          justifyContent: "flex-start",
          pointerEvents: "none",
        }}
      >
        {/* Compact FREI indicator — quiet, doesn't dominate */}
        <div
          style={{
            background: "rgba(10,16,28,0.55)",
            backdropFilter: "blur(4px)",
            borderRadius: "clamp(3px, 0.4vh, 6px)",
            padding: "clamp(2px, 0.3vh, 4px) clamp(4px, 0.5vw, 8px)",
            display: "flex",
            alignItems: "center",
            gap: "clamp(2px, 0.3vw, 5px)",
            border: "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <span
            style={{
              width: "clamp(4px, 0.5vh, 6px)",
              height: "clamp(4px, 0.5vh, 6px)",
              borderRadius: "50%",
              background: "rgba(74,222,128,0.5)",
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontSize: "clamp(5px, 0.65vh, 9px)",
              fontWeight: 600,
              letterSpacing: "0.14em",
              color: "rgba(74,222,128,0.65)",
              textTransform: "uppercase",
            }}
          >
            {zone.label ?? zone.resourceCode ?? "FREI"}
          </span>
          <span
            style={{
              fontSize: "clamp(4px, 0.55vh, 7px)",
              letterSpacing: "0.12em",
              color: "rgba(74,222,128,0.40)",
              textTransform: "uppercase",
            }}
          >
            FREI
          </span>
        </div>
      </div>
    );
  }

  if (!activeEvent) {
    return (
      <div
        style={{
          position: "absolute",
          left: `${zone.rect.x * 100}%`,
          top: `${zone.rect.y * 100}%`,
        }}
      />
    );
  }

  const tokens = activityTypeTokens(activeEvent.type, isCurrent);
  const startTime = fmtTime(activeEvent.startAt, tz);
  const endTime = activeEvent.endAt ? fmtTime(activeEvent.endAt, tz) : null;
  const primaryDr = activeEvent.dressingRooms[0];
  const resourceDisplay = zone.label ?? zone.resourceCode ?? "";

  return (
    <div
      data-testid={`resource-card-${isCurrent ? "current" : "next"}`}
      style={{
        position: "absolute",
        left: `${zone.rect.x * 100}%`,
        top: `${zone.rect.y * 100}%`,
        width: `${zone.rect.width * 100}%`,
        minWidth: "clamp(60px, 8vw, 140px)",
        transform: zone.rect.rotation ? `rotate(${zone.rect.rotation}deg)` : undefined,
        transformOrigin: "top left",
        pointerEvents: "none",
        zIndex: isCurrent ? 2 : 1,
      }}
    >
      <div
        style={{
          background: "rgba(8,14,26,0.88)",
          backdropFilter: "blur(8px)",
          borderRadius: "clamp(4px, 0.5vh, 8px)",
          border: `1px solid ${tokens.accentColor}40`,
          borderLeft: `3px solid ${tokens.accentColor}`,
          overflow: "hidden",
          boxShadow: isCurrent
            ? `0 2px 12px ${tokens.accentColor}22`
            : "0 1px 6px rgba(0,0,0,0.4)",
        }}
      >
        {/* Resource name + type badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "clamp(2px, 0.35vh, 5px) clamp(4px, 0.5vw, 8px)",
            background: "rgba(255,255,255,0.04)",
            gap: "0.4vw",
          }}
        >
          <span
            style={{
              fontSize: "clamp(6px, 0.8vh, 11px)",
              fontWeight: 700,
              letterSpacing: "0.10em",
              color: "rgba(255,255,255,0.85)",
              textTransform: "uppercase",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
            }}
          >
            {resourceDisplay}
          </span>
          <span
            style={{
              flexShrink: 0,
              fontSize: "clamp(4px, 0.6vh, 8px)",
              fontWeight: 700,
              letterSpacing: "0.10em",
              background: tokens.badgeBg,
              color: tokens.badgeColor,
              borderRadius: "clamp(2px, 0.3vh, 4px)",
              padding: "1px clamp(2px, 0.3vw, 5px)",
              textTransform: "uppercase",
            }}
          >
            {tokens.label}
          </span>
        </div>

        {/* Team name */}
        <div
          style={{
            padding: "clamp(2px, 0.3vh, 4px) clamp(4px, 0.5vw, 8px) 0",
          }}
        >
          <div
            style={{
              fontSize: "clamp(7px, 0.95vh, 13px)",
              fontWeight: isCurrent ? 700 : 500,
              color: isCurrent ? "#ffffff" : "rgba(255,255,255,0.70)",
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              letterSpacing: "0.02em",
            }}
          >
            {activeEvent.teamDisplayName ?? activeEvent.displayTitle}
          </div>

          {/* Time range */}
          <div
            style={{
              fontSize: "clamp(5px, 0.72vh, 10px)",
              color: "rgba(255,255,255,0.55)",
              marginTop: "clamp(1px, 0.15vh, 2px)",
              fontWeight: 600,
              letterSpacing: "0.04em",
            }}
          >
            {startTime}{endTime ? `–${endTime}` : ""}
          </div>

          {/* Dressing room */}
          {primaryDr && (
            <div
              style={{
                fontSize: "clamp(4px, 0.6vh, 8px)",
                color: "rgba(255,255,255,0.35)",
                marginTop: "clamp(1px, 0.12vh, 2px)",
                paddingBottom: "clamp(2px, 0.3vh, 4px)",
              }}
            >
              {primaryDr.displayLabel}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ── NextActivityRow (right-side rail) ─────────────────────────────────────────

function NextActivityRow({
  event,
  resourceLabel,
  tz,
}: {
  event: PitchEventSummary;
  resourceLabel: string;
  tz: string;
}): ReactElement {
  const tokens = activityTypeTokens(event.type, false);
  const startTime = fmtTime(event.startAt, tz);

  return (
    <div
      data-testid="next-activity-row"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "clamp(1px, 0.15vh, 2px)",
        padding: "clamp(3px, 0.4vh, 6px) clamp(4px, 0.5vw, 8px)",
        borderRadius: "clamp(3px, 0.4vh, 6px)",
        background: "rgba(255,255,255,0.03)",
        border: "1px solid rgba(255,255,255,0.06)",
        borderLeft: `2px solid ${tokens.accentColor}`,
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.4vw",
        }}
      >
        <span
          style={{
            fontSize: "clamp(7px, 0.9vh, 12px)",
            fontWeight: 700,
            color: "#ffffff",
            letterSpacing: "0.02em",
          }}
        >
          {startTime}
        </span>
        <span
          style={{
            fontSize: "clamp(4px, 0.6vh, 8px)",
            fontWeight: 700,
            letterSpacing: "0.10em",
            background: tokens.badgeBg,
            color: tokens.badgeColor,
            borderRadius: "clamp(2px, 0.3vh, 4px)",
            padding: "1px clamp(2px, 0.25vw, 4px)",
            textTransform: "uppercase",
            flexShrink: 0,
          }}
        >
          {tokens.label}
        </span>
      </div>
      <div
        style={{
          fontSize: "clamp(7px, 0.88vh, 12px)",
          fontWeight: 600,
          color: "rgba(255,255,255,0.85)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {event.teamDisplayName ?? event.displayTitle}
      </div>
      <div
        style={{
          fontSize: "clamp(5px, 0.65vh, 9px)",
          color: "rgba(255,255,255,0.40)",
          letterSpacing: "0.06em",
        }}
      >
        {resourceLabel}
      </div>
    </div>
  );
}

// ── FacilityMarker ────────────────────────────────────────────────────────────

function FacilityMarker({ marker }: { marker: MarkerElement }): ReactElement {
  return (
    <div
      data-testid="facility-marker"
      style={{
        position: "absolute",
        left: `${marker.rect.x * 100}%`,
        top: `${marker.rect.y * 100}%`,
        width: `${marker.rect.width * 100}%`,
        height: `${marker.rect.height * 100}%`,
        transform: marker.rect.rotation ? `rotate(${marker.rect.rotation}deg)` : undefined,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
        overflow: "visible",
      }}
    >
      <div
        style={{
          background: "rgba(8,14,26,0.80)",
          backdropFilter: "blur(6px)",
          borderRadius: "clamp(3px, 0.4vh, 7px)",
          padding: "clamp(2px, 0.3vh, 4px) clamp(4px, 0.5vw, 8px)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          border: "1px solid rgba(255,255,255,0.10)",
          gap: "1px",
          maxWidth: "100%",
        }}
      >
        <span style={{ fontSize: "clamp(8px, 1.1vh, 16px)", lineHeight: 1 }}>
          {MARKER_ICONS[marker.markerType]}
        </span>
        {marker.label && (
          <span
            style={{
              fontSize: "clamp(5px, 0.65vh, 9px)",
              color: "rgba(255,255,255,0.75)",
              fontWeight: 600,
              letterSpacing: "0.06em",
              whiteSpace: "nowrap",
              overflow: "hidden",
              textOverflow: "ellipsis",
              maxWidth: "100%",
              textAlign: "center",
            }}
          >
            {marker.label}
          </span>
        )}
      </div>
    </div>
  );
}

// ── DuBistHierMarker ──────────────────────────────────────────────────────────

function DuBistHierMarker({ marker }: { marker: MarkerElement }): ReactElement {
  return (
    <div
      data-testid="du-bist-hier-marker"
      style={{
        position: "absolute",
        left: `${marker.rect.x * 100}%`,
        top: `${marker.rect.y * 100}%`,
        width: `${marker.rect.width * 100}%`,
        height: `${marker.rect.height * 100}%`,
        transform: marker.rect.rotation ? `rotate(${marker.rect.rotation}deg)` : undefined,
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        pointerEvents: "none",
      }}
    >
      <div
        style={{
          background: "rgba(234,179,8,0.14)",
          borderRadius: "clamp(5px, 0.6vh, 10px)",
          padding: "clamp(3px, 0.4vh, 6px) clamp(6px, 0.8vw, 12px)",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          border: "2px solid rgba(234,179,8,0.75)",
          gap: "2px",
        }}
      >
        <span style={{ fontSize: "clamp(10px, 1.6vh, 22px)", lineHeight: 1 }}>📍</span>
        <span
          style={{
            fontSize: "clamp(6px, 0.85vh, 11px)",
            fontWeight: 800,
            letterSpacing: "0.14em",
            color: "#eab308",
            textAlign: "center",
            whiteSpace: "nowrap",
          }}
        >
          DU BIST HIER
        </span>
      </div>
    </div>
  );
}
