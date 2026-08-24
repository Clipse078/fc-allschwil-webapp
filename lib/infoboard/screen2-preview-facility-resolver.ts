/**
 * lib/infoboard/screen2-preview-facility-resolver.ts
 *
 * Deterministic facility identity resolution for the Screen-2 physical-TV
 * preview overlay (/infoboard/screen-2-preview).
 *
 * Matches by stable FacilityResource.code — never display-name fuzzy matching.
 * Unrelated FULL_PITCH resources (e.g. HALLE_1) are never considered.
 */

import type { PitchOccupancy } from "@/lib/publishing/event-types";

export type Screen2PreviewFacilities = {
  readonly hauptfeldFull: PitchOccupancy;
  readonly hauptfeldHalfA: PitchOccupancy;
  readonly hauptfeldHalfB: PitchOccupancy;
  readonly kr2Full: PitchOccupancy;
  readonly kr2HalfA: PitchOccupancy;
  readonly kr2HalfB: PitchOccupancy;
  readonly kr3Full: PitchOccupancy;
  readonly kr3HalfA: PitchOccupancy;
  readonly kr3HalfB: PitchOccupancy;
};

type CodeSlot = {
  readonly description: string;
  readonly primaryCodes: readonly string[];
  readonly legacyCodes?: readonly string[];
  readonly resourceType: "FULL_PITCH" | "HALF_PITCH";
};

function formatAvailable(pitches: readonly PitchOccupancy[]): string {
  return pitches
    .map(
      (pitch) =>
        `${pitch.code} | ${pitch.displayLabel ?? ""} | ${pitch.resourceType}`,
    )
    .join("; ");
}

function matchesCode(
  pitch: PitchOccupancy,
  code: string,
  resourceType: CodeSlot["resourceType"],
): boolean {
  return pitch.code === code && pitch.resourceType === resourceType;
}

function findByCodes(
  pitches: readonly PitchOccupancy[],
  codes: readonly string[],
  resourceType: CodeSlot["resourceType"],
): PitchOccupancy[] {
  return pitches.filter((pitch) =>
    codes.some((code) => matchesCode(pitch, code, resourceType)),
  );
}

function resolveSlot(
  pitches: readonly PitchOccupancy[],
  slot: CodeSlot,
): PitchOccupancy {
  const { description, primaryCodes, legacyCodes = [], resourceType } = slot;

  const primaryMatches = findByCodes(pitches, primaryCodes, resourceType);
  const legacyMatches = findByCodes(pitches, legacyCodes, resourceType);

  if (primaryMatches.length > 1) {
    throw new Error(
      `Screen-2 preview expected exactly one ${description}; found ${primaryMatches.length} canonical matches. ` +
        `Available: ${formatAvailable(pitches)}`,
    );
  }

  if (primaryMatches.length === 1) {
    if (legacyMatches.length > 0) {
      throw new Error(
        `Screen-2 preview found ambiguous ${description}: both canonical (${primaryCodes.join(", ")}) and legacy (${legacyCodes.join(", ")}) identities are present. ` +
          `Available: ${formatAvailable(pitches)}`,
      );
    }
    return primaryMatches[0];
  }

  if (legacyMatches.length > 1) {
    throw new Error(
      `Screen-2 preview expected exactly one ${description}; found ${legacyMatches.length} legacy matches. ` +
        `Available: ${formatAvailable(pitches)}`,
    );
  }

  if (legacyMatches.length === 1) {
    return legacyMatches[0];
  }

  throw new Error(
    `Screen-2 preview expected exactly one ${description}; found 0. ` +
      `Expected canonical code(s): ${primaryCodes.join(", ")}` +
      (legacyCodes.length > 0
        ? ` (legacy fallback: ${legacyCodes.join(", ")})`
        : "") +
      `. Available: ${formatAvailable(pitches)}`,
  );
}

/**
 * Resolves the nine Screen-2 preview facility slots from the tenant's real
 * pitch inventory. Throws with a diagnostic when a required slot cannot be
 * resolved deterministically.
 */
export function resolveScreen2PreviewFacilities(
  pitches: readonly PitchOccupancy[],
): Screen2PreviewFacilities {
  return {
    hauptfeldFull: resolveSlot(pitches, {
      description: "Hauptfeld FULL_PITCH",
      primaryCodes: ["HAUPTFELD"],
      legacyCodes: ["STADION"],
      resourceType: "FULL_PITCH",
    }),
    hauptfeldHalfA: resolveSlot(pitches, {
      description: "Hauptfeld Feld A",
      primaryCodes: ["HAUPTFELD A", "HAUPTFELD_A"],
      legacyCodes: ["STADION_A"],
      resourceType: "HALF_PITCH",
    }),
    hauptfeldHalfB: resolveSlot(pitches, {
      description: "Hauptfeld Feld B",
      primaryCodes: ["HAUPTFELD B", "HAUPTFELD_B"],
      legacyCodes: ["STADION_B"],
      resourceType: "HALF_PITCH",
    }),
    kr2Full: resolveSlot(pitches, {
      description: "KR2 FULL_PITCH",
      primaryCodes: ["KUNSTRASEN_2"],
      resourceType: "FULL_PITCH",
    }),
    kr2HalfA: resolveSlot(pitches, {
      description: "KR2 Feld A",
      primaryCodes: ["KUNSTRASEN_2_A"],
      resourceType: "HALF_PITCH",
    }),
    kr2HalfB: resolveSlot(pitches, {
      description: "KR2 Feld B",
      primaryCodes: ["KUNSTRASEN_2_B"],
      resourceType: "HALF_PITCH",
    }),
    kr3Full: resolveSlot(pitches, {
      description: "KR3 FULL_PITCH",
      primaryCodes: ["KUNSTRASEN_3"],
      resourceType: "FULL_PITCH",
    }),
    kr3HalfA: resolveSlot(pitches, {
      description: "KR3 Feld A",
      primaryCodes: ["KUNSTRASEN_3_A"],
      resourceType: "HALF_PITCH",
    }),
    kr3HalfB: resolveSlot(pitches, {
      description: "KR3 Feld B",
      primaryCodes: ["KUNSTRASEN_3_B"],
      resourceType: "HALF_PITCH",
    }),
  };
}
