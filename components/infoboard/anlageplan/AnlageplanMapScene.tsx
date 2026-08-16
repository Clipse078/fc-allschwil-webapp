/**
 * components/infoboard/anlageplan/AnlageplanMapScene.tsx
 *
 * INFOBOARD-MAP-02-C1 — Shared canonical map scene rendering.
 *
 * Renders the full facility map scene inside an absolute-positioned
 * transform container:
 *   background image (zoom/pan transform) +
 *   resource zone overlays (FREI or live) +
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
  /**
   * Resource codes that the canonical hierarchy resolver has determined should
   * NOT be rendered in the public kiosk view. Zones whose resourceCode is in
   * this set are completely omitted — they are not shown as FREI.
   *
   * Populated by groupFacilityPitches() in InfoboardAnlageplan.
   * Must be empty/absent in the designer path so admins can see all zones.
   */
  suppressedCodes?: ReadonlySet<string> | null;
  /** Tenant timezone — required for event time formatting. Defaults to "UTC". */
  timezone?: string;
  /** Optional richer public-kiosk card body. Default false preserves canonical compact rendering. */
  richEventCards?: boolean;
};

// ── Component ─────────────────────────────────────────────────────────────────

export function AnlageplanMapScene({
  config,
  backgroundUrl,
  bgTransform,
  pitchMap,
  suppressedCodes,
  timezone = "UTC",
  richEventCards = false,
}: AnlageplanMapSceneProps): ReactElement {
  // Apply hierarchy suppression — zones for suppressed codes are completely
  // omitted (not even shown as FREI) because the canonical resolver has
  // determined they should not appear in the current hierarchy state.
  // suppressedCodes is empty/absent in the designer path.
  const allZones = config.elements.filter(isResourceZone) as ResourceZoneElement[];
  const zones = suppressedCodes && suppressedCodes.size > 0
    ? allZones.filter((z) => z.resourceCode == null || !suppressedCodes.has(z.resourceCode))
    : allZones;
  const markers = config.elements.filter(
    (e): e is MarkerElement => isMarker(e) && !isDuBistHier(e),
  );
  const duBistHierEl = config.elements.find(isDuBistHier) as MarkerElement | undefined;

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

        {/* Resource zones → PremiumResourceCard (FREI when no live occupancy) */}
        {zones.map((zone) => {
          const occupancy = pitchMap?.get(zone.resourceCode ?? "") ?? null;
          return (
            <PremiumResourceCard
              key={zone.id}
              zone={zone}
              occupancy={occupancy}
              tz={timezone}
              richEventCards={richEventCards}
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
