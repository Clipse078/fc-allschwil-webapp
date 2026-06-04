/**
 * lib/facilities/display-helpers.ts
 *
 * Canonical display-name helpers for pitch and dressing-room codes.
 *
 * Single source of truth for converting internal allocation codes to
 * human-readable labels. Used by the public InfoBoard feed, the kiosk
 * display components, and any future Admin → Facilities & Resources UI.
 *
 * All code-to-label mappings live here — never duplicate them in
 * feed formatters, display components, or admin pages.
 */

import { getPitchAllocationByCode } from "@/lib/facilities/pitches";
import { getDressingRoomByCode } from "@/lib/facilities/dressing-rooms";

/**
 * Returns the human-readable display label for a pitch allocation code.
 *
 * Uses the canonical FCA_PITCH_ALLOCATIONS registry as the source.
 * Falls back to null when no code is present or the code is unrecognised.
 *
 * @example
 *   getPitchDisplayLabel("STADION")        // "Stadion"
 *   getPitchDisplayLabel("KUNSTRASEN_2_A") // "Kunstrasen 2 A"
 *   getPitchDisplayLabel(null)             // null
 */
export function getPitchDisplayLabel(
  code: string | null | undefined,
): string | null {
  const allocation = getPitchAllocationByCode(code);
  return allocation?.websiteLabel ?? null;
}

/**
 * Returns the human-readable display label for a dressing-room code.
 *
 * Uses the canonical FCA_DRESSING_ROOMS registry as the source.
 * Falls back to null when no code is present or the code is unrecognised.
 *
 * @example
 *   getDressingRoomDisplayLabel("E1") // "E1"
 *   getDressingRoomDisplayLabel("O3") // "O3"
 *   getDressingRoomDisplayLabel(null) // null
 */
export function getDressingRoomDisplayLabel(
  code: string | null | undefined,
): string | null {
  const room = getDressingRoomByCode(code);
  return room?.label ?? null;
}

/**
 * Returns allocation display fields for an event — ready for public consumption.
 *
 * Converts raw DB codes to safe display labels. Returns null labels rather
 * than raw codes so internal identifiers are never leaked to public feeds.
 */
export function getEventAllocationDisplay(event: {
  type: string;
  pitchCode: string | null | undefined;
  homeDressingRoomCode: string | null | undefined;
  awayDressingRoomCode: string | null | undefined;
}): {
  pitchLabel: string | null;
  /** Dressing room for home team (matches) or the assigned team (training/tournament) */
  homeDressingRoomLabel: string | null;
  /** Dressing room for away team — only relevant for matches */
  awayDressingRoomLabel: string | null;
} {
  const pitchLabel = getPitchDisplayLabel(event.pitchCode);

  const isMatch = event.type === "MATCH";

  if (isMatch) {
    return {
      pitchLabel,
      homeDressingRoomLabel: getDressingRoomDisplayLabel(
        event.homeDressingRoomCode,
      ),
      awayDressingRoomLabel: getDressingRoomDisplayLabel(
        event.awayDressingRoomCode,
      ),
    };
  }

  // For TRAINING, TOURNAMENT, OTHER: use homeDressingRoomCode as the
  // primary dressing room for the team. awayDressingRoomCode is not
  // relevant outside of matches.
  return {
    pitchLabel,
    homeDressingRoomLabel: getDressingRoomDisplayLabel(
      event.homeDressingRoomCode,
    ),
    awayDressingRoomLabel: null,
  };
}
