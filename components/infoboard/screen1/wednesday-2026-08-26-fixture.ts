/**
 * Wednesday 26.08.2026 — permanent Screen 1 regression fixture (FC Allschwil).
 *
 * INFOBOARD-REGRESSION-01D golden day covering cohort integrity, adaptive
 * card sizing, row alignment, and left TIME-card behaviour.
 */

import type { InfoboardScreen1Feed, InfoboardScreen1Event } from "@/lib/publishing/event-types";

const TZ = "Europe/Zurich";
const DISPLAY_DATE = "2026-08-26";

const TENANT = {
  id: "tenant-fca",
  key: "fc-allschwil",
  name: "FC ALLSCHWIL",
  timezone: TZ,
} as const;

function training(
  id: string,
  teamDisplayName: string,
  startAt: string,
  endAt: string,
  pitchLabel: string,
  kabine: string,
  temporalBucket: "current" | "next" | "later",
): InfoboardScreen1Event {
  return {
    id,
    type: "TRAINING",
    displayTitle: teamDisplayName,
    teamDisplayName,
    opponentDisplayName: null,
    opponentLogoUrl: null,
    matchPresentation: null,
    organizerDisplayName: null,
    competitionLabel: null,
    startAt,
    endAt,
    meetingTime: null,
    status: "SCHEDULED",
    resultLabel: null,
    intermediateResultLabel: null,
    temporalBucket,
    seasonKey: "2025-26",
    allocation: {
      pitchLabel,
      homeDressingRoomLabel: kabine,
      awayDressingRoomLabel: null,
      refereeDressingRoomLabel: null,
    },
  };
}

function match(
  id: string,
  teamDisplayName: string,
  opponentDisplayName: string,
  startAt: string,
  endAt: string,
  pitchLabel: string,
  homeKabine: string,
  awayKabine: string,
  temporalBucket: "current" | "next" | "later",
): InfoboardScreen1Event {
  return {
    id,
    type: "MATCH",
    displayTitle: teamDisplayName,
    teamDisplayName,
    opponentDisplayName,
    opponentLogoUrl: null,
    matchPresentation: null,
    organizerDisplayName: null,
    competitionLabel: "MEISTERSCHAFT",
    startAt,
    endAt,
    meetingTime: null,
    status: "SCHEDULED",
    resultLabel: null,
    intermediateResultLabel: null,
    temporalBucket,
    seasonKey: "2025-26",
    allocation: {
      pitchLabel,
      homeDressingRoomLabel: homeKabine,
      awayDressingRoomLabel: awayKabine,
      refereeDressingRoomLabel: null,
    },
  };
}

/** 15:45 cohort — mixed end times (F3 ends 18:45). */
const COHORT_1545 = [
  training("wed-e3", "JUNIOREN E3", "2026-08-26T13:45:00.000Z", "2026-08-26T15:15:00.000Z", "KR 2 – FELD B", "Kabine E2", "later"),
  training("wed-f2", "JUNIOREN F2", "2026-08-26T13:45:00.000Z", "2026-08-26T15:15:00.000Z", "KR 3 – FELD A", "Kabine E3", "later"),
  training("wed-f3", "JUNIOREN F3", "2026-08-26T13:45:00.000Z", "2026-08-26T16:45:00.000Z", "KR 3 – FELD B", "Kabine E4", "later"),
  training("wed-g", "JUNIOREN G", "2026-08-26T13:45:00.000Z", "2026-08-26T15:15:00.000Z", "KR 1 – FELD A", "Kabine E1", "later"),
] as const;

/** 17:15 cohort — six simultaneous trainings. */
const COHORT_1715 = [
  training("wed-d7-d1", "JUNIOREN D-7 D1", "2026-08-26T15:15:00.000Z", "2026-08-26T16:45:00.000Z", "KR 1 – FELD B", "Kabine D1", "later"),
  training("wed-e4", "JUNIOREN E4", "2026-08-26T15:15:00.000Z", "2026-08-26T16:45:00.000Z", "KR 2 – FELD A", "Kabine E4", "later"),
  training("wed-e1", "JUNIOREN E1", "2026-08-26T15:15:00.000Z", "2026-08-26T16:45:00.000Z", "KR 2 – FELD B", "Kabine E1", "later"),
  training("wed-f1", "JUNIOREN F1", "2026-08-26T15:15:00.000Z", "2026-08-26T16:45:00.000Z", "KR 3 – FELD A", "Kabine F1", "later"),
  training("wed-d7-d2", "JUNIOREN D-7 D2", "2026-08-26T15:15:00.000Z", "2026-08-26T16:45:00.000Z", "KR 3 – FELD B", "Kabine D2", "later"),
] as const;

/** 18:45 cohort — dense six-row training block. */
const COHORT_1845 = [
  training("wed-s50", "SENIOREN 50+", "2026-08-26T16:45:00.000Z", "2026-08-26T18:15:00.000Z", "KUNSTRASEN 1", "Kabine 1", "later"),
  training("wed-tg", "TRAININGSGRUPPE", "2026-08-26T16:45:00.000Z", "2026-08-26T18:15:00.000Z", "KUNSTRASEN 2", "Kabine 2", "later"),
  training("wed-s40", "SENIOREN 40+", "2026-08-26T16:45:00.000Z", "2026-08-26T18:15:00.000Z", "STADION", "Kabine 3", "later"),
  training("wed-d9-d1", "JUNIOREN D-9 D1", "2026-08-26T16:45:00.000Z", "2026-08-26T18:15:00.000Z", "KR 1 – FELD A", "Kabine D9-1", "later"),
  training("wed-d9-d2", "JUNIOREN D-9 D2", "2026-08-26T16:45:00.000Z", "2026-08-26T18:15:00.000Z", "KR 1 – FELD B", "Kabine D9-2", "later"),
  training("wed-d9-d3", "JUNIOREN D-9 D3", "2026-08-26T16:45:00.000Z", "2026-08-26T18:15:00.000Z", "KR 2 – FELD A", "Kabine D9-3", "later"),
] as const;

const EVENT_1945 = match(
  "wed-1m",
  "1. MANNSCHAFT",
  "FC MUTTENZ",
  "2026-08-26T17:45:00.000Z",
  "2026-08-26T19:45:00.000Z",
  "STADION",
  "Kabine 1",
  "Kabine 2",
  "later",
);

/** 20:15 cohort — two trainings. */
const COHORT_2015 = [
  training("wed-s30", "SENIOREN 30+", "2026-08-26T18:15:00.000Z", "2026-08-26T19:45:00.000Z", "KUNSTRASEN 1", "Kabine 4", "later"),
  training("wed-ja", "JUNIOREN A", "2026-08-26T18:15:00.000Z", "2026-08-26T19:45:00.000Z", "STADION", "Kabine A", "later"),
] as const;

export const WEDNESDAY_2026_08_26_ALL_EVENTS: readonly InfoboardScreen1Event[] = [
  ...COHORT_1545,
  ...COHORT_1715,
  ...COHORT_1845,
  EVENT_1945,
  ...COHORT_2015,
];

export const WEDNESDAY_2026_08_26_PREVIEW_TIMES = {
  "15:44": "2026-08-26T13:44:00.000Z",
  "15:45": "2026-08-26T13:45:00.000Z",
  "17:14": "2026-08-26T15:14:00.000Z",
  "17:15": "2026-08-26T15:15:00.000Z",
  "18:44": "2026-08-26T16:44:00.000Z",
  "18:45": "2026-08-26T16:45:00.000Z",
  "19:45": "2026-08-26T17:45:00.000Z",
  "20:15": "2026-08-26T18:15:00.000Z",
} as const;

export type WednesdayPreviewAtKey = keyof typeof WEDNESDAY_2026_08_26_PREVIEW_TIMES;

export function isWednesdayPreviewAtKey(value: string): value is WednesdayPreviewAtKey {
  return Object.prototype.hasOwnProperty.call(WEDNESDAY_2026_08_26_PREVIEW_TIMES, value);
}

export function resolveWednesdayPreviewCurrentTimeIso(at: string): string {
  if (isWednesdayPreviewAtKey(at)) {
    return WEDNESDAY_2026_08_26_PREVIEW_TIMES[at];
  }
  return WEDNESDAY_2026_08_26_PREVIEW_TIMES["15:45"];
}

function assignTemporalBuckets(
  events: readonly InfoboardScreen1Event[],
  nowIso: string,
): {
  current: InfoboardScreen1Event[];
  next: InfoboardScreen1Event[];
  later: InfoboardScreen1Event[];
} {
  const nowMs = new Date(nowIso).getTime();
  const sorted = [...events].sort(
    (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
  );

  const upcoming = sorted.filter((event) => {
    const endMs = event.endAt !== null ? new Date(event.endAt).getTime() : new Date(event.startAt).getTime();
    return endMs > nowMs;
  });

  const current = upcoming.filter((event) => new Date(event.startAt).getTime() <= nowMs);
  const future = upcoming.filter((event) => new Date(event.startAt).getTime() > nowMs);

  const withBucket = (event: InfoboardScreen1Event, bucket: "current" | "next" | "later") => ({
    ...event,
    temporalBucket: bucket,
  });

  if (current.length > 0) {
    return {
      current: current.map((event) => withBucket(event, "current")),
      next: future.length > 0 ? [withBucket(future[0], "next")] : [],
      later: future.slice(1).map((event) => withBucket(event, "later")),
    };
  }

  return {
    current: [],
    next: future.length > 0 ? [withBucket(future[0], "next")] : [],
    later: future.slice(1).map((event) => withBucket(event, "later")),
  };
}

export function buildWednesday20260826Feed(nowIso: string): InfoboardScreen1Feed {
  const buckets = assignTemporalBuckets(WEDNESDAY_2026_08_26_ALL_EVENTS, nowIso);
  const visibleCount =
    buckets.current.length + buckets.next.length + buckets.later.length;

  return {
    generatedAt: nowIso,
    tenant: TENANT,
    displayDate: DISPLAY_DATE,
    isStale: false,
    wochenplanVariantBadge: null,
    ...buckets,
    isEmpty: visibleCount === 0,
    emptyStateReason: visibleCount === 0 ? "DAY_COMPLETED" : null,
  };
}

export const WEDNESDAY_COHORT_TEAM_NAMES = {
  at1545: ["JUNIOREN E3", "JUNIOREN F2", "JUNIOREN F3", "JUNIOREN G"],
  at1715: ["JUNIOREN D-7 D1", "JUNIOREN E4", "JUNIOREN E1", "JUNIOREN F1", "JUNIOREN D-7 D2"],
  at1845: [
    "SENIOREN 50+",
    "TRAININGSGRUPPE",
    "SENIOREN 40+",
    "JUNIOREN D-9 D1",
    "JUNIOREN D-9 D2",
    "JUNIOREN D-9 D3",
  ],
  at1945: ["1. MANNSCHAFT"],
  at2015: ["SENIOREN 30+", "JUNIOREN A"],
} as const;
