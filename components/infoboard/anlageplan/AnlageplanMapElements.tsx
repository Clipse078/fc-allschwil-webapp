/**
 * components/infoboard/anlageplan/AnlageplanMapElements.tsx
 *
 * INFOBOARD-MAP-02-C2 — Shared canonical map element rendering components.
 *
 * Exports:
 *   PremiumResourceCard   — activity card anchored to a resource zone
 *   NextActivityRow       — compact row for the NÄCHSTE AKTIVITÄTEN rail
 *   FacilityMarker        — compact icon+label pill for facility amenities
 *   DuBistHierMarker      — highlighted "Du bist hier" locator
 *   fmtTime               — locale time formatter
 *   activityTypeTokens    — visual token resolver for TRAINING/MATCH/TOURNAMENT
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
 * Compact dark operational card anchored to a resource zone.
 * Shows current or next activity (or FREI state when occupancy is null).
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
            background: customBg ?? "rgba(10,16,28,0.55)",
            backdropFilter: customBg ? undefined : "blur(4px)",
            borderRadius: "clamp(3px, 0.4vh, 6px)",
            padding: "clamp(3px, 0.45vh, 6px) clamp(5px, 0.65vw, 10px)",
            display: "flex",
            alignItems: "center",
            gap: "clamp(2px, 0.3vw, 5px)",
            border: customBg ? `1px solid ${customBg}` : "1px solid rgba(255,255,255,0.06)",
          }}
        >
          <span
            style={{
              width: "clamp(5px, 0.65vh, 8px)",
              height: "clamp(5px, 0.65vh, 8px)",
              borderRadius: "50%",
              background: customText ?? "rgba(74,222,128,0.5)",
              flexShrink: 0,
            }}
          />
          <span
            style={{
              fontSize: "clamp(7px, 0.85vh, 12px)",
              fontWeight: 700,
              letterSpacing: "0.14em",
              color: customText ?? "rgba(74,222,128,0.65)",
              textTransform: "uppercase",
            }}
          >
            {zone.label ?? zone.resourceCode ?? "FREI"}
          </span>
          <span
            style={{
              fontSize: "clamp(5px, 0.7vh, 9px)",
              letterSpacing: "0.12em",
              color: customText ? `${customText}99` : "rgba(74,222,128,0.40)",
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
        minWidth: "clamp(70px, 9vw, 160px)",
        transform: zone.rect.rotation ? `rotate(${zone.rect.rotation}deg)` : undefined,
        transformOrigin: "top left",
        pointerEvents: "none",
        zIndex: isCurrent ? 2 : 1,
      }}
    >
      <div
        style={{
          background: customBg ?? "rgba(8,14,26,0.88)",
          backdropFilter: customBg ? undefined : "blur(8px)",
          borderRadius: "clamp(5px, 0.65vh, 10px)",
          border: customBg
            ? `1px solid ${customBg}`
            : `1px solid ${tokens.accentColor}40`,
          borderLeft: `3px solid ${tokens.accentColor}`,
          overflow: "hidden",
          boxShadow: isCurrent
            ? `0 2px 16px ${tokens.accentColor}28`
            : "0 1px 8px rgba(0,0,0,0.4)",
        }}
      >
        {/* Resource name + type badge */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            padding: "clamp(3px, 0.45vh, 6px) clamp(5px, 0.65vw, 10px)",
            background: customBg ? "rgba(0,0,0,0.15)" : "rgba(255,255,255,0.04)",
            gap: "0.4vw",
          }}
        >
          <span
            style={{
              fontSize: "clamp(7px, 0.95vh, 13px)",
              fontWeight: 700,
              letterSpacing: "0.10em",
              color: customText ?? "rgba(255,255,255,0.85)",
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
              fontSize: "clamp(5px, 0.7vh, 9px)",
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

        {/* Team name + time + dressing room */}
        <div
          style={{
            padding: "clamp(3px, 0.4vh, 5px) clamp(5px, 0.65vw, 10px) 0",
          }}
        >
          <div
            style={{
              fontSize: "clamp(9px, 1.15vh, 16px)",
              fontWeight: isCurrent ? 700 : 500,
              color: customText ?? (isCurrent ? "#ffffff" : "rgba(255,255,255,0.70)"),
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
              letterSpacing: "0.02em",
            }}
          >
            {teamLabel}
          </div>
          <div
            style={{
              fontSize: "clamp(6px, 0.85vh, 12px)",
              color: customText ? `${customText}99` : "rgba(255,255,255,0.55)",
              marginTop: "clamp(1px, 0.15vh, 2px)",
              fontWeight: 600,
              letterSpacing: "0.04em",
            }}
          >
            {startTime}{endTime ? `–${endTime}` : ""}
          </div>
          {primaryDr && (
            <div
              style={{
                fontSize: "clamp(5px, 0.7vh, 9px)",
                color: customText ? `${customText}66` : "rgba(255,255,255,0.35)",
                marginTop: "clamp(1px, 0.12vh, 2px)",
                paddingBottom: "clamp(3px, 0.4vh, 5px)",
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

// ── NextActivityRow (right-side activity rail) ────────────────────────────────

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
        gap: "clamp(1px, 0.15vh, 2px)",
        padding: "clamp(4px, 0.55vh, 8px) clamp(5px, 0.65vw, 10px)",
        borderRadius: "clamp(4px, 0.5vh, 8px)",
        background: "rgba(255,255,255,0.04)",
        border: "1px solid rgba(255,255,255,0.08)",
        borderLeft: `3px solid ${tokens.accentColor}`,
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
            fontSize: "clamp(8px, 1.05vh, 14px)",
            fontWeight: 700,
            color: "#ffffff",
            letterSpacing: "0.02em",
          }}
        >
          {startTime}
        </span>
        <span
          style={{
            fontSize: "clamp(5px, 0.7vh, 9px)",
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
          fontSize: "clamp(8px, 1.05vh, 14px)",
          fontWeight: 600,
          color: "rgba(255,255,255,0.90)",
          overflow: "hidden",
          textOverflow: "ellipsis",
          whiteSpace: "nowrap",
        }}
      >
        {teamLabel}
      </div>
      <div
        style={{
          fontSize: "clamp(6px, 0.75vh, 10px)",
          color: "rgba(255,255,255,0.45)",
          letterSpacing: "0.06em",
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
