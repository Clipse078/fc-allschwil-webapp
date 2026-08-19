/**
 * components/infoboard/screen2/screen2-acceptance-fixtures.ts
 *
 * PREVIEW-ONLY — deterministic scenario fixtures for the Screen 2
 * acceptance harness (/infoboard/screen-2-preview).
 *
 * MUST NOT be imported by production feed builders, API routes, or any
 * file reachable from the production runtime path.
 *
 * Each scenario provides a complete, self-contained AnlageplanLivePayload
 * built from static fixture data — no database queries required.
 *
 * Canonical facility layout modelled on the FCA Sportanlage Im Brüel:
 *   STADION     — one FULL_PITCH (code: "ACC-STADION")
 *   KUNSTRASEN 2 — FULL_PITCH + two HALF_PITCH (ACC-KR2, ACC-KR2-A, ACC-KR2-B)
 *   KUNSTRASEN 3 — FULL_PITCH + two HALF_PITCH (ACC-KR3, ACC-KR3-A, ACC-KR3-B)
 *
 * Exported:
 *   ACCEPTANCE_SCENARIOS_S2       — ordered scenario metadata
 *   getAcceptancePayloadS2()      — returns a complete AnlageplanLivePayload
 *   DEFAULT_SCENARIO_S2           — default scenario id
 *   ACCEPTANCE_CURRENT_TIME_ISO_S2
 */

import type { AnlageplanLivePayload } from "@/lib/publishing/infoboard/anlageplan-live-service";
import type { InfoboardScreen2Feed, PitchOccupancy, PitchEventSummary } from "@/lib/publishing/event-types";
import { emptyAnlageplanConfig } from "@/lib/infoboard/anlageplan-types";
import type { AnlageplanConfig } from "@/lib/infoboard/anlageplan-types";

// ── Preview constants ─────────────────────────────────────────────────────────

export const ACCEPTANCE_CURRENT_TIME_ISO_S2 = "2026-09-12T15:35:00.000Z" as const;

const PREVIEW_TENANT = {
  id: "tenant-preview-fca",
  key: "fc-allschwil",
  name: "FC Allschwil",
  timezone: "Europe/Zurich",
} as const;

// ── Scenario metadata ─────────────────────────────────────────────────────────

export type AcceptanceScenarioIdS2 =
  | "alles-frei"
  | "feld-a-training"
  | "feld-b-match"
  | "beide-frei"
  | "beide-belegt"
  | "turnier"
  | "mixed-anlage";

export type AcceptanceScenarioMetaS2 = {
  id: AcceptanceScenarioIdS2;
  label: string;
  description: string;
};

export const ACCEPTANCE_SCENARIOS_S2: readonly AcceptanceScenarioMetaS2[] = [
  {
    id: "alles-frei",
    label: "Alles frei",
    description: "STADION → FREI, KR2 → FREI, KR3 → FREI",
  },
  {
    id: "feld-a-training",
    label: "Feld A Training",
    description: "KR2 Feld A → TRAINING, KR2 Feld B → FREI",
  },
  {
    id: "feld-b-match",
    label: "Feld B Match",
    description: "KR2 Feld A → FREI, KR2 Feld B → MATCH",
  },
  {
    id: "beide-frei",
    label: "Beide frei",
    description: "KR2 Feld A + Feld B both free → renders as one full free pitch",
  },
  {
    id: "beide-belegt",
    label: "Beide belegt",
    description: "KR2 Feld A → TRAINING, KR2 Feld B → MATCH — both halves distinguishable",
  },
  {
    id: "turnier",
    label: "Turnier",
    description: "KR3 → TURNIER state",
  },
  {
    id: "mixed-anlage",
    label: "Mixed Anlage",
    description: "STADION → MATCH, KR2 A → TRAINING, KR2 B → FREI, KR3 → TURNIER",
  },
];

export const DEFAULT_SCENARIO_S2: AcceptanceScenarioIdS2 = "mixed-anlage";

// ── Canonical resource codes (match anlageplan zone resourceCodes) ──────────

const CODES = {
  STADION: "ACC-STADION",
  KR2: "ACC-KR2",
  KR2_A: "ACC-KR2-A",
  KR2_B: "ACC-KR2-B",
  KR3: "ACC-KR3",
  KR3_A: "ACC-KR3-A",
  KR3_B: "ACC-KR3-B",
} as const;

// ── Self-contained Anlageplan config ─────────────────────────────────────────
//
// Zone positions are chosen to give a clear 3-facility horizontal layout:
//   STADION occupies the left third
//   KUNSTRASEN 2 occupies the centre third (A top-half, B bottom-half)
//   KUNSTRASEN 3 occupies the right third  (A top-half, B bottom-half)
//
// Normalised coordinates (0..1 relative to 16:9 canvas).

export const ACCEPTANCE_ANLAGEPLAN_CONFIG: AnlageplanConfig = {
  version: 1,
  elements: [
    // ── STADION — full pitch ────────────────────────────────────────────
    {
      kind: "RESOURCE_ZONE",
      id: "z-stadion",
      rect: { x: 0.04, y: 0.05, width: 0.28, height: 0.88 },
      resourceCode: CODES.STADION,
      label: "STADION",
      zoneType: "FULL_PITCH",
      showNextActivity: true,
    },
    // ── KUNSTRASEN 2 — full (suppressed when halves active) ──────────
    {
      kind: "RESOURCE_ZONE",
      id: "z-kr2-full",
      rect: { x: 0.36, y: 0.05, width: 0.28, height: 0.88 },
      resourceCode: CODES.KR2,
      label: "KUNSTRASEN 2",
      zoneType: "FULL_PITCH",
      showNextActivity: true,
    },
    // ── KUNSTRASEN 2 — Feld A (top half) ────────────────────────────
    {
      kind: "RESOURCE_ZONE",
      id: "z-kr2-a",
      rect: { x: 0.36, y: 0.05, width: 0.28, height: 0.42 },
      resourceCode: CODES.KR2_A,
      label: "KUNSTRASEN 2 · FELD A",
      zoneType: "HALF_PITCH",
      showNextActivity: true,
    },
    // ── KUNSTRASEN 2 — Feld B (bottom half) ─────────────────────────
    {
      kind: "RESOURCE_ZONE",
      id: "z-kr2-b",
      rect: { x: 0.36, y: 0.51, width: 0.28, height: 0.42 },
      resourceCode: CODES.KR2_B,
      label: "KUNSTRASEN 2 · FELD B",
      zoneType: "HALF_PITCH",
      showNextActivity: true,
    },
    // ── KUNSTRASEN 3 — full (suppressed when halves active) ──────────
    {
      kind: "RESOURCE_ZONE",
      id: "z-kr3-full",
      rect: { x: 0.68, y: 0.05, width: 0.28, height: 0.88 },
      resourceCode: CODES.KR3,
      label: "KUNSTRASEN 3",
      zoneType: "FULL_PITCH",
      showNextActivity: true,
    },
    // ── KUNSTRASEN 3 — Feld A (top half) ────────────────────────────
    {
      kind: "RESOURCE_ZONE",
      id: "z-kr3-a",
      rect: { x: 0.68, y: 0.05, width: 0.28, height: 0.42 },
      resourceCode: CODES.KR3_A,
      label: "KUNSTRASEN 3 · FELD A",
      zoneType: "HALF_PITCH",
      showNextActivity: true,
    },
    // ── KUNSTRASEN 3 — Feld B (bottom half) ─────────────────────────
    {
      kind: "RESOURCE_ZONE",
      id: "z-kr3-b",
      rect: { x: 0.68, y: 0.51, width: 0.28, height: 0.42 },
      resourceCode: CODES.KR3_B,
      label: "KUNSTRASEN 3 · FELD B",
      zoneType: "HALF_PITCH",
      showNextActivity: true,
    },
  ],
};

// ── Pitch event helper ────────────────────────────────────────────────────────

function makeEvent(
  overrides: Omit<PitchEventSummary, "dressingRooms"> & { dressingRooms?: PitchEventSummary["dressingRooms"] },
): PitchEventSummary {
  return { dressingRooms: [], ...overrides };
}

// ── Base pitch templates (all FREE by default) ───────────────────────────────

function basePitch(
  code: string,
  displayLabel: string,
  facilityName: string,
  resourceType: "FULL_PITCH" | "HALF_PITCH",
): PitchOccupancy {
  return {
    code,
    displayLabel,
    facilityName,
    facilityId: `fac-${facilityName.toLowerCase().replace(/\s+/g, "-")}`,
    resourceType,
    state: "FREE_NOW",
    hasAllocationConflict: false,
    currentEvent: null,
    nextEvent: null,
  };
}

const BASE_PITCHES: readonly PitchOccupancy[] = [
  basePitch(CODES.STADION, "Stadion", "Stadion", "FULL_PITCH"),
  basePitch(CODES.KR2, "Kunstrasen 2", "Kunstrasen 2", "FULL_PITCH"),
  basePitch(CODES.KR2_A, "Feld A", "Kunstrasen 2", "HALF_PITCH"),
  basePitch(CODES.KR2_B, "Feld B", "Kunstrasen 2", "HALF_PITCH"),
  basePitch(CODES.KR3, "Kunstrasen 3", "Kunstrasen 3", "FULL_PITCH"),
  basePitch(CODES.KR3_A, "Feld A", "Kunstrasen 3", "HALF_PITCH"),
  basePitch(CODES.KR3_B, "Feld B", "Kunstrasen 3", "HALF_PITCH"),
];

// ── Reusable event instances ──────────────────────────────────────────────────

const STADION_MATCH = makeEvent({
  eventId: "acc-s2-match-stadion",
  displayTitle: "FC Allschwil C2 vs. FC Therwil C Gelb",
  teamDisplayName: "FC Allschwil C2",
  opponentDisplayName: "FC Therwil C Gelb",
  startAt: "2026-09-12T15:00:00.000Z",
  endAt: "2026-09-12T16:45:00.000Z",
  status: "LIVE",
  type: "MATCH",
  temporalRelation: "current",
});

const KR2_A_TRAINING = makeEvent({
  eventId: "acc-s2-training-kr2-a",
  displayTitle: "Junioren F2",
  teamDisplayName: "FC Allschwil Junioren F2",
  opponentDisplayName: null,
  startAt: "2026-09-12T15:00:00.000Z",
  endAt: "2026-09-12T16:30:00.000Z",
  status: "LIVE",
  type: "TRAINING",
  temporalRelation: "current",
});

const KR2_B_MATCH = makeEvent({
  eventId: "acc-s2-match-kr2-b",
  displayTitle: "FC Allschwil E1 vs. FC Binningen E1",
  teamDisplayName: "FC Allschwil E1",
  opponentDisplayName: "FC Binningen E1",
  startAt: "2026-09-12T15:00:00.000Z",
  endAt: "2026-09-12T16:45:00.000Z",
  status: "LIVE",
  type: "MATCH",
  temporalRelation: "current",
});

const KR3_TOURNAMENT = makeEvent({
  eventId: "acc-s2-turnier-kr3",
  displayTitle: "Kinderfussball E-Junioren Turnier",
  teamDisplayName: "FC Allschwil Junioren E",
  opponentDisplayName: null,
  startAt: "2026-09-12T15:00:00.000Z",
  endAt: "2026-09-12T17:00:00.000Z",
  status: "LIVE",
  type: "TOURNAMENT",
  temporalRelation: "current",
});

// ── Occupancy overlay builders ────────────────────────────────────────────────

type PitchOverride = Partial<Pick<PitchOccupancy, "state" | "currentEvent" | "nextEvent">>;

function applyOverrides(
  pitches: readonly PitchOccupancy[],
  overrides: Partial<Record<string, PitchOverride>>,
): PitchOccupancy[] {
  return pitches.map((pitch) => {
    const override = overrides[pitch.code];
    if (!override) return pitch;
    return {
      ...pitch,
      state: override.state ?? pitch.state,
      currentEvent: override.currentEvent !== undefined ? override.currentEvent : pitch.currentEvent,
      nextEvent: override.nextEvent !== undefined ? override.nextEvent : pitch.nextEvent,
    };
  });
}

function makeOccupied(event: PitchEventSummary): PitchOverride {
  return { state: "OCCUPIED_NOW", currentEvent: event };
}

// ── Scenario feed builders ────────────────────────────────────────────────────

function makeFeed(pitches: PitchOccupancy[]): InfoboardScreen2Feed {
  return {
    generatedAt: ACCEPTANCE_CURRENT_TIME_ISO_S2,
    tenant: PREVIEW_TENANT,
    displayDate: "2026-09-12",
    isStale: false,
    facilityName: "Sportanlage Im Brüel",
    pitches,
    dressingRooms: [],
    unallocated: [],
  };
}

// Scenario feeds

function buildAllesFrei(): InfoboardScreen2Feed {
  return makeFeed([...BASE_PITCHES]);
}

function buildFeldATraining(): InfoboardScreen2Feed {
  return makeFeed(
    applyOverrides([...BASE_PITCHES], {
      [CODES.KR2_A]: makeOccupied(KR2_A_TRAINING),
    }),
  );
}

function buildFeldBMatch(): InfoboardScreen2Feed {
  return makeFeed(
    applyOverrides([...BASE_PITCHES], {
      [CODES.KR2_B]: makeOccupied(KR2_B_MATCH),
    }),
  );
}

function buildBeideFrei(): InfoboardScreen2Feed {
  // Feld A and Feld B are both free.
  // groupFacilityPitches() should show KR2 as one full free pitch.
  return makeFeed([...BASE_PITCHES]);
}

function buildBeideBeleg(): InfoboardScreen2Feed {
  return makeFeed(
    applyOverrides([...BASE_PITCHES], {
      [CODES.KR2_A]: makeOccupied(KR2_A_TRAINING),
      [CODES.KR2_B]: makeOccupied(KR2_B_MATCH),
    }),
  );
}

function buildTurnier(): InfoboardScreen2Feed {
  return makeFeed(
    applyOverrides([...BASE_PITCHES], {
      [CODES.KR3]: makeOccupied(KR3_TOURNAMENT),
    }),
  );
}

function buildMixedAnlage(): InfoboardScreen2Feed {
  return makeFeed(
    applyOverrides([...BASE_PITCHES], {
      [CODES.STADION]: makeOccupied(STADION_MATCH),
      [CODES.KR2_A]: makeOccupied(KR2_A_TRAINING),
      // KR2_B remains FREE
      [CODES.KR3]: makeOccupied(KR3_TOURNAMENT),
    }),
  );
}

// ── Payload factory ───────────────────────────────────────────────────────────

function buildPayload(feed: InfoboardScreen2Feed): AnlageplanLivePayload {
  return {
    screen2: {
      feed,
      branding: {
        clubLogoSrc: "/images/logos/fc-allschwil.png",
        productLogoSrc: "/images/branding/sportclubevo_logo.png",
      },
      currentTimeIso: ACCEPTANCE_CURRENT_TIME_ISO_S2,
      theme: "DARK",
    },
    anlageplanConfig: ACCEPTANCE_ANLAGEPLAN_CONFIG,
    backgroundUrl: null,
    backgroundTransform: {
      scale: 1,
      offsetX: 0,
      offsetY: 0,
    },
    currentTimeIso: ACCEPTANCE_CURRENT_TIME_ISO_S2,
  };
}

/**
 * Returns a complete AnlageplanLivePayload for the given scenario.
 * Falls back to DEFAULT_SCENARIO_S2 when scenarioId is unknown.
 */
export function getAcceptancePayloadS2(
  scenarioId: string | null | undefined,
): AnlageplanLivePayload {
  switch (scenarioId) {
    case "alles-frei":
      return buildPayload(buildAllesFrei());
    case "feld-a-training":
      return buildPayload(buildFeldATraining());
    case "feld-b-match":
      return buildPayload(buildFeldBMatch());
    case "beide-frei":
      return buildPayload(buildBeideFrei());
    case "beide-belegt":
      return buildPayload(buildBeideBeleg());
    case "turnier":
      return buildPayload(buildTurnier());
    case "mixed-anlage":
      return buildPayload(buildMixedAnlage());
    default:
      return buildPayload(buildMixedAnlage());
  }
}

// ── Allowed simplified activity statuses ────────────────────────────────────

/**
 * The only activity status labels that must appear on the Anlageplan.
 * No detailed event metadata, kickoff times, or team names should appear
 * as primary orientation content.
 */
export const ANLAGEPLAN_ALLOWED_STATUSES = [
  "FREI",
  "TRAINING",
  "MATCH",
  "TURNIER",
] as const;

export type AnlageplanActivityStatus = (typeof ANLAGEPLAN_ALLOWED_STATUSES)[number];
