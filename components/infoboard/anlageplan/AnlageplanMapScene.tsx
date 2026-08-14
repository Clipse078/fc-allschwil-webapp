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
  /** Tenant timezone — required for event time formatting. Defaults to "UTC". */
  timezone?: string;
  /**
   * Set of resourceCodes that must NOT render any card — determined by the
   * INFOBOARD-UX-03 full-pitch/subdivision hierarchy rules.
   * A zone whose resourceCode is in this set is silently skipped, ensuring
   * FULL_PITCH and HALF_PITCH are never rendered simultaneously.
   */
  suppressedCodes?: ReadonlySet<string>;
};

// ── Component ─────────────────────────────────────────────────────────────────

export function AnlageplanMapScene({
  config,
  backgroundUrl,
  bgTransform,
  pitchMap,
  timezone = "UTC",
  suppressedCodes,
}: AnlageplanMapSceneProps): ReactElement {
  const zones = config.elements.filter(isResourceZone) as ResourceZoneElement[];
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
        {/* Zones whose resourceCode is in suppressedCodes are skipped entirely  */}
        {/* (INFOBOARD-UX-03: never render FULL_PITCH + HALF_PITCH simultaneously) */}
        {zones.map((zone) => {
          if (suppressedCodes?.has(zone.resourceCode ?? "")) return null;
          const occupancy = pitchMap?.get(zone.resourceCode ?? "") ?? null;
          return (
            <PremiumResourceCard
              key={zone.id}
              zone={zone}
              occupancy={occupancy}
              tz={timezone}
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
