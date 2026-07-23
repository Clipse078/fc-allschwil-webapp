/**
 * components/infoboard/screen1/screen1-preview-fixture.ts
 *
 * Deterministic preview fixture for Infoboard Screen 1.
 *
 * PREVIEW-ONLY — must never be imported by production feed builders or API
 * routes. All timestamps are fixed UTC ISO-8601 strings.
 *
 * Fixed display date: 2026-09-12 (Saturday, Europe/Zurich = UTC+2 in summer).
 * Tenant timezone: "Europe/Zurich".
 * Generated at:     2026-09-12T08:30:00.000Z  →  10:30 Zurich
 *
 * Zurich offset (+2h in summer):
 *   08:00Z → 10:00 Zurich
 *   08:30Z → 10:30 Zurich
 *   09:00Z → 11:00 Zurich
 *   11:00Z → 13:00 Zurich
 *   12:00Z → 14:00 Zurich
 *   13:30Z → 15:30 Zurich
 *
 * Referee dressing-room labels are retained in the DTO fields where the
 * existing data requires them, but Screen 1 does not render them.
 */

import type { InfoboardScreen1Feed } from "@/lib/publishing/event-types";
import type {
  InfoboardAnnouncementPresentation,
  InfoboardEventPresentationExtension,
} from "./screen1-presentation-types";

// ── Shared tenant reference ───────────────────────────────────────────────────

const PREVIEW_TENANT = {
  id: "tenant-preview-fca",
  key: "fc-allschwil",
  name: "FC Allschwil",
  timezone: "Europe/Zurich",
} as const;

// ── Main preview fixture ──────────────────────────────────────────────────────

export const PREVIEW_FIXTURE: InfoboardScreen1Feed = {
  generatedAt: "2026-09-12T08:30:00.000Z",
  tenant: PREVIEW_TENANT,
  displayDate: "2026-09-12",
  isStale: false,
  wochenplanVariantBadge: null,

  // ── CURRENT — events ongoing at 10:30 Zurich ─────────────────────────────
  current: [
    {
      id: "evt-cur-1",
      type: "TRAINING",
      displayTitle: "U12 Training",
      teamDisplayName: "FC Allschwil U12",
      opponentDisplayName: null,
      organizerDisplayName: null,
      competitionLabel: null,
      startAt: "2026-09-12T08:00:00.000Z",
      endAt: "2026-09-12T09:30:00.000Z",
      meetingTime: null,
      status: "LIVE",
      resultLabel: null,
      intermediateResultLabel: null,
      temporalBucket: "current",
      seasonKey: "2026-27",
      allocation: {
        pitchLabel: "Platz 1",
        homeDressingRoomLabel: "Kabine A",
        awayDressingRoomLabel: null,
        refereeDressingRoomLabel: null,
      },
    },
    {
      id: "evt-cur-2",
      type: "MATCH",
      displayTitle: "FC Allschwil E1 – FC Binningen E1",
      teamDisplayName: "FC Allschwil E1",
      opponentDisplayName: "FC Binningen E1",
      organizerDisplayName: null,
      competitionLabel: "Meisterschaft 3. Liga",
      startAt: "2026-09-12T08:00:00.000Z",
      endAt: "2026-09-12T09:45:00.000Z",
      meetingTime: "2026-09-12T07:30:00.000Z",
      status: "LIVE",
      resultLabel: null,
      intermediateResultLabel: "1:0",
      temporalBucket: "current",
      seasonKey: "2026-27",
      allocation: {
        pitchLabel: "Stadion",
        homeDressingRoomLabel: "Kabine E1",
        awayDressingRoomLabel: "Kabine E2",
        // refereeDressingRoomLabel is retained in the DTO but not rendered on Screen 1
        refereeDressingRoomLabel: "Kabine E3",
      },
    },
  ],

  // ── NEXT — two simultaneous events at 11:00 Zurich (09:00Z) ──────────────
  next: [
    {
      id: "evt-nxt-1",
      type: "TOURNAMENT",
      displayTitle: "FC Allschwil Sommer-Cup Junioren 2026",
      teamDisplayName: "FC Allschwil Junioren",
      opponentDisplayName: null,
      organizerDisplayName: "FC Allschwil",
      competitionLabel: "Sommer-Cup",
      startAt: "2026-09-12T09:00:00.000Z",
      endAt: null,
      meetingTime: null,
      status: "SCHEDULED",
      resultLabel: null,
      intermediateResultLabel: null,
      temporalBucket: "next",
      seasonKey: "2026-27",
      allocation: {
        pitchLabel: "Kunstrasen 2",
        homeDressingRoomLabel: "Kabine O1",
        awayDressingRoomLabel: null,
        refereeDressingRoomLabel: null,
      },
    },
    {
      id: "evt-nxt-2",
      type: "TRAINING",
      displayTitle: "D1 Training",
      teamDisplayName: "FC Allschwil D1",
      opponentDisplayName: null,
      organizerDisplayName: null,
      competitionLabel: null,
      startAt: "2026-09-12T09:00:00.000Z",
      endAt: "2026-09-12T10:30:00.000Z",
      meetingTime: null,
      status: "SCHEDULED",
      resultLabel: null,
      intermediateResultLabel: null,
      temporalBucket: "next",
      seasonKey: "2026-27",
      allocation: {
        pitchLabel: "Kunstrasen 3",
        homeDressingRoomLabel: "Kabine O2",
        awayDressingRoomLabel: null,
        refereeDressingRoomLabel: null,
      },
    },
  ],

  // ── LATER — mixed types, various allocation combinations ──────────────────
  later: [
    {
      id: "evt-lat-1",
      type: "MATCH",
      displayTitle: "FC Allschwil 1. Mannschaft – FC Reinach 1",
      teamDisplayName: "FC Allschwil 1. Mannschaft",
      opponentDisplayName: "FC Reinach 1",
      organizerDisplayName: null,
      competitionLabel: "Meisterschaft 2. Liga",
      startAt: "2026-09-12T11:00:00.000Z",
      endAt: "2026-09-12T12:45:00.000Z",
      meetingTime: "2026-09-12T10:30:00.000Z",
      status: "SCHEDULED",
      resultLabel: null,
      intermediateResultLabel: null,
      temporalBucket: "later",
      seasonKey: "2026-27",
      allocation: {
        pitchLabel: "Stadion",
        homeDressingRoomLabel: "Kabine E1",
        awayDressingRoomLabel: "Kabine E2",
        // refereeDressingRoomLabel retained in DTO, not rendered on Screen 1
        refereeDressingRoomLabel: "Kabine C",
      },
    },
    {
      id: "evt-lat-2",
      type: "TRAINING",
      displayTitle: "U8/U10 Minis Training",
      teamDisplayName: "FC Allschwil U8/U10",
      opponentDisplayName: null,
      organizerDisplayName: null,
      competitionLabel: null,
      startAt: "2026-09-12T12:00:00.000Z",
      endAt: null,
      meetingTime: null,
      status: "SCHEDULED",
      resultLabel: null,
      intermediateResultLabel: null,
      temporalBucket: "later",
      seasonKey: "2026-27",
      allocation: {
        pitchLabel: "Kunstrasen 3",
        homeDressingRoomLabel: "Kabine A",
        awayDressingRoomLabel: null,
        refereeDressingRoomLabel: null,
      },
    },
    {
      id: "evt-lat-3",
      type: "TOURNAMENT",
      displayTitle: "Hallenturnier FC Allschwil",
      teamDisplayName: "FC Allschwil Damen",
      opponentDisplayName: null,
      organizerDisplayName: "FC Allschwil",
      competitionLabel: "Hallenturnier",
      startAt: "2026-09-12T13:30:00.000Z",
      endAt: null,
      meetingTime: null,
      status: "SCHEDULED",
      resultLabel: null,
      intermediateResultLabel: null,
      temporalBucket: "later",
      seasonKey: "2026-27",
      allocation: {
        pitchLabel: "Kunstrasen 2",
        homeDressingRoomLabel: null,
        awayDressingRoomLabel: null,
        refereeDressingRoomLabel: null,
      },
    },
  ],

  isEmpty: false,
};

// ── Presentation: current time and announcement ───────────────────────────────

/**
 * Fixed current-time ISO string for the preview header.
 * 2026-09-12T08:30:00.000Z → 10:30 Europe/Zurich (UTC+2 in summer).
 */
export const PREVIEW_CURRENT_TIME_ISO = "2026-09-12T08:30:00.000Z" as const;

/**
 * Preview announcement bar content.
 * The reusable component must not hardcode any club-specific text.
 * This content belongs exclusively in the preview fixture.
 */
export const PREVIEW_ANNOUNCEMENT: InfoboardAnnouncementPresentation = {
  enabled: true,
  text: "WILLKOMMEN BEIM FC ALLSCHWIL – FAIRNESS, RESPEKT, LEIDENSCHAFT",
  backgroundColor: null,
  textColor: null,
};

// ── Tournament Case A: 4-team Kinderfussball E-Junioren ───────────────────────

/**
 * 4-team Kinderfussball E-Junioren tournament with explicit participant-to-room
 * allocations. Used in tests and the preview fixture to demonstrate multi-team
 * allocation mode.
 *
 *   FC Allschwil E1 → Kabine A  (home club, emphasis)
 *   FC Allschwil E2 → Kabine B  (home club, emphasis)
 *   FC Binningen    → Kabine C
 *   FC Aesch        → Kabine D
 */
export const PREVIEW_FIXTURE_TOURNAMENT_4TEAM: InfoboardScreen1Feed = {
  generatedAt: "2026-09-12T08:30:00.000Z",
  tenant: PREVIEW_TENANT,
  displayDate: "2026-09-12",
  isStale: false,
  wochenplanVariantBadge: null,
  current: [
    {
      id: "evt-tour4-1",
      type: "TOURNAMENT",
      displayTitle: "Kinderfussball E-Junioren Turnier",
      teamDisplayName: "FC Allschwil",
      opponentDisplayName: null,
      organizerDisplayName: "FC Allschwil",
      competitionLabel: "Kinderfussball",
      startAt: "2026-09-12T08:00:00.000Z",
      endAt: null,
      meetingTime: null,
      status: "LIVE",
      resultLabel: null,
      intermediateResultLabel: null,
      temporalBucket: "current",
      seasonKey: "2026-27",
      allocation: {
        pitchLabel: "Kunstrasen 1",
        homeDressingRoomLabel: null,
        awayDressingRoomLabel: null,
        refereeDressingRoomLabel: null,
      },
    },
  ],
  next: [],
  later: [],
  isEmpty: false,
};

export const PREVIEW_TOURNAMENT_4TEAM_EXTENSIONS: readonly InfoboardEventPresentationExtension[] = [
  {
    eventId: "evt-tour4-1",
    participantAllocations: [
      {
        id: "pa4-1",
        teamDisplayName: "FC Allschwil E1",
        dressingRoomLabel: "Kabine A",
        isHomeTeam: true,
      },
      {
        id: "pa4-2",
        teamDisplayName: "FC Allschwil E2",
        dressingRoomLabel: "Kabine B",
        isHomeTeam: true,
      },
      {
        id: "pa4-3",
        teamDisplayName: "FC Binningen",
        dressingRoomLabel: "Kabine C",
      },
      {
        id: "pa4-4",
        teamDisplayName: "FC Aesch",
        dressingRoomLabel: "Kabine D",
      },
    ],
  },
];

// ── Tournament Case B: 6-team Kinderfussball F-Junioren ───────────────────────

/**
 * 6-team Kinderfussball F-Junioren tournament with explicit participant-to-room
 * allocations.
 *
 *   FC Allschwil F1 → Kabine A  (home club, emphasis)
 *   FC Allschwil F2 → Kabine B  (home club, emphasis)
 *   FC Allschwil F3 → Kabine C  (home club, emphasis)
 *   FC Binningen    → Kabine D
 *   FC Reinach      → Kabine E
 *   FC Aesch        → Kabine F
 */
export const PREVIEW_FIXTURE_TOURNAMENT_6TEAM: InfoboardScreen1Feed = {
  generatedAt: "2026-09-12T08:30:00.000Z",
  tenant: PREVIEW_TENANT,
  displayDate: "2026-09-12",
  isStale: false,
  wochenplanVariantBadge: null,
  current: [
    {
      id: "evt-tour6-1",
      type: "TOURNAMENT",
      displayTitle: "Kinderfussball F-Junioren Turnier",
      teamDisplayName: "FC Allschwil",
      opponentDisplayName: null,
      organizerDisplayName: "FC Allschwil",
      competitionLabel: "Kinderfussball",
      startAt: "2026-09-12T08:00:00.000Z",
      endAt: null,
      meetingTime: null,
      status: "LIVE",
      resultLabel: null,
      intermediateResultLabel: null,
      temporalBucket: "current",
      seasonKey: "2026-27",
      allocation: {
        pitchLabel: "Kunstrasen 1",
        homeDressingRoomLabel: null,
        awayDressingRoomLabel: null,
        refereeDressingRoomLabel: null,
      },
    },
  ],
  next: [],
  later: [],
  isEmpty: false,
};

export const PREVIEW_TOURNAMENT_6TEAM_EXTENSIONS: readonly InfoboardEventPresentationExtension[] = [
  {
    eventId: "evt-tour6-1",
    participantAllocations: [
      {
        id: "pa6-1",
        teamDisplayName: "FC Allschwil F1",
        dressingRoomLabel: "Kabine A",
        isHomeTeam: true,
      },
      {
        id: "pa6-2",
        teamDisplayName: "FC Allschwil F2",
        dressingRoomLabel: "Kabine B",
        isHomeTeam: true,
      },
      {
        id: "pa6-3",
        teamDisplayName: "FC Allschwil F3",
        dressingRoomLabel: "Kabine C",
        isHomeTeam: true,
      },
      {
        id: "pa6-4",
        teamDisplayName: "FC Binningen",
        dressingRoomLabel: "Kabine D",
      },
      {
        id: "pa6-5",
        teamDisplayName: "FC Reinach",
        dressingRoomLabel: "Kabine E",
      },
      {
        id: "pa6-6",
        teamDisplayName: "FC Aesch",
        dressingRoomLabel: "Kabine F",
      },
    ],
  },
];

// ── High-density: 6 simultaneous trainings ────────────────────────────────────

/**
 * 6 simultaneous trainings — all share the same startAt to demonstrate
 * high-density compact row layout (4–6 simultaneous events).
 * Each training has a unique team, pitch, and dressing room.
 */
export const PREVIEW_FIXTURE_HIGH_DENSITY_6: InfoboardScreen1Feed = {
  generatedAt: "2026-09-12T08:30:00.000Z",
  tenant: PREVIEW_TENANT,
  displayDate: "2026-09-12",
  isStale: false,
  wochenplanVariantBadge: null,
  current: [
    {
      id: "evt-hd-1",
      type: "TRAINING",
      displayTitle: "U8/U10 A Training",
      teamDisplayName: "FC Allschwil U8/U10 A",
      opponentDisplayName: null,
      organizerDisplayName: null,
      competitionLabel: null,
      startAt: "2026-09-12T08:00:00.000Z",
      endAt: "2026-09-12T09:30:00.000Z",
      meetingTime: null,
      status: "LIVE",
      resultLabel: null,
      intermediateResultLabel: null,
      temporalBucket: "current",
      seasonKey: "2026-27",
      allocation: {
        pitchLabel: "Platz 1",
        homeDressingRoomLabel: "Kabine A",
        awayDressingRoomLabel: null,
        refereeDressingRoomLabel: null,
      },
    },
    {
      id: "evt-hd-2",
      type: "TRAINING",
      displayTitle: "U8/U10 B Training",
      teamDisplayName: "FC Allschwil U8/U10 B",
      opponentDisplayName: null,
      organizerDisplayName: null,
      competitionLabel: null,
      startAt: "2026-09-12T08:00:00.000Z",
      endAt: "2026-09-12T09:30:00.000Z",
      meetingTime: null,
      status: "LIVE",
      resultLabel: null,
      intermediateResultLabel: null,
      temporalBucket: "current",
      seasonKey: "2026-27",
      allocation: {
        pitchLabel: "Platz 2",
        homeDressingRoomLabel: "Kabine B",
        awayDressingRoomLabel: null,
        refereeDressingRoomLabel: null,
      },
    },
    {
      id: "evt-hd-3",
      type: "TRAINING",
      displayTitle: "U12 A Training",
      teamDisplayName: "FC Allschwil U12 A",
      opponentDisplayName: null,
      organizerDisplayName: null,
      competitionLabel: null,
      startAt: "2026-09-12T08:00:00.000Z",
      endAt: "2026-09-12T09:30:00.000Z",
      meetingTime: null,
      status: "LIVE",
      resultLabel: null,
      intermediateResultLabel: null,
      temporalBucket: "current",
      seasonKey: "2026-27",
      allocation: {
        pitchLabel: "Kunstrasen 1",
        homeDressingRoomLabel: "Kabine C",
        awayDressingRoomLabel: null,
        refereeDressingRoomLabel: null,
      },
    },
    {
      id: "evt-hd-4",
      type: "TRAINING",
      displayTitle: "U12 B Training",
      teamDisplayName: "FC Allschwil U12 B",
      opponentDisplayName: null,
      organizerDisplayName: null,
      competitionLabel: null,
      startAt: "2026-09-12T08:00:00.000Z",
      endAt: "2026-09-12T09:30:00.000Z",
      meetingTime: null,
      status: "LIVE",
      resultLabel: null,
      intermediateResultLabel: null,
      temporalBucket: "current",
      seasonKey: "2026-27",
      allocation: {
        pitchLabel: "Kunstrasen 2",
        homeDressingRoomLabel: "Kabine D",
        awayDressingRoomLabel: null,
        refereeDressingRoomLabel: null,
      },
    },
    {
      id: "evt-hd-5",
      type: "TRAINING",
      displayTitle: "U14 A Training",
      teamDisplayName: "FC Allschwil U14 A",
      opponentDisplayName: null,
      organizerDisplayName: null,
      competitionLabel: null,
      startAt: "2026-09-12T08:00:00.000Z",
      endAt: "2026-09-12T09:30:00.000Z",
      meetingTime: null,
      status: "LIVE",
      resultLabel: null,
      intermediateResultLabel: null,
      temporalBucket: "current",
      seasonKey: "2026-27",
      allocation: {
        pitchLabel: "Kunstrasen 3",
        homeDressingRoomLabel: "Kabine E",
        awayDressingRoomLabel: null,
        refereeDressingRoomLabel: null,
      },
    },
    {
      id: "evt-hd-6",
      type: "TRAINING",
      displayTitle: "D1 Training",
      teamDisplayName: "FC Allschwil D1",
      opponentDisplayName: null,
      organizerDisplayName: null,
      competitionLabel: null,
      startAt: "2026-09-12T08:00:00.000Z",
      endAt: "2026-09-12T09:30:00.000Z",
      meetingTime: null,
      status: "LIVE",
      resultLabel: null,
      intermediateResultLabel: null,
      temporalBucket: "current",
      seasonKey: "2026-27",
      allocation: {
        pitchLabel: "Stadion",
        homeDressingRoomLabel: "Kabine F",
        awayDressingRoomLabel: null,
        refereeDressingRoomLabel: null,
      },
    },
  ],
  next: [],
  later: [],
  isEmpty: false,
};

// ── Derived empty-state fixtures ──────────────────────────────────────────────

/**
 * Fixture with an empty current section but populated future sections.
 * Used to verify the restrained "no current event" message.
 */
export const PREVIEW_FIXTURE_EMPTY_CURRENT: InfoboardScreen1Feed = {
  ...PREVIEW_FIXTURE,
  current: [],
};

/**
 * Fixture with all buckets empty.
 * Used to verify the full empty-state rendering.
 */
export const PREVIEW_FIXTURE_EMPTY: InfoboardScreen1Feed = {
  ...PREVIEW_FIXTURE,
  current: [],
  next: [],
  later: [],
  isEmpty: true,
};
