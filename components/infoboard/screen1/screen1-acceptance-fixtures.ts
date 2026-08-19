/**
 * components/infoboard/screen1/screen1-acceptance-fixtures.ts
 *
 * PREVIEW-ONLY — deterministic scenario fixtures for the Screen 1
 * acceptance harness (/infoboard/screen-1-preview).
 *
 * MUST NOT be imported by production feed builders, API routes, or any
 * file that is reachable from the production runtime path.
 *
 * Each fixture maps to a named scenario accessible via ?scenario=<id>.
 *
 * Exported functions / constants:
 *   ACCEPTANCE_SCENARIOS_S1   — ordered scenario metadata
 *   getAcceptanceFixtureS1()  — returns feed + eventPresentation for a scenario
 *   LAYOUT_MODE_SPARSE_THRESHOLD — demand boundary between sparse and fill modes
 *   layoutModeS1()            — maps totalDemand → "sparse" | "fill"
 */

import type { InfoboardScreen1Feed } from "@/lib/publishing/event-types";
import type { InfoboardEventPresentationExtension } from "./screen1-presentation-types";
import {
  computeTrainingGroupDemand,
  computeEventDemand,
  CARD_DEMAND_MATCH,
} from "./InfoboardScreen1";

// ── Shared preview tenant ─────────────────────────────────────────────────────

const PREVIEW_TENANT = {
  id: "tenant-preview-fca",
  key: "fc-allschwil",
  name: "FC Allschwil",
  timezone: "Europe/Zurich",
} as const;

// ── Preview current time (17:35 Zurich) ──────────────────────────────────────

export const ACCEPTANCE_CURRENT_TIME_ISO_S1 = "2026-09-12T15:35:00.000Z" as const;

// ── Sparse / fill layout mode ─────────────────────────────────────────────────

/**
 * Preview-only threshold that separates "sparse" (few cards, visible dark
 * background below) from "fill" (cards fill the content viewport).
 *
 * Set to 4 demand units = slightly more than two MATCH cards (2 × 1.5 = 3.0),
 * so two matches → sparse, and moderately dense days → fill.
 *
 * This value is preview-only and not used by the production layout engine.
 */
export const LAYOUT_MODE_SPARSE_THRESHOLD = 4.0;

/**
 * Maps total page demand to a human-readable layout mode label for the
 * debug readout. Uses the real demand constants — does not duplicate values.
 */
export function layoutModeS1(totalDemand: number): "sparse" | "fill" {
  return totalDemand >= LAYOUT_MODE_SPARSE_THRESHOLD ? "fill" : "sparse";
}

// ── Scenario metadata ─────────────────────────────────────────────────────────

export type AcceptanceScenarioId =
  | "one-match"
  | "one-training"
  | "two-matches"
  | "dense"
  | "long-text"
  | "alignment";

export type AcceptanceScenarioMeta = {
  id: AcceptanceScenarioId;
  label: string;
  description: string;
};

export const ACCEPTANCE_SCENARIOS_S1: readonly AcceptanceScenarioMeta[] = [
  {
    id: "one-match",
    label: "1 Match",
    description: "Sparse: single home match — dark background visible below card",
  },
  {
    id: "one-training",
    label: "1 Training",
    description: "Sparse: single training group — no giant card",
  },
  {
    id: "two-matches",
    label: "2 Matches",
    description: "Sparse: two matches — combined demand still below fill threshold",
  },
  {
    id: "dense",
    label: "Dense",
    description: "Fill: mixed events exceed fill threshold — board fills content area",
  },
  {
    id: "long-text",
    label: "Long Text",
    description: "Stress: very long names, long Platz and Kabine — readability check",
  },
  {
    id: "alignment",
    label: "Alignment",
    description: "Alignment: Match + Turnier cards — Meisterschaft/Kabine/Platz positions",
  },
];

export const DEFAULT_SCENARIO_S1: AcceptanceScenarioId = "one-match";

// ── Helper to build a minimal feed ───────────────────────────────────────────

function makeFeed(
  partial: Partial<InfoboardScreen1Feed> &
    Required<Pick<InfoboardScreen1Feed, "current" | "next" | "later">>,
): InfoboardScreen1Feed {
  return {
    generatedAt: ACCEPTANCE_CURRENT_TIME_ISO_S1,
    tenant: PREVIEW_TENANT,
    displayDate: "2026-09-12",
    isStale: false,
    wochenplanVariantBadge: null,
    isEmpty: false,
    emptyStateReason: null,
    ...partial,
  };
}

// ── Scenario A: 1 Match ───────────────────────────────────────────────────────

/**
 * One realistic home match.
 * Purpose: verify sparse mode — card must not stretch to full viewport height.
 * Expected demand: CARD_DEMAND_MATCH = 1.5 → sparse.
 */
export const ACCEPTANCE_FIXTURE_ONE_MATCH: InfoboardScreen1Feed = makeFeed({
  current: [
    {
      id: "acc-s1-match-1",
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
});

// ── Scenario B: 1 Training ────────────────────────────────────────────────────

/**
 * One training with a small participant group.
 * Purpose: verify sparse training layout — no giant card.
 * Expected demand: computeTrainingGroupDemand(1) = 1.55 → sparse.
 */
export const ACCEPTANCE_FIXTURE_ONE_TRAINING: InfoboardScreen1Feed = makeFeed({
  current: [
    {
      id: "acc-s1-training-1",
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
        pitchLabel: "Kunstrasen 2",
        homeDressingRoomLabel: "Kabine 04",
        awayDressingRoomLabel: null,
        refereeDressingRoomLabel: null,
      },
    },
  ],
  next: [],
  later: [],
});

// ── Scenario C: 2 Matches ─────────────────────────────────────────────────────

/**
 * Two home matches at different start times.
 * Purpose: combined demand 3.0 < threshold → both remain naturally sized.
 * Expected demand: 2 × CARD_DEMAND_MATCH = 3.0 → sparse.
 */
export const ACCEPTANCE_FIXTURE_TWO_MATCHES: InfoboardScreen1Feed = makeFeed({
  current: [
    {
      id: "acc-s1-match-2a",
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
  next: [
    {
      id: "acc-s1-match-2b",
      type: "MATCH",
      displayTitle: "FC Allschwil D1 – SC Basler Nord D1",
      teamDisplayName: "FC Allschwil D1",
      opponentDisplayName: "SC Basler Nord D1",
      opponentLogoUrl: null,
      organizerDisplayName: null,
      competitionLabel: "Meisterschaft",
      startAt: "2026-09-12T17:30:00.000Z",
      endAt: null,
      meetingTime: null,
      status: "SCHEDULED",
      resultLabel: null,
      intermediateResultLabel: null,
      temporalBucket: "next",
      seasonKey: "2026-27",
      allocation: {
        pitchLabel: "Kunstrasen 1",
        homeDressingRoomLabel: "Kabine D1",
        awayDressingRoomLabel: "Kabine D2",
        refereeDressingRoomLabel: null,
      },
    },
  ],
  later: [],
});

// ── Scenario D: Dense ─────────────────────────────────────────────────────────

/**
 * High-density mixed day.
 * Purpose: board fills content viewport — cards proportional to demand.
 *
 * Composition (grouped training start times + match + tournament):
 *   GROUP-1 (3 trainings at 15:00Z) demand = computeTrainingGroupDemand(3) = 2.65
 *   MATCH   (16:00Z)                demand = CARD_DEMAND_MATCH              = 1.5
 *   GROUP-2 (2 trainings at 17:30Z) demand = computeTrainingGroupDemand(2)  = 2.1
 *   TURNIER (18:00Z)                demand = computeEventDemand("TOURNAMENT",4) = 2.7
 *   Total ≈ 8.95 → above fill threshold (4.0) → fill mode.
 */
export const ACCEPTANCE_FIXTURE_DENSE: InfoboardScreen1Feed = makeFeed({
  current: [
    {
      id: "acc-dense-t1",
      type: "TRAINING",
      displayTitle: "Junioren F2",
      teamDisplayName: "FC Allschwil Junioren F2",
      opponentDisplayName: null,
      opponentLogoUrl: null,
      organizerDisplayName: null,
      competitionLabel: null,
      startAt: "2026-09-12T13:00:00.000Z",
      endAt: "2026-09-12T14:30:00.000Z",
      meetingTime: null,
      status: "LIVE",
      resultLabel: null,
      intermediateResultLabel: null,
      temporalBucket: "current",
      seasonKey: "2026-27",
      allocation: {
        pitchLabel: "KR2",
        homeDressingRoomLabel: "Kabine 01",
        awayDressingRoomLabel: null,
        refereeDressingRoomLabel: null,
      },
    },
    {
      id: "acc-dense-t2",
      type: "TRAINING",
      displayTitle: "Junioren E3",
      teamDisplayName: "FC Allschwil Junioren E3",
      opponentDisplayName: null,
      opponentLogoUrl: null,
      organizerDisplayName: null,
      competitionLabel: null,
      startAt: "2026-09-12T13:00:00.000Z",
      endAt: "2026-09-12T14:30:00.000Z",
      meetingTime: null,
      status: "LIVE",
      resultLabel: null,
      intermediateResultLabel: null,
      temporalBucket: "current",
      seasonKey: "2026-27",
      allocation: {
        pitchLabel: "KR3",
        homeDressingRoomLabel: "Kabine 02",
        awayDressingRoomLabel: null,
        refereeDressingRoomLabel: null,
      },
    },
    {
      id: "acc-dense-t3",
      type: "TRAINING",
      displayTitle: "Aktive Herren",
      teamDisplayName: "FC Allschwil Aktive Herren",
      opponentDisplayName: null,
      opponentLogoUrl: null,
      organizerDisplayName: null,
      competitionLabel: null,
      startAt: "2026-09-12T13:00:00.000Z",
      endAt: "2026-09-12T14:30:00.000Z",
      meetingTime: null,
      status: "LIVE",
      resultLabel: null,
      intermediateResultLabel: null,
      temporalBucket: "current",
      seasonKey: "2026-27",
      allocation: {
        pitchLabel: "Stadion",
        homeDressingRoomLabel: "Kabine A",
        awayDressingRoomLabel: null,
        refereeDressingRoomLabel: null,
      },
    },
  ],
  next: [
    {
      id: "acc-dense-match",
      type: "MATCH",
      displayTitle: "FC Allschwil C2 – FC Therwil C Gelb",
      teamDisplayName: "FC Allschwil C2",
      opponentDisplayName: "FC Therwil C Gelb",
      opponentLogoUrl: null,
      organizerDisplayName: null,
      competitionLabel: "Meisterschaft",
      startAt: "2026-09-12T16:00:00.000Z",
      endAt: null,
      meetingTime: null,
      status: "SCHEDULED",
      resultLabel: null,
      intermediateResultLabel: null,
      temporalBucket: "next",
      seasonKey: "2026-27",
      allocation: {
        pitchLabel: "Stadion",
        homeDressingRoomLabel: "Kabine C2",
        awayDressingRoomLabel: "Kabine C3",
        refereeDressingRoomLabel: null,
      },
    },
  ],
  later: [
    {
      id: "acc-dense-t4",
      type: "TRAINING",
      displayTitle: "Juniorinnen FF-17",
      teamDisplayName: "FC Allschwil Juniorinnen FF-17",
      opponentDisplayName: null,
      opponentLogoUrl: null,
      organizerDisplayName: null,
      competitionLabel: null,
      startAt: "2026-09-12T17:30:00.000Z",
      endAt: "2026-09-12T19:00:00.000Z",
      meetingTime: null,
      status: "SCHEDULED",
      resultLabel: null,
      intermediateResultLabel: null,
      temporalBucket: "later",
      seasonKey: "2026-27",
      allocation: {
        pitchLabel: "KR2",
        homeDressingRoomLabel: "Kabine 03",
        awayDressingRoomLabel: null,
        refereeDressingRoomLabel: null,
      },
    },
    {
      id: "acc-dense-t5",
      type: "TRAINING",
      displayTitle: "Junioren D9 D1",
      teamDisplayName: "FC Allschwil Junioren D9 D1",
      opponentDisplayName: null,
      opponentLogoUrl: null,
      organizerDisplayName: null,
      competitionLabel: null,
      startAt: "2026-09-12T17:30:00.000Z",
      endAt: "2026-09-12T19:00:00.000Z",
      meetingTime: null,
      status: "SCHEDULED",
      resultLabel: null,
      intermediateResultLabel: null,
      temporalBucket: "later",
      seasonKey: "2026-27",
      allocation: {
        pitchLabel: "KR3",
        homeDressingRoomLabel: "Kabine 04",
        awayDressingRoomLabel: null,
        refereeDressingRoomLabel: null,
      },
    },
    {
      id: "acc-dense-tournament",
      type: "TOURNAMENT",
      displayTitle: "Kinderfussball E-Junioren Turnier",
      teamDisplayName: "FC Allschwil",
      opponentDisplayName: null,
      opponentLogoUrl: null,
      organizerDisplayName: "FC Allschwil",
      competitionLabel: "Kinderfussball",
      startAt: "2026-09-12T18:00:00.000Z",
      endAt: "2026-09-12T20:00:00.000Z",
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
  ],
});

export const ACCEPTANCE_DENSE_EXTENSIONS: readonly InfoboardEventPresentationExtension[] = [
  {
    eventId: "acc-dense-tournament",
    participantAllocations: [
      { id: "acc-d-pa1", teamDisplayName: "FC Allschwil E1", dressingRoomLabel: "Kabine A", isHomeTeam: true },
      { id: "acc-d-pa2", teamDisplayName: "FC Allschwil E2", dressingRoomLabel: "Kabine B", isHomeTeam: true },
      { id: "acc-d-pa3", teamDisplayName: "FC Binningen E1", dressingRoomLabel: "Kabine C" },
      { id: "acc-d-pa4", teamDisplayName: "FC Aesch E1", dressingRoomLabel: "Kabine D" },
    ],
  },
];

// ── Scenario E: Long Text ─────────────────────────────────────────────────────

/**
 * Deliberately long / difficult content.
 * Purpose: text remains readable, wrapping behaves correctly, no overflow.
 */
export const ACCEPTANCE_FIXTURE_LONG_TEXT: InfoboardScreen1Feed = makeFeed({
  current: [
    {
      id: "acc-long-match",
      type: "MATCH",
      displayTitle:
        "FC Allschwil Aktive Herren Erste Mannschaft – FC Reinach Amateure Erste Mannschaft",
      teamDisplayName: "FC Allschwil Aktive Herren Erste Mannschaft",
      opponentDisplayName: "FC Reinach Amateure Erste Mannschaft",
      opponentLogoUrl: null,
      organizerDisplayName: null,
      competitionLabel: "Meisterschaft 4. Liga Gruppe 5 Nordwestschweiz",
      startAt: "2026-09-12T15:00:00.000Z",
      endAt: "2026-09-12T16:45:00.000Z",
      meetingTime: null,
      status: "LIVE",
      resultLabel: null,
      intermediateResultLabel: null,
      temporalBucket: "current",
      seasonKey: "2026-27",
      allocation: {
        pitchLabel: "Hauptspielfeld Stadion Brüelstadion Im Brüel",
        homeDressingRoomLabel: "Kabine Aktive Herren Nordkurve Untergeschoss",
        awayDressingRoomLabel: "Kabine Gäste Südkurve Untergeschoss",
        refereeDressingRoomLabel: null,
      },
    },
  ],
  next: [
    {
      id: "acc-long-training",
      type: "TRAINING",
      displayTitle:
        "FC Allschwil Junioren D-9 Nachwuchs Zweite Mannschaft Frühjahrsgruppe",
      teamDisplayName:
        "FC Allschwil Junioren D-9 Nachwuchs Zweite Mannschaft Frühjahrsgruppe",
      opponentDisplayName: null,
      opponentLogoUrl: null,
      organizerDisplayName: "FC Allschwil Jugendabteilung",
      competitionLabel: null,
      startAt: "2026-09-12T17:00:00.000Z",
      endAt: "2026-09-12T18:30:00.000Z",
      meetingTime: null,
      status: "SCHEDULED",
      resultLabel: null,
      intermediateResultLabel: null,
      temporalBucket: "next",
      seasonKey: "2026-27",
      allocation: {
        pitchLabel: "Kunstrasen 2 Feld A Nordseite",
        homeDressingRoomLabel: "Kabine Junioren D Untergeschoss Nordflügel",
        awayDressingRoomLabel: null,
        refereeDressingRoomLabel: null,
      },
    },
  ],
  later: [],
});

// ── Scenario F: Alignment ─────────────────────────────────────────────────────

/**
 * Match card + Turnier card side by side.
 * Purpose: KABINE and PLATZ labels must align at identical vertical positions
 * between the Match card and the Turnier card.
 */
export const ACCEPTANCE_FIXTURE_ALIGNMENT: InfoboardScreen1Feed = makeFeed({
  current: [
    {
      id: "acc-align-match",
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
  next: [
    {
      id: "acc-align-tournament",
      type: "TOURNAMENT",
      displayTitle: "Sommer-Cup Junioren E",
      teamDisplayName: "FC Allschwil Junioren",
      opponentDisplayName: null,
      opponentLogoUrl: null,
      organizerDisplayName: "FC Allschwil",
      competitionLabel: "Sommer-Cup",
      startAt: "2026-09-12T17:00:00.000Z",
      endAt: "2026-09-12T19:00:00.000Z",
      meetingTime: null,
      status: "SCHEDULED",
      resultLabel: null,
      intermediateResultLabel: null,
      temporalBucket: "next",
      seasonKey: "2026-27",
      allocation: {
        pitchLabel: "KR2 + KR3",
        homeDressingRoomLabel: null,
        awayDressingRoomLabel: null,
        refereeDressingRoomLabel: null,
      },
    },
  ],
  later: [],
});

export const ACCEPTANCE_ALIGNMENT_EXTENSIONS: readonly InfoboardEventPresentationExtension[] = [
  {
    eventId: "acc-align-tournament",
    participantAllocations: [
      { id: "acc-al-pa1", teamDisplayName: "FC Allschwil E1", dressingRoomLabel: "Kabine 01", isHomeTeam: true },
      { id: "acc-al-pa2", teamDisplayName: "FC Allschwil E2", dressingRoomLabel: "Kabine 02", isHomeTeam: true },
      { id: "acc-al-pa3", teamDisplayName: "FC Binningen E1", dressingRoomLabel: "Kabine 03" },
      { id: "acc-al-pa4", teamDisplayName: "FC Oberwil E1", dressingRoomLabel: "Kabine 04" },
    ],
  },
];

// ── Fixture registry ──────────────────────────────────────────────────────────

export type AcceptanceFixtureS1 = {
  feed: InfoboardScreen1Feed;
  eventPresentation: readonly InfoboardEventPresentationExtension[];
};

/**
 * Returns the feed and eventPresentation for the given scenario.
 * Falls back to DEFAULT_SCENARIO_S1 when scenarioId is unknown.
 */
export function getAcceptanceFixtureS1(
  scenarioId: string | null | undefined,
): AcceptanceFixtureS1 {
  switch (scenarioId) {
    case "one-match":
      return { feed: ACCEPTANCE_FIXTURE_ONE_MATCH, eventPresentation: [] };
    case "one-training":
      return { feed: ACCEPTANCE_FIXTURE_ONE_TRAINING, eventPresentation: [] };
    case "two-matches":
      return { feed: ACCEPTANCE_FIXTURE_TWO_MATCHES, eventPresentation: [] };
    case "dense":
      return {
        feed: ACCEPTANCE_FIXTURE_DENSE,
        eventPresentation: ACCEPTANCE_DENSE_EXTENSIONS,
      };
    case "long-text":
      return { feed: ACCEPTANCE_FIXTURE_LONG_TEXT, eventPresentation: [] };
    case "alignment":
      return {
        feed: ACCEPTANCE_FIXTURE_ALIGNMENT,
        eventPresentation: ACCEPTANCE_ALIGNMENT_EXTENSIONS,
      };
    default:
      return { feed: ACCEPTANCE_FIXTURE_ONE_MATCH, eventPresentation: [] };
  }
}

/**
 * Computes the total demand for the first page of a given feed.
 * Uses the same demand functions as the production layout engine.
 *
 * This is called from the preview page to populate the debug readout.
 * It does NOT duplicate any production layout logic — it calls the exported
 * production functions.
 */
export function computeTotalDemandS1(
  feed: InfoboardScreen1Feed,
  eventPresentation: readonly InfoboardEventPresentationExtension[],
): number {
  const allEvents = [...feed.current, ...feed.next, ...feed.later];

  // Group trainings by startAt (matching InfoboardScreen1 logic)
  const trainingByStart = new Map<string, number>();
  for (const event of allEvents) {
    if (event.type === "TRAINING") {
      trainingByStart.set(event.startAt, (trainingByStart.get(event.startAt) ?? 0) + 1);
    }
  }

  const counted = new Set<string>();
  let total = 0;

  for (const event of allEvents) {
    if (event.type === "TRAINING") {
      if (counted.has(event.startAt)) continue;
      counted.add(event.startAt);
      total += computeTrainingGroupDemand(trainingByStart.get(event.startAt) ?? 1);
    } else {
      const ext = eventPresentation.find((e) => e.eventId === event.id);
      const rawAllocCount = ext?.participantAllocations?.length ?? 0;
      const allocCount = rawAllocCount >= 3 ? rawAllocCount : 0;
      total += computeEventDemand(event.type, allocCount);
    }
  }

  return total;
}

// ── Re-export demand constants for debug readout ──────────────────────────────

export { CARD_DEMAND_MATCH };
