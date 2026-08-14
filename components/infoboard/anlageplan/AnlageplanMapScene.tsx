/**
 * components/infoboard/anlageplan/AnlageplanMapScene.tsx
 *
 * INFOBOARD-MAP-02-C3 — Shared canonical map scene rendering.
 *
 * Renders the full facility map scene inside an absolute-positioned
 * transform container:
 *   background image (zoom/pan transform) +
 *   resource zone overlays (FREI or live, with FULL/HALF_PITCH suppression) +
 *   facility markers +
 *   du-bist-hier marker
 *
 * Parent must be `position: relative; overflow: hidden` to clip the scene.
 *
 * Used by BOTH:
 *   InfoboardAnlageplan  — public kiosk, with live PitchOccupancy data
 *   AnlageplanConfigPreview — overview thumbnail, no live data (FREI state)
 *
 * Invariant: the same config + backgroundUrl + bgTransform produce identical
 * visual output in DESIGNER / PUBLIC KIOSK / OVERVIEW PREVIEW.
 *
 * ── FULL_PITCH / HALF_PITCH suppression ──────────────────────────────────────
 *
 * For each facility that has BOTH a FULL_PITCH zone AND HALF_PITCH zones
 * configured, only one level of the hierarchy is rendered at a time —
 * never simultaneously:
 *
 *   All half-pitches free   → show FULL_PITCH only (in FREI state)
 *   FULL_PITCH occupied     → show FULL_PITCH only (in event state)
 *   Any half-pitch occupied → show HALF_PITCH zones only
 *   All half-pitches occupied → show all HALF_PITCH zones only
 *
 * Suppression is DERIVED from live allocation state — it is never stored
 * as admin configuration and never requires a manual toggle.
 * When pitchMap is absent (config-preview / designer) no suppression applies.
 *
 * No "use client" — pure presentational server component.
 * No Prisma, no DB, no new Date() without argument.
 */

import type { ReactElement } from "react";
import type { PitchOccupancy } from "@/lib/publishing/event-types";
import type {
  AnlageplanConfig,
  ResourceZoneElement,
  MarkerElement,
  BackgroundTransform,
} from "@/lib/infoboard/anlageplan-types";
import {
  isResourceZone,
  isMarker,
  isDuBistHier,
} from "@/lib/infoboard/anlageplan-types";
import {
  PremiumResourceCard,
  FacilityMarker,
  DuBistHierMarker,
} from "./AnlageplanMapElements";

// ── Props ─────────────────────────────────────────────────────────────────────

export type AnlageplanMapSceneProps = {
  config: AnlageplanConfig;
  backgroundUrl: string | null;
  bgTransform: BackgroundTransform;
  /**
   * Live pitch occupancy keyed by resourceCode.
   * When null/undefined all zones render in FREI (neutral) state — no
   * fabricated activity data is shown.
   */
  pitchMap?: Map<string, PitchOccupancy> | null;
  /** Tenant timezone — required for event time formatting. Defaults to "UTC". */
  timezone?: string;
  /**
   * Infoboard-scoped display name overrides passed through from AnlageplanConfig.
   * Keyed by canonical teamDisplayName / displayTitle; value is the override label.
   */
  displayNameOverrides?: Record<string, string> | null;
};

// ── FULL_PITCH / HALF_PITCH suppression ───────────────────────────────────────

/**
 * Derives the set of resource codes that must be suppressed based on the
 * FULL_PITCH / HALF_PITCH hierarchy rules.
 *
 * For each facility that has both FULL_PITCH and HALF_PITCH zones configured:
 *   - If ANY half-pitch zone has a live current or next event
 *     → suppress all FULL_PITCH zones for that facility
 *   - Otherwise (all half-pitches free or upcoming-only below threshold)
 *     → suppress all HALF_PITCH zones for that facility
 *
 * Facility grouping is resolved via PitchOccupancy.facilityName so that
 * hierarchy is derived from canonical resource data, not from hardcoded names.
 *
 * When pitchMap is absent or empty, returns an empty set (no suppression).
 */
export function deriveSuppressedCodes(
  zones: readonly ResourceZoneElement[],
  pitchMap: Map<string, PitchOccupancy> | null | undefined,
): ReadonlySet<string> {
  if (!pitchMap || pitchMap.size === 0) return new Set<string>();

  // Build facility groups: facilityName → { fullPitch zones, halfPitch zones }
  const facilityGroups = new Map<
    string,
    { fullPitch: ResourceZoneElement[]; halfPitch: ResourceZoneElement[] }
  >();

  for (const zone of zones) {
    if (!zone.resourceCode) continue;
    const occ = pitchMap.get(zone.resourceCode);
    if (!occ) continue;

    const facName = occ.facilityName;
    if (!facilityGroups.has(facName)) {
      facilityGroups.set(facName, { fullPitch: [], halfPitch: [] });
    }
    const group = facilityGroups.get(facName)!;
    if (zone.zoneType === "FULL_PITCH") {
      group.fullPitch.push(zone);
    } else {
      group.halfPitch.push(zone);
    }
  }

  const suppressed = new Set<string>();

  for (const [, group] of facilityGroups) {
    // Only apply hierarchy suppression when BOTH levels are configured
    if (group.fullPitch.length === 0 || group.halfPitch.length === 0) continue;

    // Any half-pitch has a current or next event?
    const anyHalfOccupied = group.halfPitch.some((z) => {
      const occ = pitchMap.get(z.resourceCode ?? "");
      return occ !== undefined && (occ.currentEvent !== null || occ.nextEvent !== null);
    });

    if (anyHalfOccupied) {
      // Subdivisions are active → suppress the full-pitch zone(s)
      for (const z of group.fullPitch) {
        if (z.resourceCode) suppressed.add(z.resourceCode);
      }
    } else {
      // Full pitch or nothing active → suppress the half-pitch zone(s)
      for (const z of group.halfPitch) {
        if (z.resourceCode) suppressed.add(z.resourceCode);
      }
    }
  }

  return suppressed;
}

// ── Component ─────────────────────────────────────────────────────────────────

export function AnlageplanMapScene({
  config,
  backgroundUrl,
  bgTransform,
  pitchMap,
  timezone = "UTC",
  displayNameOverrides,
}: AnlageplanMapSceneProps): ReactElement {
  const zones = config.elements.filter(isResourceZone) as ResourceZoneElement[];
  const markers = config.elements.filter(
    (e): e is MarkerElement => isMarker(e) && !isDuBistHier(e),
  );
  const duBistHierEl = config.elements.find(isDuBistHier) as MarkerElement | undefined;

  // Derive suppressed codes (FULL_PITCH / HALF_PITCH mutual exclusion)
  const suppressedCodes = deriveSuppressedCodes(zones, pitchMap);

  // Visible zones: exclude the suppressed side of the hierarchy
  const visibleZones = zones.filter(
    (z) => !z.resourceCode || !suppressedCodes.has(z.resourceCode),
  );

  return (
    <>
      {/* Empty state overlay (no background) */}
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
       * Shared map scene container — background image + all overlays live
       * inside this transform so that zoom/pan keeps zones visually aligned
       * with the image. Designer and kiosk use the identical transform.
       */}
      <div
        data-testid="anlageplan-map-scene"
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

        {/* Resource zones → PremiumResourceCard (hierarchy-suppressed, FREI when no occupancy) */}
        {visibleZones.map((zone) => {
          const occupancy = pitchMap?.get(zone.resourceCode ?? "") ?? null;
          return (
            <PremiumResourceCard
              key={zone.id}
              zone={zone}
              occupancy={occupancy}
              tz={timezone}
              displayNameOverrides={displayNameOverrides}
            />
          );
        })}

        {/* Facility markers */}
        {markers.map((marker) => (
          <FacilityMarker key={marker.id} marker={marker} />
        ))}

        {/* Du bist hier */}
        {duBistHierEl && <DuBistHierMarker marker={duBistHierEl} />}
      </div>
    </>
  );
}
