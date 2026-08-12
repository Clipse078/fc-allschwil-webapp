import { prisma } from "@/lib/db/prisma";
import { batchGetEventAllocationDisplayForTenant } from "@/lib/facilities/display-helpers";
import { toLocalDateKey } from "@/lib/publishing/time/temporal-grouping";

// ---------------------------------------------------------------------------
// Domain classification constants
//
// These are the authoritative EventType sets for each public domain feed.
// All new endpoints MUST derive their event-type filtering from these constants
// rather than duplicating string literals.
//
// EventType enum: MATCH | TOURNAMENT | TRAINING | OTHER | VACATION_PERIOD
//   - Club events are EventType.OTHER (general club activities not classified as
//     matches, tournaments, or trainings).
//   - VACATION_PERIOD is an administrative planning type and is intentionally
//     excluded from all public website feeds.
// ---------------------------------------------------------------------------

/** EventType values for the /website/club-events feed. */
export const CLUB_EVENT_TYPES: string[] = ["OTHER"];

/** EventType values for the /website/matches feed. */
export const MATCH_EVENT_TYPES: string[] = ["MATCH"];

/** EventType values for the /website/tournaments feed. */
export const TOURNAMENT_EVENT_TYPES: string[] = ["TOURNAMENT"];

/** EventType values for the /website/trainings feed. */
export const TRAINING_EVENT_TYPES: string[] = ["TRAINING"];

// ---------------------------------------------------------------------------
// Timezone
// ---------------------------------------------------------------------------

/** Canonical IANA timezone for all public website date grouping. */
const WEBSITE_TIMEZONE = "Europe/Zurich";

export type PublicEventSurface =
  | "all"
  | "homepage"
  | "wochenplan"
  | "trainingsplan"
  | "team-page"
  | "infoboard";

export type GetPublicEventsInput = {
  surface: PublicEventSurface;
  /**
   * When provided, restricts results to events belonging to this tenant.
   * New website endpoints MUST always supply this. Legacy routes may omit it
   * for backward compatibility (single-tenant fallback path).
   */
  tenantId?: string | null;
  seasonKey?: string | null;
  teamSlug?: string | null;
  dateFrom?: string | null;
  dateTo?: string | null;
  limit?: number | null;
  /**
   * When provided, restricts results to events of the given EventType values.
   * Filtering is applied at the database query level.
   * Use the exported domain constants (MATCH_EVENT_TYPES, TRAINING_EVENT_TYPES,
   * TOURNAMENT_EVENT_TYPES, CLUB_EVENT_TYPES) rather than raw string literals.
   */
  eventTypes?: string[] | null;
  /**
   * Override the upper bound for limit normalisation.
   * The season-scope Wochenplan feed (scope=season) passes SEASON_SCOPE_MAX_LIMIT
   * so that a full season's worth of events can be returned in a single request.
   * Do NOT set this on default/weekly queries.
   */
  maxLimit?: number | null;
};

export type PublicEventItem = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  type: string;
  source: string;
  status: string;
  startAt: Date;
  endAt: Date | null;
  opponentName: string | null;
  organizerName: string | null;
  competitionLabel: string | null;
  homeAway: string | null;
  resultLabel: string | null;
  meetingTime: Date | null;
  visibility: {
    website: boolean;
    infoboard: boolean;
    homepage: boolean;
    wochenplan: boolean;
    trainingsplan: boolean;
    teamPage: boolean;
  };
  remarks: string | null;
  /** Allocation codes — null when not assigned. Raw codes, not display labels. */
  pitchCode: string | null;
  homeDressingRoomCode: string | null;
  awayDressingRoomCode: string | null;
  /** Null when the event's Season was deleted (ADMIN-DELETE-SEASON-01-C1). */
  season: {
    id: string;
    key: string;
    name: string;
    startDate: Date;
    endDate: Date;
    isActive: boolean;
  } | null;
  team: {
    id: string;
    name: string;
    slug: string;
    category: string;
    genderGroup: string | null;
    ageGroup: string | null;
  } | null;
};


type PublicEventQueryRow = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  type: string;
  source: string;
  status: string;
  startAt: Date;
  endAt: Date | null;
  opponentName: string | null;
  organizerName: string | null;
  competitionLabel: string | null;
  homeAway: string | null;
  resultLabel: string | null;
  meetingTime: Date | null;
  websiteVisible: boolean;
  infoboardVisible: boolean;
  homepageVisible: boolean;
  wochenplanVisible: boolean;
  trainingsplanVisible: boolean;
  teamPageVisible: boolean;
  remarks: string | null;
  pitchCode: string | null;
  homeDressingRoomCode: string | null;
  awayDressingRoomCode: string | null;
  /** Null when Event.seasonId was set null by Season deletion (ADMIN-DELETE-SEASON-01-C1). */
  season: {
    id: string;
    key: string;
    name: string;
    startDate: Date;
    endDate: Date;
    isActive: boolean;
  } | null;
  team: {
    id: string;
    name: string;
    slug: string;
    category: string;
    genderGroup: string | null;
    ageGroup: string | null;
  } | null;
};
/**
 * Maximum limit for a single-week/default query.
 * Season-scope queries use SEASON_SCOPE_MAX_LIMIT to cover a full season.
 */
const DEFAULT_MAX_LIMIT = 250;
/** Upper bound for season-scope Wochenplan queries (full active season). */
export const SEASON_SCOPE_MAX_LIMIT = 500;

function normalizeLimit(value?: number | null, max = DEFAULT_MAX_LIMIT) {
  if (!value || Number.isNaN(value)) {
    return 100;
  }

  return Math.max(1, Math.min(max, value));
}

function buildSurfaceWhere(surface: PublicEventSurface) {
  switch (surface) {
    case "homepage":
      // Homepage uses the same predicate as the website feed: websiteVisible only.
      // homepageVisible is a legacy field and must not independently gate homepage
      // match eligibility (PUB-02 policy decision — see docs/public-website-api.md).
      return { websiteVisible: true };
    case "wochenplan":
      return { websiteVisible: true, wochenplanVisible: true };
    case "trainingsplan":
      return { websiteVisible: true, trainingsplanVisible: true };
    case "team-page":
      return { websiteVisible: true, teamPageVisible: true };
    case "infoboard":
      return { infoboardVisible: true };
    case "all":
    default:
      return { websiteVisible: true };
  }
}

function toPublicEventItem(event: PublicEventQueryRow): PublicEventItem {
  return {
    id: event.id,
    title: event.title,
    description: event.description,
    location: event.location,
    type: event.type,
    source: event.source,
    status: event.status,
    startAt: event.startAt,
    endAt: event.endAt,
    opponentName: event.opponentName,
    organizerName: event.organizerName,
    competitionLabel: event.competitionLabel,
    homeAway: event.homeAway,
    resultLabel: event.resultLabel,
    meetingTime: event.meetingTime,
    visibility: {
      website: event.websiteVisible,
      infoboard: event.infoboardVisible,
      homepage: event.homepageVisible,
      wochenplan: event.wochenplanVisible,
      trainingsplan: event.trainingsplanVisible,
      teamPage: event.teamPageVisible,
    },
    remarks: event.remarks,
    pitchCode: event.pitchCode,
    homeDressingRoomCode: event.homeDressingRoomCode,
    awayDressingRoomCode: event.awayDressingRoomCode,
    season: event.season,
    team: event.team,
  };
}

export async function getPublicEvents(input: GetPublicEventsInput): Promise<PublicEventItem[]> {
  const limit = normalizeLimit(input.limit, input.maxLimit ?? DEFAULT_MAX_LIMIT);

  const where: Record<string, unknown> = {
    ...buildSurfaceWhere(input.surface),
    status: {
      in: ["SCHEDULED", "LIVE", "COMPLETED", "POSTPONED"],
    },
  };

  if (input.tenantId) {
    where.tenantId = input.tenantId;
  }

  if (input.eventTypes && input.eventTypes.length > 0) {
    where.type = { in: input.eventTypes };
  }

  if (input.seasonKey) {
    where.season = {
      key: input.seasonKey,
    };
  }

  if (input.teamSlug) {
    where.team = {
      slug: input.teamSlug,
    };
  }

  if (input.dateFrom || input.dateTo) {
    const startAt: Record<string, string> = {};

    if (input.dateFrom) {
      startAt.gte = input.dateFrom;
    }

    if (input.dateTo) {
      startAt.lte = input.dateTo;
    }

    where.startAt = startAt;
  }

  const events = await prisma.event.findMany({
    where,
    orderBy: [
      { startAt: "asc" },
      { sortOrder: "asc" },
      { title: "asc" },
    ],
    take: limit,
    select: {
      id: true,
      title: true,
      description: true,
      location: true,
      type: true,
      source: true,
      status: true,
      startAt: true,
      endAt: true,
      opponentName: true,
      organizerName: true,
      competitionLabel: true,
      homeAway: true,
      resultLabel: true,
      meetingTime: true,
      websiteVisible: true,
      infoboardVisible: true,
      homepageVisible: true,
      wochenplanVisible: true,
      trainingsplanVisible: true,
      teamPageVisible: true,
      remarks: true,
      pitchCode: true,
      homeDressingRoomCode: true,
      awayDressingRoomCode: true,
      season: {
        select: {
          id: true,
          key: true,
          name: true,
          startDate: true,
          endDate: true,
          isActive: true,
        },
      },
      team: {
        select: {
          id: true,
          name: true,
          slug: true,
          category: true,
          genderGroup: true,
          ageGroup: true,
        },
      },
    },
  });

  return events.map((event) => toPublicEventItem(event));
}

/**
 * Returns the calendar date of `value` in Europe/Zurich as a `YYYY-MM-DD` string.
 * Uses `toLocalDateKey` from the temporal-grouping utility so the result is
 * independent of the server's local timezone.
 */
function toSwissDateKey(value: Date): string {
  return toLocalDateKey(value, WEBSITE_TIMEZONE);
}

/**
 * Returns the ISO calendar week number for `value`, computed from its
 * Europe/Zurich local date rather than the server's local timezone.
 */
function getCalendarWeek(value: Date): number {
  const dateKey = toLocalDateKey(value, WEBSITE_TIMEZONE);
  const [yearStr, monthStr, dayStr] = dateKey.split("-");
  const d = new Date(Date.UTC(Number(yearStr), Number(monthStr) - 1, Number(dayStr)));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d.getTime() - yearStart.getTime()) / 86_400_000 + 1) / 7);
}

/** Weekday label formatter — always uses Europe/Zurich, never server-local timezone. */
const SWISS_WEEKDAY_FORMATTER = new Intl.DateTimeFormat("de-CH", {
  weekday: "long",
  timeZone: WEBSITE_TIMEZONE,
});

function toSwissWeekdayLabel(value: Date): string {
  return SWISS_WEEKDAY_FORMATTER.format(value);
}

export async function getGroupedWochenplan(input: Omit<GetPublicEventsInput, "surface">) {
  const events = await getPublicEvents({
    ...input,
    surface: "wochenplan",
  });

  const grouped = new Map<string, {
    date: string;
    calendarWeek: number;
    weekdayLabel: string;
    events: PublicEventItem[];
  }>();

  for (const event of events) {
    const key = toSwissDateKey(event.startAt);

    if (!grouped.has(key)) {
      grouped.set(key, {
        date: key,
        calendarWeek: getCalendarWeek(event.startAt),
        weekdayLabel: toSwissWeekdayLabel(event.startAt),
        events: [],
      });
    }

    grouped.get(key)!.events.push(event);
  }

  return Array.from(grouped.values()).sort((a, b) => a.date.localeCompare(b.date));
}

// tenantId is inherited from GetPublicEventsInput and is used both for event
// scoping and for facility/resource label resolution via batchGetEventAllocationDisplayForTenant.
export type GetInfoboardFeedInput = Omit<GetPublicEventsInput, "surface">;

export async function getInfoboardFeed(input: GetInfoboardFeedInput) {
  const events = await getPublicEvents({
    ...input,
    surface: "infoboard",
  });

  // Batch-resolve all allocation labels in a single DB round-trip.
  const allocations = await batchGetEventAllocationDisplayForTenant(
    events.map((e) => ({
      type: e.type,
      pitchCode: e.pitchCode,
      homeDressingRoomCode: e.homeDressingRoomCode,
      awayDressingRoomCode: e.awayDressingRoomCode,
    })),
    input.tenantId,
  );

  return events.map((event, index) => {
    const allocation = allocations[index]!;
    return {
      id: event.id,
      type: event.type,
      title: event.title,
      teamName: event.team?.name ?? null,
      teamSlug: event.team?.slug ?? null,
      opponentName: event.opponentName,
      organizerName: event.organizerName,
      competitionLabel: event.competitionLabel,
      homeAway: event.homeAway,
      location: event.location,
      startAt: event.startAt,
      endAt: event.endAt,
      meetingTime: event.meetingTime,
      resultLabel: event.resultLabel,
      status: event.status,
      seasonKey: event.season?.key ?? null,
      seasonName: event.season?.name ?? null,
      pitchLabel: allocation.pitchLabel,
      homeDressingRoomLabel: allocation.homeDressingRoomLabel,
      awayDressingRoomLabel: allocation.awayDressingRoomLabel,
    };
  });
}
