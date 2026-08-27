/**
 * Thursday 27.08.2026 — Screen 1 physical-TV viewport regression fixture.
 *
 * INFOBOARD-KIOSK-VIEWPORT-01B golden day: dense single-page schedule with
 * 17:15 (1 row), 18:45 (5 rows), 20:15 (3 rows).
 */

import type { InfoboardScreen1Feed, InfoboardScreen1Event } from "@/lib/publishing/event-types";

const TZ = "Europe/Zurich";
const DISPLAY_DATE = "2026-08-27";

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

const COHORT_1715 = [
  training(
    "thu-ff11",
    "JUNIORINNEN FF-11",
    "2026-08-27T15:15:00.000Z",
    "2026-08-27T16:45:00.000Z",
    "KR 1 – FELD A",
    "Kabine FF11",
    "later",
  ),
] as const;

const COHORT_1845 = [
  training(
    "thu-b1",
    "JUNIOREN B1",
    "2026-08-27T16:45:00.000Z",
    "2026-08-27T18:15:00.000Z",
    "KR 2 – FELD A",
    "Kabine B1",
    "later",
  ),
  training(
    "thu-c1",
    "JUNIOREN C1",
    "2026-08-27T16:45:00.000Z",
    "2026-08-27T18:15:00.000Z",
    "KR 2 – FELD B",
    "Kabine C1",
    "later",
  ),
  training(
    "thu-c2",
    "JUNIOREN C2",
    "2026-08-27T16:45:00.000Z",
    "2026-08-27T18:15:00.000Z",
    "KR 3 – FELD A",
    "Kabine C2",
    "later",
  ),
  training(
    "thu-ff14",
    "JUNIORINNEN FF-14",
    "2026-08-27T16:45:00.000Z",
    "2026-08-27T18:15:00.000Z",
    "KR 3 – FELD B",
    "Kabine FF14",
    "later",
  ),
  training(
    "thu-ff17",
    "JUNIORINNEN FF-17",
    "2026-08-27T16:45:00.000Z",
    "2026-08-27T18:15:00.000Z",
    "STADION",
    "Kabine FF17",
    "later",
  ),
] as const;

const COHORT_2015 = [
  training(
    "thu-2m",
    "2. MANNSCHAFT",
    "2026-08-27T18:15:00.000Z",
    "2026-08-27T19:45:00.000Z",
    "KUNSTRASEN 1",
    "Kabine 2M",
    "later",
  ),
  training(
    "thu-f1",
    "FRAUEN 1",
    "2026-08-27T18:15:00.000Z",
    "2026-08-27T19:45:00.000Z",
    "KUNSTRASEN 2",
    "Kabine F1",
    "later",
  ),
  training(
    "thu-b2",
    "JUNIOREN B2",
    "2026-08-27T18:15:00.000Z",
    "2026-08-27T19:45:00.000Z",
    "STADION",
    "Kabine B2",
    "later",
  ),
] as const;

export const THURSDAY_2026_08_27_ALL_EVENTS: readonly InfoboardScreen1Event[] = [
  ...COHORT_1715,
  ...COHORT_1845,
  ...COHORT_2015,
];

export const THURSDAY_2026_08_27_PREVIEW_TIMES = {
  "14:00": "2026-08-27T12:00:00.000Z",
  "17:14": "2026-08-27T15:14:00.000Z",
  "17:15": "2026-08-27T15:15:00.000Z",
  "18:44": "2026-08-27T16:44:00.000Z",
  "18:45": "2026-08-27T16:45:00.000Z",
  "20:14": "2026-08-27T18:14:00.000Z",
  "20:15": "2026-08-27T18:15:00.000Z",
} as const;

export type ThursdayPreviewAtKey = keyof typeof THURSDAY_2026_08_27_PREVIEW_TIMES;

export function isThursdayPreviewAtKey(value: string): value is ThursdayPreviewAtKey {
  return Object.prototype.hasOwnProperty.call(THURSDAY_2026_08_27_PREVIEW_TIMES, value);
}

export function resolveThursdayPreviewCurrentTimeIso(at: string): string {
  if (isThursdayPreviewAtKey(at)) {
    return THURSDAY_2026_08_27_PREVIEW_TIMES[at];
  }
  return THURSDAY_2026_08_27_PREVIEW_TIMES["14:00"];
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
    const endMs =
      event.endAt !== null
        ? new Date(event.endAt).getTime()
        : new Date(event.startAt).getTime();
    return endMs > nowMs;
  });

  const current = upcoming.filter((event) => new Date(event.startAt).getTime() <= nowMs);
  const future = upcoming.filter((event) => new Date(event.startAt).getTime() > nowMs);

  const withBucket = (
    event: InfoboardScreen1Event,
    bucket: "current" | "next" | "later",
  ) => ({
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

  if (future.length === 0) {
    return { current: [], next: [], later: [] };
  }

  const earliestStartMs = new Date(future[0].startAt).getTime();
  const nextCohort = future.filter(
    (event) => new Date(event.startAt).getTime() === earliestStartMs,
  );
  const laterEvents = future.filter(
    (event) => new Date(event.startAt).getTime() !== earliestStartMs,
  );

  return {
    current: [],
    next: nextCohort.map((event) => withBucket(event, "next")),
    later: laterEvents.map((event) => withBucket(event, "later")),
  };
}

export function buildThursday20260827Feed(nowIso: string): InfoboardScreen1Feed {
  const buckets = assignTemporalBuckets(THURSDAY_2026_08_27_ALL_EVENTS, nowIso);
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

export const THURSDAY_COHORT_TEAM_NAMES = {
  at1715: ["JUNIORINNEN FF-11"],
  at1845: ["JUNIOREN B1", "JUNIOREN C1", "JUNIOREN C2", "JUNIORINNEN FF-14", "JUNIORINNEN FF-17"],
  at2015: ["2. MANNSCHAFT", "FRAUEN 1", "JUNIOREN B2"],
} as const;
