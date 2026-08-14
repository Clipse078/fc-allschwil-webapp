/**
 * components/infoboard/anlageplan/AnlageplanMapElements.tsx
 *
 * INFOBOARD-MAP-02-C3 — Shared canonical map element rendering components.
 *
 * Exports:
 *   PremiumResourceCard   — activity card anchored to a resource zone
 *   NextActivityRow       — compact row for the NÄCHSTE AKTIVITÄTEN rail
 *   FacilityMarker        — icon+label pill for facility amenities (S/M/L/XL)
 *   DuBistHierMarker      — highlighted "Du bist hier" locator (S/M/L/XL)
 *   fmtTime               — locale time formatter
 *   activityTypeTokens    — visual token resolver for TRAINING/MATCH/TOURNAMENT
 *
 * Visual hierarchy on TV displays (from most to least dominant):
 *   1. team/event name (large, high-contrast, no truncation)
 *   2. pitch/resource label + activity-type badge
 *   3. time
 *   4. supporting metadata (dressing room, etc.)
 *
 * These components are used by:
 *   InfoboardAnlageplan (public kiosk, with live PitchOccupancy)
 *   AnlageplanMapScene (shared scene, supports null occupancy → FREI state)
 *
 * Invariants:
 *   - Pure server components — no "use client", no effects, no fetch
 *   - No Prisma, no DB access
 *   - No new Date() without argument
 *   - null / undefined never rendered as strings
 */

import type { ReactElement } from "react";
import type { PitchOccupancy, PitchEventSummary } from "@/lib/publishing/event-types";
import type { ResourceZoneElement, MarkerElement } from "@/lib/infoboard/anlageplan-types";
import { MARKER_ICONS, MARKER_SIZE_PRESETS, defaultMarkerSize } from "@/lib/infoboard/anlageplan-types";

// ── Time formatting ───────────────────────────────────────────────────────────

export function fmtTime(isoString: string, tz: string): string {
  return new Intl.DateTimeFormat("de-CH", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: tz,
    hour12: false,
  }).format(new Date(isoString));
}

// ── Activity type visual tokens ───────────────────────────────────────────────

export type ActivityTypeTokens = {
  label: string;
  accentColor: string;
  accentBg: string;
  badgeBg: string;
  badgeColor: string;
};

export function activityTypeTokens(type: string, isCurrent: boolean): ActivityTypeTokens {
  switch (type) {
    case "MATCH":
      return {
        label: "SPIEL",
        accentColor: isCurrent ? "#f87171" : "#ef4444",
        accentBg: isCurrent ? "rgba(239,68,68,0.18)" : "rgba(239,68,68,0.08)",
        badgeBg: "rgba(239,68,68,0.25)",
        badgeColor: "#fca5a5",
      };
    case "TOURNAMENT":
      return {
        label: "TURNIER",
        accentColor: isCurrent ? "#fbbf24" : "#f59e0b",
        accentBg: isCurrent ? "rgba(245,158,11,0.18)" : "rgba(245,158,11,0.08)",
        badgeBg: "rgba(245,158,11,0.25)",
        badgeColor: "#fde68a",
      };
    case "TRAINING":
    default:
      return {
        label: "TRAINING",
        accentColor: isCurrent ? "#60a5fa" : "#3b82f6",
        accentBg: isCurrent ? "rgba(59,130,246,0.18)" : "rgba(59,130,246,0.08)",
        badgeBg: "rgba(59,130,246,0.25)",
        badgeColor: "#93c5fd",
      };
  }
}

// ── Display name resolution helper ────────────────────────────────────────────

/**
 * Resolves the visitor-facing display name for a team/event.
 * Checks displayNameOverrides first (keyed by canonical teamDisplayName or displayTitle),
 * falls back to canonical name when no override is configured or override is empty.
 */
function resolveDisplayName(
  canonical: string,
  displayNameOverrides?: Record<string, string> | null,
): string {
  if (displayNameOverrides && canonical) {
    const override = displayNameOverrides[canonical];
    if (override && override.trim().length > 0) return override.trim();
  }
  return canonical;
}

// ── PremiumResourceCard ───────────────────────────────────────────────────────

/**
 * Dominant operational card anchored to a resource zone.
 *
 * Visual priority:
 *   1. team/event name — largest, highest contrast, no aggressive truncation
 *   2. pitch label + activity-type badge
 *   3. time range
 *   4. dressing room (subtlest)
 *
 * Current events visually outrank free-resource cards.
 * Supports zone.backgroundColor / zone.textColor overrides.
 * Supports displayNameOverrides for team name presentation.
 * PUBLIC: never shows editor geometry.
 */
export function PremiumResourceCard({
  zone,
  occupancy,
  tz,
  displayNameOverrides,
}: {
  zone: ResourceZoneElement;
  occupancy: PitchOccupancy | null;
  tz: string;
  displayNameOverrides?: Record<string, string> | null;
}): ReactElement {
  const hasCurrent = occupancy?.currentEvent != null;
  const hasNext = zone.showNextActivity && occupancy?.nextEvent != null && !hasCurrent;
  const isFree = !hasCurrent && !hasNext;

  const activeEvent = occupancy?.currentEvent ?? occupancy?.nextEvent;
  const isCurrent = hasCurrent;

  const customBg = zone.backgroundColor?.trim() || null;
  const customText = zone.textColor?.trim() || null;

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
        <div
          style={{
            background: customBg ?? "rgba(10,16,28,0.72)",
            backdropFilter: customBg ? undefined : "blur(6px)",
            borderRadius: "clamp(5px, 0.6vh, 10px)",
            padding: "clamp(5px, 0.65vh, 9px) clamp(8px, 1.0vw, 16px)",
            display: "flex",
            alignItems: "center",
            gap: "clamp(4px, 0.5vw, 8px)",
            border: customBg ? `1px solid ${customBg}` : "1px solid rgba(74,222,128,0.18)",
          }}
        >
          <span
            style={{
              width: "clamp(6px, 0.8vh, 10px)",
              height: "clamp(6px, 0.8vh, 10px)",
              borderRadius: "50%",
              background: customText ?? "rgba(74,222,128,0.60)",
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontSize: "clamp(9px, 1.1vh, 15px)",
              fontWeight: 700,
              letterSpacing: "0.12em",
              color: customText ?? "rgba(74,222,128,0.80)",
              textTransform: "uppercase",
              whiteSpace: "nowrap",
            }}
          >
            {zone.label ?? zone.resourceCode ?? "FREI"}
          </span>
          <span
            style={{
              fontSize: "clamp(8px, 1.0vh, 13px)",
              letterSpacing: "0.10em",
              color: customText ? `${customText}99` : "rgba(74,222,128,0.50)",
              textTransform: "uppercase",
              fontWeight: 600,
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

  const canonicalName = activeEvent.teamDisplayName ?? activeEvent.displayTitle;
  const teamLabel = resolveDisplayName(canonicalName, displayNameOverrides);

  return (
    <div
      data-testid={`resource-card-${isCurrent ? "current" : "next"}`}
      style={{
        position: "absolute",
        left: `${zone.rect.x * 100}%`,
        top: `${zone.rect.y * 100}%`,
        width: `${zone.rect.width * 100}%`,
        minWidth: "clamp(80px, 10vw, 200px)",
        transform: zone.rect.rotation ? `rotate(${zone.rect.rotation}deg)` : undefined,
        transformOrigin: "top left",
        pointerEvents: "none",
        zIndex: isCurrent ? 2 : 1,
      }}
    >
      <div
        style={{
          background: customBg ?? (isCurrent ? "rgba(6,12,22,0.95)" : "rgba(8,14,26,0.88)"),
          backdropFilter: customBg ? undefined : "blur(10px)",
          borderRadius: "clamp(6px, 0.75vh, 12px)",
          border: customBg
            ? `1px solid ${customBg}`
            : `1px solid ${tokens.accentColor}50`,
          borderLeft: `4px solid ${tokens.accentColor}`,
          overflow: "hidden",
          boxShadow: isCurrent
            ? `0 3px 20px ${tokens.accentColor}30`
            : "0 2px 10px rgba(0,0,0,0.5)",
        }}
      >
        {/* Resource name + type badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "clamp(4px, 0.55vh, 8px) clamp(6px, 0.8vw, 12px)",
            background: customBg ? "rgba(0,0,0,0.20)" : "rgba(255,255,255,0.05)",
            gap: "0.5vw",
          }}
        >
          <span
            style={{
              fontSize: "clamp(9px, 1.15vh, 16px)",
              fontWeight: 800,
              letterSpacing: "0.10em",
              color: customText ?? "rgba(255,255,255,0.90)",
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
              fontSize: "clamp(6px, 0.78vh, 11px)",
              fontWeight: 700,
              letterSpacing: "0.10em",
              background: tokens.badgeBg,
              color: tokens.badgeColor,
              borderRadius: "clamp(2px, 0.3vh, 5px)",
              padding: "2px clamp(3px, 0.4vw, 6px)",
              textTransform: "uppercase",
            }}
          >
            {tokens.label}
          </span>
        </div>

        {/* Team name — DOMINANT */}
        <div
          style={{
            padding: "clamp(5px, 0.65vh, 9px) clamp(6px, 0.8vw, 12px) 0",
          }}
        >
          <div
            style={{
              fontSize: "clamp(11px, 1.45vh, 20px)",
              fontWeight: isCurrent ? 800 : 600,
              color: customText ?? (isCurrent ? "#ffffff" : "rgba(255,255,255,0.75)"),
              overflowWrap: "break-word",
              wordBreak: "break-word",
              lineHeight: 1.2,
              letterSpacing: "0.01em",
            }}
          >
            {teamLabel}
          </div>

          {/* Time */}
          <div
            style={{
              fontSize: "clamp(8px, 1.05vh, 14px)",
              color: customText ? `${customText}bb` : "rgba(255,255,255,0.65)",
              marginTop: "clamp(2px, 0.25vh, 4px)",
              fontWeight: 600,
              letterSpacing: "0.05em",
              fontVariantNumeric: "tabular-nums",
            }}
          >
            {startTime}{endTime ? `–${endTime}` : ""}
          </div>

          {/* Dressing room (subtlest) */}
          {primaryDr && (
            <div
              style={{
                fontSize: "clamp(6px, 0.78vh, 10px)",
                color: customText ? `${customText}77` : "rgba(255,255,255,0.38)",
                marginTop: "clamp(1px, 0.15vh, 3px)",
                paddingBottom: "clamp(4px, 0.55vh, 7px)",
                letterSpacing: "0.03em",
              }}
            >
              {primaryDr.displayLabel}
            </div>
          )}
          {!primaryDr && (
            <div style={{ paddingBottom: "clamp(4px, 0.55vh, 7px)" }} />
          )}
        </div>
      </div>
    </div>
  );
}

// ── NextActivityRow (right-side activity rail) ────────────────────────────────

/**
 * Readable next-activity rail row — designed for 25–30% width panel.
 * Visual priority: time → team name → pitch resource.
 * Prefer 2–4 highly readable items over 5 tiny ones.
 */
export function NextActivityRow({
  event,
  resourceLabel,
  tz,
  displayNameOverrides,
}: {
  event: PitchEventSummary;
  resourceLabel: string;
  tz: string;
  displayNameOverrides?: Record<string, string> | null;
}): ReactElement {
  const tokens = activityTypeTokens(event.type, false);
  const startTime = fmtTime(event.startAt, tz);
  const canonicalName = event.teamDisplayName ?? event.displayTitle;
  const teamLabel = resolveDisplayName(canonicalName, displayNameOverrides);

  return (
    <div
      data-testid="next-activity-row"
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "clamp(2px, 0.25vh, 4px)",
        padding: "clamp(6px, 0.8vh, 11px) clamp(8px, 1.0vw, 14px)",
        borderRadius: "clamp(5px, 0.65vh, 10px)",
        background: "rgba(255,255,255,0.05)",
        border: "1px solid rgba(255,255,255,0.09)",
        borderLeft: `3px solid ${tokens.accentColor}`,
        overflow: "hidden",
        flexShrink: 0,
      }}
    >
      {/* Time + badge row */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          justifyContent: "space-between",
          gap: "0.5vw",
        }}
      >
        <span
          style={{
            fontSize: "clamp(10px, 1.3vh, 18px)",
            fontWeight: 800,
            color: "#ffffff",
            letterSpacing: "0.03em",
            fontVariantNumeric: "tabular-nums",
          }}
        >
          {startTime}
        </span>
        <span
          style={{
            fontSize: "clamp(6px, 0.78vh, 10px)",
            fontWeight: 700,
            letterSpacing: "0.10em",
            background: tokens.badgeBg,
            color: tokens.badgeColor,
            borderRadius: "clamp(2px, 0.3vh, 5px)",
            padding: "2px clamp(3px, 0.35vw, 5px)",
            textTransform: "uppercase",
            flexShrink: 0,
          }}
        >
          {tokens.label}
        </span>
      </div>

      {/* Team name — dominant */}
      <div
        style={{
          fontSize: "clamp(10px, 1.3vh, 18px)",
          fontWeight: 700,
          color: "rgba(255,255,255,0.95)",
          overflowWrap: "break-word",
          wordBreak: "break-word",
          lineHeight: 1.2,
        }}
      >
        {teamLabel}
      </div>

      {/* Pitch resource */}
      <div
        style={{
          fontSize: "clamp(7px, 0.9vh, 12px)",
          color: "rgba(255,255,255,0.50)",
          letterSpacing: "0.06em",
          fontWeight: 500,
        }}
      >
        {resourceLabel}
      </div>
    </div>
  );
}

// ── FacilityMarker ────────────────────────────────────────────────────────────

export function FacilityMarker({ marker }: { marker: MarkerElement }): ReactElement {
  const size = MARKER_SIZE_PRESETS[marker.markerSize ?? defaultMarkerSize()];
  const customBg = marker.backgroundColor?.trim() || null;
  const customText = marker.textColor?.trim() || null;

  return (
    <div
      data-testid="facility-marker"
      data-marker-size={marker.markerSize ?? defaultMarkerSize()}
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
          background: customBg ?? "rgba(8,14,26,0.82)",
          backdropFilter: customBg ? undefined : "blur(6px)",
          borderRadius: size.borderRadiusVh,
          padding: `${size.paddingVh} ${size.paddingVw}`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          border: customBg
            ? `1px solid ${customBg}`
            : "1px solid rgba(255,255,255,0.12)",
          gap: size.gap,
          maxWidth: "100%",
        }}
      >
        <span style={{ fontSize: size.iconVh, lineHeight: 1 }}>
          {MARKER_ICONS[marker.markerType]}
        </span>
        {marker.label && (
          <span
            style={{
              fontSize: size.labelVh,
              color: customText ?? "rgba(255,255,255,0.80)",
              fontWeight: 700,
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

export function DuBistHierMarker({ marker }: { marker: MarkerElement }): ReactElement {
  const size = MARKER_SIZE_PRESETS[marker.markerSize ?? defaultMarkerSize()];
  const customBg = marker.backgroundColor?.trim() || null;
  const customText = marker.textColor?.trim() || null;

  return (
    <div
      data-testid="du-bist-hier-marker"
      data-marker-size={marker.markerSize ?? defaultMarkerSize()}
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
          background: customBg ?? "rgba(234,179,8,0.14)",
          borderRadius: size.borderRadiusVh,
          padding: `${size.paddingVh} ${size.paddingVw}`,
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          border: customBg
            ? `2px solid ${customBg}`
            : "2px solid rgba(234,179,8,0.80)",
          gap: size.gap,
        }}
      >
        <span style={{ fontSize: size.iconVh, lineHeight: 1 }}>📍</span>
        <span
          style={{
            fontSize: size.labelVh,
            fontWeight: 800,
            letterSpacing: "0.14em",
            color: customText ?? "#eab308",
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
