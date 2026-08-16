/**
 * components/infoboard/screen1/screen1-preview-fixture.ts
 *
 * Deterministic preview fixture for Infoboard Screen 1.
 *
 * PREVIEW-ONLY — must never be imported by production feed builders or API
 * routes. All timestamps are fixed UTC ISO-8601 strings.
 *
 * Target visual scenario (PP-02B-H):
 *   Fixed display date: 2026-09-12 (Saturday, Europe/Zurich = UTC+2 in summer).
 *   Tenant timezone: "Europe/Zurich".
 *   Current time:     2026-09-12T15:35:00.000Z  →  17:35 Zurich
 *
 * Zurich offset (+2h in summer):
 *   15:00Z → 17:00 Zurich
 *   16:00Z → 18:00 Zurich
 *   17:00Z → 19:00 Zurich
 *   18:15Z → 20:15 Zurich
 *   19:00Z → 21:00 Zurich
 *
 * At 17:35 Zurich:
 *   - evt-1 (17:00, match) is CURRENT  → status: JETZT
 *   - evt-2 (18:00, training) is NEXT  → status: IN 25 MIN.
 *   - evt-3 (19:00, tournament) is LATER
 *   - evt-4 (20:15, match) is LATER
 *   - evt-5 (21:00, training) is LATER
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

// ── Main preview fixture — 5 rows matching PP-02B-H target ───────────────────

export const PREVIEW_FIXTURE: InfoboardScreen1Feed = {
  generatedAt: "2026-09-12T15:35:00.000Z",
  tenant: PREVIEW_TENANT,
  displayDate: "2026-09-12",
  isStale: false,
  wochenplanVariantBadge: null,

  // ── CURRENT — FC Allschwil E1 match at 17:00 Zurich ──────────────────────
  current: [
    {
      id: "evt-1",
      type: "MATCH",
      displayTitle: "FC Allschwil E1 – FC Binningen E1",
      teamDisplayName: "FC Allschwil E1",
      opponentDisplayName: "FC Binningen E1",
      opponentLogoUrl: null,
      organizerDisplayName: null,
      competitionLabel: "Meisterschaft",
      startAt: "2026-09-12T15:00:00.000Z",
      endAt: "2026-09-12T16:45:00.000Z",
      meetingTime: null,
      status: "LIVE",
      resultLabel: null,
      intermediateResultLabel: null,
      temporalBucket: "current",
      seasonKey: "2026-27",
      allocation: {
        pitchLabel: "Stadion",
        homeDressingRoomLabel: "Kabine E1",
        awayDressingRoomLabel: "Kabine E2",
        refereeDressingRoomLabel: null,
      },
    },
  ],

  // ── NEXT — Juniorinnen FF-14 training at 18:00 Zurich (in 25 min) ────────
  next: [
    {
      id: "evt-2",
      type: "TRAINING",
      displayTitle: "Juniorinnen FF-14",
      teamDisplayName: "Juniorinnen FF-14",
      opponentDisplayName: null,
      opponentLogoUrl: null,
      organizerDisplayName: "FC Allschwil",
      competitionLabel: null,
      startAt: "2026-09-12T16:00:00.000Z",
      endAt: null,
      meetingTime: null,
      status: "SCHEDULED",
      resultLabel: null,
      intermediateResultLabel: null,
      temporalBucket: "next",
      seasonKey: "2026-27",
      allocation: {
        pitchLabel: "KR2",
        homeDressingRoomLabel: "Kabine 04",
        awayDressingRoomLabel: null,
        refereeDressingRoomLabel: null,
      },
    },
  ],

  // ── LATER ─────────────────────────────────────────────────────────────────
  later: [
    {
      id: "evt-3",
      type: "TOURNAMENT",
      displayTitle: "Sommer-Cup Junioren E",
      teamDisplayName: "FC Allschwil Junioren",
      opponentDisplayName: null,
      opponentLogoUrl: null,
      organizerDisplayName: "FC Allschwil",
      competitionLabel: "Sommer-Cup",
      startAt: "2026-09-12T17:00:00.000Z",
      endAt: null,
      meetingTime: null,
      status: "SCHEDULED",
      resultLabel: null,
      intermediateResultLabel: null,
      temporalBucket: "later",
      seasonKey: "2026-27",
      allocation: {
        pitchLabel: "KR2 + KR3",
        homeDressingRoomLabel: null,
        awayDressingRoomLabel: null,
        refereeDressingRoomLabel: null,
      },
    },
    {
      id: "evt-4",
      type: "MATCH",
      displayTitle: "FC Allschwil D1 – SC Basler Nord D1",
      teamDisplayName: "FC Allschwil D1",
      opponentDisplayName: "SC Basler Nord D1",
      opponentLogoUrl: null,
      organizerDisplayName: null,
      competitionLabel: "Meisterschaft",
      startAt: "2026-09-12T18:15:00.000Z",
      endAt: null,
      meetingTime: null,
      status: "SCHEDULED",
      resultLabel: null,
      intermediateResultLabel: null,
      temporalBucket: "later",
      seasonKey: "2026-27",
      allocation: {
        pitchLabel: "KR1",
        homeDressingRoomLabel: "Kabine D1",
        awayDressingRoomLabel: "Kabine D2",
        refereeDressingRoomLabel: null,
      },
    },
    {
      id: "evt-5",
      type: "TRAINING",
      displayTitle: "Aktive Herren",
      teamDisplayName: "Aktive Herren",
      opponentDisplayName: null,
      opponentLogoUrl: null,
      organizerDisplayName: "FC Allschwil",
      competitionLabel: null,
      startAt: "2026-09-12T19:00:00.000Z",
      endAt: null,
      meetingTime: null,
      status: "SCHEDULED",
      resultLabel: null,
      intermediateResultLabel: null,
      temporalBucket: "later",
      seasonKey: "2026-27",
      allocation: {
        pitchLabel: "Hauptplatz",
        homeDressingRoomLabel: "Kabine A",
        awayDressingRoomLabel: null,
        refereeDressingRoomLabel: null,
      },
    },
  ],

  isEmpty: false,
  emptyStateReason: null,
};

// ── Presentation: current time and announcement ───────────────────────────────

/**
 * Fixed current-time ISO string for the preview header.
 * 2026-09-12T15:35:00.000Z → 17:35 Europe/Zurich (UTC+2 in summer).
 * At this time the next event (18:00) is in exactly 25 minutes.
 */
export const PREVIEW_CURRENT_TIME_ISO = "2026-09-12T15:35:00.000Z" as const;

/**
 * Preview announcement bar content matching the target image.
 * The reusable component must not hardcode any club-specific text.
 * This content belongs exclusively in the preview fixture.
 */
export const PREVIEW_ANNOUNCEMENT: InfoboardAnnouncementPresentation = {
  enabled: true,
  text: "WIR LEBEN FUSSBALL. FAIRNESS. RESPEKT. LEIDENSCHAFT.",
  backgroundColor: null,
  textColor: null,
};

// ── Target tournament: 5-team Sommer-Cup Junioren E ──────────────────────────

/**
 * Explicit participant-to-room allocations for the Sommer-Cup Junioren E
 * in the primary preview fixture (evt-3).
 *
 *   FC Binningen    E1 → Kabine 01
 *   SC Birsfelden   E1 → Kabine 02
 *   SV Muttenz      E1 → Kabine 03
 *   FC Reinach      E1 → Kabine 04
 *   FC Oberwil      E1 → Kabine 05
 */
export const PREVIEW_TARGET_TOURNAMENT_EXTENSIONS: readonly InfoboardEventPresentationExtension[] = [
  {
    eventId: "evt-3",
    participantAllocations: [
      { id: "pt-1", teamDisplayName: "FC Binningen E1", dressingRoomLabel: "Kabine 01" },
      { id: "pt-2", teamDisplayName: "SC Birsfelden E1", dressingRoomLabel: "Kabine 02" },
      { id: "pt-3", teamDisplayName: "SV Muttenz E1", dressingRoomLabel: "Kabine 03" },
      { id: "pt-4", teamDisplayName: "FC Reinach E1", dressingRoomLabel: "Kabine 04" },
      { id: "pt-5", teamDisplayName: "FC Oberwil E1", dressingRoomLabel: "Kabine 05" },
    ],
  },
];

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
      opponentLogoUrl: null,
      organizerDisplayName: "FC Allschwil",
      competitionLabel: "Kinderfussball",
      startAt: "2026-09-12T08:00:00.000Z",
      endAt: "2026-09-12T10:00:00.000Z",
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
  emptyStateReason: null,
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
      opponentLogoUrl: null,
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
  emptyStateReason: null,
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
 * 6 simultaneous trainings — all share the same startAt.
 * Used in tests to verify that all events remain individually visible
 * in the flat event list model.
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
      opponentLogoUrl: null,
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
      opponentLogoUrl: null,
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
      opponentLogoUrl: null,
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
      opponentLogoUrl: null,
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
      opponentLogoUrl: null,
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
      opponentLogoUrl: null,
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
  emptyStateReason: null,
};

// ── Derived empty-state fixtures ──────────────────────────────────────────────

/**
 * Fixture with an empty current section but populated future sections.
 */
export const PREVIEW_FIXTURE_EMPTY_CURRENT: InfoboardScreen1Feed = {
  ...PREVIEW_FIXTURE,
  current: [],
};

/**
 * Fixture with all buckets empty.
 */
export const PREVIEW_FIXTURE_EMPTY: InfoboardScreen1Feed = {
  ...PREVIEW_FIXTURE,
  current: [],
  next: [],
  later: [],
  isEmpty: true,
  emptyStateReason: "NO_EVENTS_TODAY",
};

// ── Adaptive event-count fixtures ─────────────────────────────────────────────

/**
 * 1-event hero scenario: one current match on the Stadion.
 * Demonstrates the hero card layout for a single event.
 */
export const PREVIEW_FIXTURE_1EVENT: InfoboardScreen1Feed = {
  generatedAt: "2026-09-12T15:35:00.000Z",
  tenant: PREVIEW_TENANT,
  displayDate: "2026-09-12",
  isStale: false,
  wochenplanVariantBadge: null,
  current: [
    {
      id: "evt-hero-1",
      type: "MATCH",
      displayTitle: "FC Allschwil Aktive – FC Concordia Basel",
      teamDisplayName: "FC Allschwil Aktive",
      opponentDisplayName: "FC Concordia Basel",
      opponentLogoUrl: null,
      organizerDisplayName: null,
      competitionLabel: "Meisterschaft",
      startAt: "2026-09-12T15:00:00.000Z",
      endAt: "2026-09-12T16:45:00.000Z",
      meetingTime: null,
      status: "LIVE",
      resultLabel: null,
      intermediateResultLabel: null,
      temporalBucket: "current",
      seasonKey: "2026-27",
      allocation: {
        pitchLabel: "Stadion",
        homeDressingRoomLabel: "Kabine A",
        awayDressingRoomLabel: "Kabine B",
        refereeDressingRoomLabel: null,
      },
    },
  ],
  next: [],
  later: [],
  isEmpty: false,
  emptyStateReason: null,
};

/**
 * 2-event balanced scenario: one current training + one upcoming match.
 */
export const PREVIEW_FIXTURE_2EVENTS: InfoboardScreen1Feed = {
  generatedAt: "2026-09-12T15:35:00.000Z",
  tenant: PREVIEW_TENANT,
  displayDate: "2026-09-12",
  isStale: false,
  wochenplanVariantBadge: null,
  current: [
    {
      id: "evt-2ev-1",
      type: "TRAINING",
      displayTitle: "Aktive Herren Training",
      teamDisplayName: "Aktive Herren",
      opponentDisplayName: null,
      opponentLogoUrl: null,
      organizerDisplayName: "FC Allschwil",
      competitionLabel: null,
      startAt: "2026-09-12T14:30:00.000Z",
      endAt: "2026-09-12T16:30:00.000Z",
      meetingTime: null,
      status: "LIVE",
      resultLabel: null,
      intermediateResultLabel: null,
      temporalBucket: "current",
      seasonKey: "2026-27",
      allocation: {
        pitchLabel: "KR1",
        homeDressingRoomLabel: "Kabine A",
        awayDressingRoomLabel: null,
        refereeDressingRoomLabel: null,
      },
    },
  ],
  next: [
    {
      id: "evt-2ev-2",
      type: "MATCH",
      displayTitle: "FC Allschwil E1 – FC Binningen E1",
      teamDisplayName: "FC Allschwil E1",
      opponentDisplayName: "FC Binningen E1",
      opponentLogoUrl: null,
      organizerDisplayName: null,
      competitionLabel: "Meisterschaft",
      startAt: "2026-09-12T17:00:00.000Z",
      endAt: null,
      meetingTime: null,
      status: "SCHEDULED",
      resultLabel: null,
      intermediateResultLabel: null,
      temporalBucket: "next",
      seasonKey: "2026-27",
      allocation: {
        pitchLabel: "Stadion",
        homeDressingRoomLabel: "Kabine E1",
        awayDressingRoomLabel: "Kabine E2",
        refereeDressingRoomLabel: null,
      },
    },
  ],
  later: [],
  isEmpty: false,
  emptyStateReason: null,
};

/**
 * INFOBOARD-INTEGRATION-01B — combined manual-verification scenario.
 *
 * One training (pitch assigned, dressing room missing — restrained warning)
 * plus one upcoming HOME match (fully allocated). Used only by the
 * `/infoboard/preview/screen-1-theme-check` preview route to manually verify
 * both Dark and Light themes against a single representative scenario.
 */
export const PREVIEW_FIXTURE_THEME_CHECK: InfoboardScreen1Feed = {
  generatedAt: "2026-09-12T15:35:00.000Z",
  tenant: PREVIEW_TENANT,
  displayDate: "2026-09-12",
  isStale: false,
  wochenplanVariantBadge: null,
  current: [
    {
      id: "evt-theme-check-1",
      type: "TRAINING",
      displayTitle: "Juniorinnen FF-14",
      teamDisplayName: "Juniorinnen FF-14",
      opponentDisplayName: null,
      opponentLogoUrl: null,
      organizerDisplayName: "FC Allschwil",
      competitionLabel: null,
      startAt: "2026-09-12T15:00:00.000Z",
      endAt: "2026-09-12T16:30:00.000Z",
      meetingTime: null,
      status: "LIVE",
      resultLabel: null,
      intermediateResultLabel: null,
      temporalBucket: "current",
      seasonKey: "2026-27",
      allocation: {
        pitchLabel: "KR2",
        homeDressingRoomLabel: null,
        awayDressingRoomLabel: null,
        refereeDressingRoomLabel: null,
      },
    },
  ],
  next: [
    {
      id: "evt-theme-check-2",
      type: "MATCH",
      displayTitle: "FC Allschwil E1 – FC Binningen E1",
      teamDisplayName: "FC Allschwil E1",
      opponentDisplayName: "FC Binningen E1",
      opponentLogoUrl: null,
      organizerDisplayName: null,
      competitionLabel: "Meisterschaft",
      startAt: "2026-09-12T17:00:00.000Z",
      endAt: null,
      meetingTime: null,
      status: "SCHEDULED",
      resultLabel: null,
      intermediateResultLabel: null,
      temporalBucket: "next",
      seasonKey: "2026-27",
      allocation: {
        pitchLabel: "Stadion",
        homeDressingRoomLabel: "Kabine E1",
        awayDressingRoomLabel: "Kabine E2",
        refereeDressingRoomLabel: null,
      },
    },
  ],
  later: [],
  isEmpty: false,
  emptyStateReason: null,
};

/**
 * Missing allocation scenario: one event with no pitch and no dressing room.
 * Used to test the amber NOCH NICHT ZUGETEILT warning display.
 */
export const PREVIEW_FIXTURE_MISSING_ALLOCATION: InfoboardScreen1Feed = {
  generatedAt: "2026-09-12T15:35:00.000Z",
  tenant: PREVIEW_TENANT,
  displayDate: "2026-09-12",
  isStale: false,
  wochenplanVariantBadge: null,
  current: [
    {
      id: "evt-missing-1",
      type: "TRAINING",
      displayTitle: "Juniorinnen FF-14",
      teamDisplayName: "Juniorinnen FF-14",
      opponentDisplayName: null,
      opponentLogoUrl: null,
      organizerDisplayName: "FC Allschwil",
      competitionLabel: null,
      startAt: "2026-09-12T15:00:00.000Z",
      endAt: null,
      meetingTime: null,
      status: "SCHEDULED",
      resultLabel: null,
      intermediateResultLabel: null,
      temporalBucket: "current",
      seasonKey: "2026-27",
      allocation: {
        pitchLabel: null,
        homeDressingRoomLabel: null,
        awayDressingRoomLabel: null,
        refereeDressingRoomLabel: null,
      },
    },
  ],
  next: [],
  later: [],
  isEmpty: false,
  emptyStateReason: null,
};

// ── Training group fixture ─────────────────────────────────────────────────────

/**
 * Fixture for testing training aggregation (same-start-time grouping).
 *
 * Scenario:
 *   GROUP A — 3 trainings at 17:15 Zurich (15:15Z), CURRENT:
 *     D7 D1 → KUNSTRASEN 3_A | Kabine 3
 *     D7 D2 → KUNSTRASEN 3_B | Kabine 4
 *     E1    → KUNSTRASEN 2_A | null (missing dressing room)
 *
 *   SINGLE MATCH — 16:00 Zurich (14:00Z), NEXT (must NOT be grouped):
 *     FC Allschwil E1 vs FC Binningen E1
 *
 *   GROUP B — 2 trainings at 18:45 Zurich (16:45Z), LATER:
 *     D9 D1 → KUNSTRASEN 3_A | Kabine 3
 *     D9 D2 → KUNSTRASEN 3_B | null (missing dressing room)
 *
 * Expected rendered cards: 3 (group A + match + group B).
 */
export const PREVIEW_FIXTURE_TRAINING_GROUPS: InfoboardScreen1Feed = {
  generatedAt: "2026-09-12T13:30:00.000Z",
  tenant: PREVIEW_TENANT,
  displayDate: "2026-09-12",
  isStale: false,
  wochenplanVariantBadge: null,

  current: [
    {
      id: "tg-d7-d1",
      type: "TRAINING",
      displayTitle: "FC Allschwil D7 D1",
      teamDisplayName: "FC Allschwil D7 D1",
      opponentDisplayName: null,
      opponentLogoUrl: null,
      organizerDisplayName: null,
      competitionLabel: null,
      startAt: "2026-09-12T15:15:00.000Z",
      endAt: "2026-09-12T16:45:00.000Z",
      meetingTime: null,
      status: "LIVE",
      resultLabel: null,
      intermediateResultLabel: null,
      temporalBucket: "current",
      seasonKey: "2026-27",
      allocation: {
        pitchLabel: "KUNSTRASEN 3_A",
        homeDressingRoomLabel: "Kabine 3",
        awayDressingRoomLabel: null,
        refereeDressingRoomLabel: null,
      },
    },
    {
      id: "tg-d7-d2",
      type: "TRAINING",
      displayTitle: "FC Allschwil D7 D2",
      teamDisplayName: "FC Allschwil D7 D2",
      opponentDisplayName: null,
      opponentLogoUrl: null,
      organizerDisplayName: null,
      competitionLabel: null,
      startAt: "2026-09-12T15:15:00.000Z",
      endAt: "2026-09-12T16:45:00.000Z",
      meetingTime: null,
      status: "LIVE",
      resultLabel: null,
      intermediateResultLabel: null,
      temporalBucket: "current",
      seasonKey: "2026-27",
      allocation: {
        pitchLabel: "KUNSTRASEN 3_B",
        homeDressingRoomLabel: "Kabine 4",
        awayDressingRoomLabel: null,
        refereeDressingRoomLabel: null,
      },
    },
    {
      id: "tg-e1",
      type: "TRAINING",
      displayTitle: "FC Allschwil Junioren E1",
      teamDisplayName: "FC Allschwil Junioren E1",
      opponentDisplayName: null,
      opponentLogoUrl: null,
      organizerDisplayName: null,
      competitionLabel: null,
      startAt: "2026-09-12T15:15:00.000Z",
      endAt: "2026-09-12T16:45:00.000Z",
      meetingTime: null,
      status: "LIVE",
      resultLabel: null,
      intermediateResultLabel: null,
      temporalBucket: "current",
      seasonKey: "2026-27",
      allocation: {
        pitchLabel: "KUNSTRASEN 2_A",
        homeDressingRoomLabel: null,
        awayDressingRoomLabel: null,
        refereeDressingRoomLabel: null,
      },
    },
  ],

  next: [
    {
      id: "tg-match",
      type: "MATCH",
      displayTitle: "FC Allschwil E1 – FC Binningen E1",
      teamDisplayName: "FC Allschwil E1",
      opponentDisplayName: "FC Binningen E1",
      opponentLogoUrl: null,
      organizerDisplayName: null,
      competitionLabel: "Meisterschaft",
      startAt: "2026-09-12T14:00:00.000Z",
      endAt: "2026-09-12T15:45:00.000Z",
      meetingTime: null,
      status: "SCHEDULED",
      resultLabel: null,
      intermediateResultLabel: null,
      temporalBucket: "next",
      seasonKey: "2026-27",
      allocation: {
        pitchLabel: "Stadion",
        homeDressingRoomLabel: "Kabine E1",
        awayDressingRoomLabel: "Kabine E2",
        refereeDressingRoomLabel: null,
      },
    },
  ],

  later: [
    {
      id: "tg-d9-d1",
      type: "TRAINING",
      displayTitle: "FC Allschwil D9 D1",
      teamDisplayName: "FC Allschwil D9 D1",
      opponentDisplayName: null,
      opponentLogoUrl: null,
      organizerDisplayName: null,
      competitionLabel: null,
      startAt: "2026-09-12T16:45:00.000Z",
      endAt: "2026-09-12T18:15:00.000Z",
      meetingTime: null,
      status: "SCHEDULED",
      resultLabel: null,
      intermediateResultLabel: null,
      temporalBucket: "later",
      seasonKey: "2026-27",
      allocation: {
        pitchLabel: "KUNSTRASEN 3_A",
        homeDressingRoomLabel: "Kabine 3",
        awayDressingRoomLabel: null,
        refereeDressingRoomLabel: null,
      },
    },
    {
      id: "tg-d9-d2",
      type: "TRAINING",
      displayTitle: "FC Allschwil D9 D2",
      teamDisplayName: "FC Allschwil D9 D2",
      opponentDisplayName: null,
      opponentLogoUrl: null,
      organizerDisplayName: null,
      competitionLabel: null,
      startAt: "2026-09-12T16:45:00.000Z",
      endAt: "2026-09-12T18:15:00.000Z",
      meetingTime: null,
      status: "SCHEDULED",
      resultLabel: null,
      intermediateResultLabel: null,
      temporalBucket: "later",
      seasonKey: "2026-27",
      allocation: {
        pitchLabel: "KUNSTRASEN 3_B",
        homeDressingRoomLabel: null,
        awayDressingRoomLabel: null,
        refereeDressingRoomLabel: null,
      },
    },
  ],

  isEmpty: false,
  emptyStateReason: null,
};

// ── Screen 1 event-type regression preview ────────────────────────────────────

/**
 * Development-only visual regression scenario.
 *
 * Exactly three events are deliberately exposed together:
 *   09:00–10:30 TRAINING
 *   11:00–12:30 MATCH
 *   13:00–15:00 4-team TOURNAMENT
 *
 * This exercises the real Screen 1 renderer across all three canonical
 * event types without introducing preview-specific rendering logic.
 */
export const PREVIEW_FIXTURE_EVENT_TYPE_REGRESSION: InfoboardScreen1Feed = {
  generatedAt: "2026-09-12T06:30:00.000Z",
  tenant: PREVIEW_TENANT,
  displayDate: "2026-09-12",
  isStale: false,
  wochenplanVariantBadge: null,

  current: [],

  next: [
    {
      id: "evt-reg-training-f2",
      type: "TRAINING",
      displayTitle: "FC Allschwil Junioren F2",
      teamDisplayName: "FC Allschwil Junioren F2",
      opponentDisplayName: null,
      opponentLogoUrl: null,
      organizerDisplayName: "FC Allschwil",
      competitionLabel: null,
      startAt: "2026-09-12T07:00:00.000Z",
      endAt: "2026-09-12T08:30:00.000Z",
      meetingTime: null,
      status: "SCHEDULED",
      resultLabel: null,
      intermediateResultLabel: null,
      temporalBucket: "next",
      seasonKey: "2026-27",
      allocation: {
        pitchLabel: "KR 2",
        homeDressingRoomLabel: "E1",
        awayDressingRoomLabel: null,
        refereeDressingRoomLabel: null,
      },
    },
    {
      id: "evt-reg-training-e3",
      type: "TRAINING",
      displayTitle: "FC Allschwil Junioren E3",
      teamDisplayName: "FC Allschwil Junioren E3",
      opponentDisplayName: null,
      opponentLogoUrl: null,
      organizerDisplayName: "FC Allschwil",
      competitionLabel: null,
      startAt: "2026-09-12T07:00:00.000Z",
      endAt: "2026-09-12T08:30:00.000Z",
      meetingTime: null,
      status: "SCHEDULED",
      resultLabel: null,
      intermediateResultLabel: null,
      temporalBucket: "next",
      seasonKey: "2026-27",
      allocation: {
        pitchLabel: "KR 2 B",
        homeDressingRoomLabel: "E2",
        awayDressingRoomLabel: null,
        refereeDressingRoomLabel: null,
      },
    },
    {
      id: "evt-reg-training-d1",
      type: "TRAINING",
      displayTitle: "FC Allschwil Junioren D1",
      teamDisplayName: "FC Allschwil Junioren D1",
      opponentDisplayName: null,
      opponentLogoUrl: null,
      organizerDisplayName: "FC Allschwil",
      competitionLabel: null,
      startAt: "2026-09-12T07:00:00.000Z",
      endAt: "2026-09-12T08:30:00.000Z",
      meetingTime: null,
      status: "SCHEDULED",
      resultLabel: null,
      intermediateResultLabel: null,
      temporalBucket: "next",
      seasonKey: "2026-27",
      allocation: {
        pitchLabel: "KR 3",
        homeDressingRoomLabel: "E3",
        awayDressingRoomLabel: null,
        refereeDressingRoomLabel: null,
      },
    },
    {
      id: "evt-reg-training-c2",
      type: "TRAINING",
      displayTitle: "FC Allschwil Junioren C2",
      teamDisplayName: "FC Allschwil Junioren C2",
      opponentDisplayName: null,
      opponentLogoUrl: null,
      organizerDisplayName: "FC Allschwil",
      competitionLabel: null,
      startAt: "2026-09-12T07:00:00.000Z",
      endAt: "2026-09-12T08:30:00.000Z",
      meetingTime: null,
      status: "SCHEDULED",
      resultLabel: null,
      intermediateResultLabel: null,
      temporalBucket: "next",
      seasonKey: "2026-27",
      allocation: {
        pitchLabel: "STADION",
        homeDressingRoomLabel: "E4",
        awayDressingRoomLabel: null,
        refereeDressingRoomLabel: null,
      },
    },
    {
      id: "evt-reg-training-b2",
      type: "TRAINING",
      displayTitle: "FC Allschwil Junioren B2",
      teamDisplayName: "FC Allschwil Junioren B2",
      opponentDisplayName: null,
      opponentLogoUrl: null,
      organizerDisplayName: "FC Allschwil",
      competitionLabel: null,
      startAt: "2026-09-12T07:00:00.000Z",
      endAt: "2026-09-12T08:30:00.000Z",
      meetingTime: null,
      status: "SCHEDULED",
      resultLabel: null,
      intermediateResultLabel: null,
      temporalBucket: "next",
      seasonKey: "2026-27",
      allocation: {
        pitchLabel: "KR 3 A",
        homeDressingRoomLabel: "O1",
        awayDressingRoomLabel: null,
        refereeDressingRoomLabel: null,
      },
    },
    {
      id: "evt-reg-training-ff17",
      type: "TRAINING",
      displayTitle: "FC Allschwil Juniorinnen FF-17",
      teamDisplayName: "FC Allschwil Juniorinnen FF-17",
      opponentDisplayName: null,
      opponentLogoUrl: null,
      organizerDisplayName: "FC Allschwil",
      competitionLabel: null,
      startAt: "2026-09-12T07:00:00.000Z",
      endAt: "2026-09-12T08:30:00.000Z",
      meetingTime: null,
      status: "SCHEDULED",
      resultLabel: null,
      intermediateResultLabel: null,
      temporalBucket: "next",
      seasonKey: "2026-27",
      allocation: {
        pitchLabel: "KR 2 A",
        homeDressingRoomLabel: "O2",
        awayDressingRoomLabel: null,
        refereeDressingRoomLabel: null,
      },
    },
  ],
  later: [
    {
      id: "evt-reg-match",
      type: "MATCH",
      displayTitle: "FC Allschwil Junioren C2 – FC Therwil C Gelb",
      teamDisplayName: "FC Allschwil Junioren C2",
      opponentDisplayName: "FC Therwil C Gelb",
      opponentLogoUrl: null,
      organizerDisplayName: null,
      competitionLabel: "Meisterschaft",
      startAt: "2026-09-12T09:00:00.000Z",
      endAt: "2026-09-12T10:30:00.000Z",
      meetingTime: null,
      status: "SCHEDULED",
      resultLabel: null,
      intermediateResultLabel: null,
      temporalBucket: "later",
      seasonKey: "2026-27",
      allocation: {
        pitchLabel: "Stadion",
        homeDressingRoomLabel: "E3",
        awayDressingRoomLabel: "E2",
        refereeDressingRoomLabel: null,
      },
    },
    {
      ...PREVIEW_FIXTURE_TOURNAMENT_4TEAM.current[0],
      id: "evt-reg-tournament",
      startAt: "2026-09-12T11:00:00.000Z",
      endAt: "2026-09-12T13:00:00.000Z",
      status: "SCHEDULED",
      temporalBucket: "later",
    },
  ],

  isEmpty: false,
  emptyStateReason: null,
};

export const PREVIEW_EVENT_TYPE_REGRESSION_EXTENSIONS: readonly InfoboardEventPresentationExtension[] =
  PREVIEW_TOURNAMENT_4TEAM_EXTENSIONS.map((extension) => ({
    ...extension,
    eventId: "evt-reg-tournament",
  }));
