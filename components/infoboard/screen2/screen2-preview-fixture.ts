/**
 * components/infoboard/screen2/screen2-preview-fixture.ts
 *
 * Deterministic preview fixture for Infoboard Screen 2.
 *
 * PREVIEW-ONLY — must never be imported by production feed builders or
 * API routes.
 *
 * Scenario (INFOBOARD-INTEGRATION-01C): Same display date as Screen 1
 * preview (2026-09-12). The Brüelstadion facility has 4 pitches:
 *   - Stadion: OCCUPIED (HOME match FC Allschwil E1 – JETZT)
 *   - Kunstrasen 1: OCCUPIED (Training Juniorinnen FF-14 JETZT) + DANACH
 *     (FC Allschwil D1 Training) — demonstrates current + next together.
 *   - Kunstrasen 2: FREE
 *   - Kunstrasen 3: UPCOMING (Tournament Sommer-Cup Junioren E, DANACH only)
 *
 * Dressing rooms:
 *   - Kabine E1: FC Allschwil E1 (home side of the Stadion match)
 *   - Kabine E2: FC Binningen E1 (away side of the Stadion match)
 *   - Kabine E3: FREI
 *
 * Unallocated:
 *   - one eligible training with no pitch allocation ("Nicht zugeteilt").
 *
 * Weather fixture data is non-production sample data for visual preview.
 * Rendered compactly in the header (INFOBOARD-INTEGRATION-01C-C1) — there is
 * no standalone weather panel or sponsor section in the current layout.
 */

import type {
  InfoboardScreen2Feed,
  PitchEventSummary,
} from "@/lib/publishing/event-types";
import type { WeatherDto } from "@/lib/weather/weather-types";

// ── Shared tenant reference ───────────────────────────────────────────────────

const PREVIEW_TENANT_S2 = {
  id: "tenant-preview-fca",
  key: "fc-allschwil",
  name: "FC Allschwil",
  timezone: "Europe/Zurich",
} as const;

const UNALLOCATED_ACTIVITY: PitchEventSummary = {
  eventId: "evt-unallocated-1",
  displayTitle: "Aktive Herren",
  teamDisplayName: "Aktive Herren",
  opponentDisplayName: null,
  startAt: "2026-09-12T18:00:00.000Z",
  endAt: "2026-09-12T19:30:00.000Z",
  status: "SCHEDULED",
  type: "TRAINING",
  temporalRelation: "next",
  dressingRooms: [],
};

// ── Main Screen 2 preview fixture ─────────────────────────────────────────────

export const PREVIEW_FIXTURE_SCREEN2: InfoboardScreen2Feed = {
  generatedAt: "2026-09-12T15:35:00.000Z",
  tenant: PREVIEW_TENANT_S2,
  displayDate: "2026-09-12",
  isStale: false,
  facilityName: "Brüelstadion",

  pitches: [
    {
      code: "P-STADION",
      displayLabel: "Stadion",
      facilityName: "Brüelstadion",
      facilityId: "fac-brueel",
      resourceType: "FULL_PITCH",
      state: "OCCUPIED_NOW",
      hasAllocationConflict: false,
      currentEvent: {
        eventId: "evt-1",
        displayTitle: "FC Allschwil E1 – FC Binningen E1",
        teamDisplayName: "FC Allschwil E1",
        opponentDisplayName: "FC Binningen E1",
        startAt: "2026-09-12T15:00:00.000Z",
        endAt: "2026-09-12T16:45:00.000Z",
        status: "LIVE",
        type: "MATCH",
        temporalRelation: "current",
        dressingRooms: [],
      },
      nextEvent: null,
    },
    {
      code: "P-KR1",
      displayLabel: "Kunstrasen 1",
      facilityName: "Brüelstadion",
      facilityId: "fac-brueel",
      resourceType: "FULL_PITCH",
      state: "OCCUPIED_NOW",
      hasAllocationConflict: false,
      currentEvent: {
        eventId: "evt-2",
        displayTitle: "Juniorinnen FF-14",
        teamDisplayName: "Juniorinnen FF-14",
        opponentDisplayName: null,
        startAt: "2026-09-12T15:00:00.000Z",
        endAt: "2026-09-12T16:00:00.000Z",
        status: "LIVE",
        type: "TRAINING",
        temporalRelation: "current",
        dressingRooms: [],
      },
      nextEvent: {
        eventId: "evt-2b",
        displayTitle: "FC Allschwil D1",
        teamDisplayName: "FC Allschwil D1",
        opponentDisplayName: null,
        startAt: "2026-09-12T16:30:00.000Z",
        endAt: "2026-09-12T18:00:00.000Z",
        status: "SCHEDULED",
        type: "TRAINING",
        temporalRelation: "next",
        dressingRooms: [],
      },
    },
    {
      code: "P-KR2",
      displayLabel: "Kunstrasen 2",
      facilityName: "Brüelstadion",
      facilityId: "fac-brueel",
      resourceType: "FULL_PITCH",
      state: "FREE_NOW",
      hasAllocationConflict: false,
      currentEvent: null,
      nextEvent: null,
    },
    {
      code: "P-KR3",
      displayLabel: "Kunstrasen 3",
      facilityName: "Brüelstadion",
      facilityId: "fac-brueel",
      resourceType: "FULL_PITCH",
      state: "UPCOMING",
      hasAllocationConflict: false,
      currentEvent: null,
      nextEvent: {
        eventId: "evt-3",
        displayTitle: "Sommer-Cup Junioren E",
        teamDisplayName: "FC Allschwil Junioren",
        opponentDisplayName: null,
        startAt: "2026-09-12T17:00:00.000Z",
        endAt: null,
        status: "SCHEDULED",
        type: "TOURNAMENT",
        temporalRelation: "next",
        dressingRooms: [],
      },
    },
  ],

  dressingRooms: [
    {
      code: "DR-E1",
      displayLabel: "Kabine E1",
      state: "OCCUPIED_NOW",
      current: {
        code: "DR-E1",
        displayLabel: "Kabine E1",
        role: "HOME",
        assignedTo: "FC Allschwil E1",
        eventId: "evt-1",
      },
      next: null,
    },
    {
      code: "DR-E2",
      displayLabel: "Kabine E2",
      state: "OCCUPIED_NOW",
      current: {
        code: "DR-E2",
        displayLabel: "Kabine E2",
        role: "AWAY",
        assignedTo: "FC Binningen E1",
        eventId: "evt-1",
      },
      next: null,
    },
    {
      code: "DR-E3",
      displayLabel: "Kabine E3",
      state: "FREE_NOW",
      current: null,
      next: null,
    },
  ],

  unallocated: [UNALLOCATED_ACTIVITY],
};

// ── All-free fixture ──────────────────────────────────────────────────────────

export const PREVIEW_FIXTURE_SCREEN2_ALL_FREE: InfoboardScreen2Feed = {
  ...PREVIEW_FIXTURE_SCREEN2,
  pitches: PREVIEW_FIXTURE_SCREEN2.pitches.map((p) => ({
    ...p,
    state: "FREE_NOW" as const,
    currentEvent: null,
    nextEvent: null,
  })),
  dressingRooms: PREVIEW_FIXTURE_SCREEN2.dressingRooms.map((r) => ({
    ...r,
    state: "FREE_NOW" as const,
    current: null,
    next: null,
  })),
  unallocated: [],
};

/** Current-time ISO for Screen 2 preview (same as Screen 1). */
export const PREVIEW_CURRENT_TIME_ISO_S2 = "2026-09-12T15:35:00.000Z" as const;

/**
 * Sample weather data for Screen 2 preview.
 *
 * NON-PRODUCTION — represents a representative September afternoon in Allschwil.
 * This data is for visual preview only and must never be used in production routes.
 */
export const PREVIEW_WEATHER: WeatherDto = {
  isAvailable: true,
  temperatureC: 22,
  conditionCode: 2,
  conditionLabel: "Teilweise bewölkt",
  windKmh: 6,
  precipitationProbability: null,
  observedAt: "2026-09-12T15:30:00Z",
};

// ── All-occupied fixture ──────────────────────────────────────────────────────

export const PREVIEW_FIXTURE_SCREEN2_ALL_OCCUPIED: InfoboardScreen2Feed = {
  ...PREVIEW_FIXTURE_SCREEN2,
  pitches: [
    {
      code: "P-STADION",
      displayLabel: "Stadion",
      facilityName: "Brüelstadion",
      facilityId: "fac-brueel",
      resourceType: "FULL_PITCH",
      state: "OCCUPIED_NOW",
      hasAllocationConflict: false,
      currentEvent: {
        eventId: "evt-ao-1",
        displayTitle: "FC Allschwil E1 – FC Binningen E1",
        teamDisplayName: "FC Allschwil E1",
        opponentDisplayName: "FC Binningen E1",
        startAt: "2026-09-12T15:00:00.000Z",
        endAt: "2026-09-12T16:45:00.000Z",
        status: "LIVE",
        type: "MATCH",
        temporalRelation: "current",
        dressingRooms: [],
      },
      nextEvent: null,
    },
    {
      code: "P-KR1",
      displayLabel: "Kunstrasen 1",
      facilityName: "Brüelstadion",
      facilityId: "fac-brueel",
      resourceType: "FULL_PITCH",
      state: "OCCUPIED_NOW",
      hasAllocationConflict: false,
      currentEvent: {
        eventId: "evt-ao-2",
        displayTitle: "Juniorinnen FF-14",
        teamDisplayName: "Juniorinnen FF-14",
        opponentDisplayName: null,
        startAt: "2026-09-12T14:00:00.000Z",
        endAt: null,
        status: "LIVE",
        type: "TRAINING",
        temporalRelation: "current",
        dressingRooms: [],
      },
      nextEvent: null,
    },
    {
      code: "P-KR2",
      displayLabel: "Kunstrasen 2",
      facilityName: "Brüelstadion",
      facilityId: "fac-brueel",
      resourceType: "FULL_PITCH",
      state: "OCCUPIED_NOW",
      hasAllocationConflict: false,
      currentEvent: {
        eventId: "evt-ao-3",
        displayTitle: "Sommer-Cup Junioren E",
        teamDisplayName: "FC Allschwil Junioren",
        opponentDisplayName: null,
        startAt: "2026-09-12T14:30:00.000Z",
        endAt: null,
        status: "LIVE",
        type: "TOURNAMENT",
        temporalRelation: "current",
        dressingRooms: [],
      },
      nextEvent: null,
    },
    {
      code: "P-KR3",
      displayLabel: "Kunstrasen 3",
      facilityName: "Brüelstadion",
      facilityId: "fac-brueel",
      resourceType: "FULL_PITCH",
      state: "OCCUPIED_NOW",
      hasAllocationConflict: false,
      currentEvent: {
        eventId: "evt-ao-4",
        displayTitle: "Aktive Herren",
        teamDisplayName: "Aktive Herren",
        opponentDisplayName: null,
        startAt: "2026-09-12T15:00:00.000Z",
        endAt: null,
        status: "LIVE",
        type: "TRAINING",
        temporalRelation: "current",
        dressingRooms: [],
      },
      nextEvent: null,
    },
  ],
  dressingRooms: [
    {
      code: "DR-E1",
      displayLabel: "Kabine E1",
      state: "OCCUPIED_NOW",
      current: {
        code: "DR-E1",
        displayLabel: "Kabine E1",
        role: "HOME",
        assignedTo: "FC Allschwil E1",
        eventId: "evt-ao-1",
      },
      next: null,
    },
    {
      code: "DR-E2",
      displayLabel: "Kabine E2",
      state: "OCCUPIED_NOW",
      current: {
        code: "DR-E2",
        displayLabel: "Kabine E2",
        role: "AWAY",
        assignedTo: "FC Binningen E1",
        eventId: "evt-ao-1",
      },
      next: null,
    },
    {
      code: "DR-E3",
      displayLabel: "Kabine E3",
      state: "OCCUPIED_NOW",
      current: {
        code: "DR-E3",
        displayLabel: "Kabine E3",
        role: "TRAINING",
        assignedTo: "Aktive Herren",
        eventId: "evt-ao-4",
      },
      next: null,
    },
  ],
  unallocated: [],
};

/**
 * Physical-TV regression fixture.
 *
 * Exercises the canonical FULL_PITCH / HALF_PITCH hierarchy:
 *
 *   Stadion -> MATCH on FULL_PITCH
 *
 *   KR2
 *     FULL resource exists but is free
 *     A = TRAINING on HALF_PITCH
 *     B = free HALF_PITCH
 *
 *   KR3
 *     FULL resource exists but is free
 *     A = free HALF_PITCH
 *     B = TOURNAMENT on HALF_PITCH
 *
 * groupFacilityPitches() must therefore:
 *   - show Stadion FULL
 *   - suppress KR2 FULL and show A/B halves
 *   - suppress KR3 FULL and show A/B halves
 *
 * PREVIEW ONLY.
 */
export const PREVIEW_FIXTURE_SCREEN2_PHYSICAL_TV: InfoboardScreen2Feed = {
  generatedAt: "2026-09-12T15:35:00.000Z",
  tenant: PREVIEW_TENANT_S2,
  displayDate: "2026-09-12",
  isStale: false,
  facilityName: "Sportanlage Im Brüel",

  pitches: [
    // -------------------------------------------------------
    // STADION — FULL PITCH MATCH
    // -------------------------------------------------------
    {
      code: "P-STADION",
      displayLabel: "Stadion",
      facilityName: "Stadion",
      facilityId: "physical-stadion",
      resourceType: "FULL_PITCH",
      state: "OCCUPIED_NOW",
      hasAllocationConflict: false,
      currentEvent: {
        eventId: "tv-match-stadion",
        displayTitle: "FC Allschwil E1 – FC Binningen E1",
        teamDisplayName: "FC Allschwil E1",
        opponentDisplayName: "FC Binningen E1",
        startAt: "2026-09-12T15:00:00.000Z",
        endAt: "2026-09-12T16:45:00.000Z",
        status: "LIVE",
        type: "MATCH",
        temporalRelation: "current",
        dressingRooms: [],
      },
      nextEvent: null,
    },

    // -------------------------------------------------------
    // KR2 — FULL + TWO HALVES
    // A occupied by Training.
    // Canonical hierarchy must suppress the FULL representation.
    // -------------------------------------------------------
    {
      code: "P-KR2",
      displayLabel: "KR2",
      facilityName: "Kunstrasen 2",
      facilityId: "physical-kr2",
      resourceType: "FULL_PITCH",
      state: "FREE_NOW",
      hasAllocationConflict: false,
      currentEvent: null,
      nextEvent: null,
    },
    {
      code: "P-KR2-A",
      displayLabel: "KR2 A",
      facilityName: "Kunstrasen 2",
      facilityId: "physical-kr2",
      resourceType: "HALF_PITCH",
      state: "OCCUPIED_NOW",
      hasAllocationConflict: false,
      currentEvent: {
        eventId: "tv-training-kr2-a",
        displayTitle: "FC Allschwil F2",
        teamDisplayName: "FC Allschwil F2",
        opponentDisplayName: null,
        startAt: "2026-09-12T15:00:00.000Z",
        endAt: "2026-09-12T16:30:00.000Z",
        status: "LIVE",
        type: "TRAINING",
        temporalRelation: "current",
        dressingRooms: [],
      },
      nextEvent: null,
    },
    {
      code: "P-KR2-B",
      displayLabel: "KR2 B",
      facilityName: "Kunstrasen 2",
      facilityId: "physical-kr2",
      resourceType: "HALF_PITCH",
      state: "FREE_NOW",
      hasAllocationConflict: false,
      currentEvent: null,
      nextEvent: null,
    },

    // -------------------------------------------------------
    // KR3 — FULL + TWO HALVES
    // B occupied by Tournament.
    // Canonical hierarchy must suppress the FULL representation.
    // -------------------------------------------------------
    {
      code: "P-KR3",
      displayLabel: "KR3",
      facilityName: "Kunstrasen 3",
      facilityId: "physical-kr3",
      resourceType: "FULL_PITCH",
      state: "FREE_NOW",
      hasAllocationConflict: false,
      currentEvent: null,
      nextEvent: null,
    },
    {
      code: "P-KR3-A",
      displayLabel: "KR3 A",
      facilityName: "Kunstrasen 3",
      facilityId: "physical-kr3",
      resourceType: "HALF_PITCH",
      state: "FREE_NOW",
      hasAllocationConflict: false,
      currentEvent: null,
      nextEvent: null,
    },
    {
      code: "P-KR3-B",
      displayLabel: "KR3 B",
      facilityName: "Kunstrasen 3",
      facilityId: "physical-kr3",
      resourceType: "HALF_PITCH",
      state: "OCCUPIED_NOW",
      hasAllocationConflict: false,
      currentEvent: {
        eventId: "tv-tournament-kr3-b",
        displayTitle: "Junioren F Play More Football",
        teamDisplayName: "FC Allschwil Junioren F",
        opponentDisplayName: null,
        startAt: "2026-09-12T15:00:00.000Z",
        endAt: "2026-09-12T17:00:00.000Z",
        status: "LIVE",
        type: "TOURNAMENT",
        temporalRelation: "current",
        dressingRooms: [],
      },
      nextEvent: null,
    },
  ],

  dressingRooms: [],
  unallocated: [],
};
