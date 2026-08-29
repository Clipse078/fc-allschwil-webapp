/**
 * lib/wochenplan/public-feed.ts
 *
 * WOCHENPLAN-2.0-01C — assembles the canonical public current-week Wochenplan
 * feed from Weekplanner effective state.
 *
 * Pipeline:
 *   ACTIVE WochenplanPlan (tenant public metadata)
 *     → linked WeekplannerPlan for current week (by wochenplanPlanId) or Standardplan
 *     → getWeekplannerWeek (canonical /dashboard/planner/week data)
 *     → publication policy (shared HOME-match semantics + websiteVisible)
 *     → optional team filter (never overrides HOME/facility rules)
 *     → public DTO grouped Mon–Sun
 */

import { prisma } from "@/lib/db/prisma";
import { listTournamentsByIds } from "@/lib/tournaments/tournament-service";
import { getWeekplannerWeek } from "@/lib/weekplanner/queries";
import type { WeekplannerItem } from "@/lib/weekplanner/types";
import {
  CANONICAL_EVENT_POLICY_SELECT,
  CANONICAL_INFOBOARD_TEAM_DISPLAY_NAME_SELECT,
  type CanonicalEventPolicyRow,
  type CanonicalTrainingSessionPolicyRow,
} from "@/lib/publishing/infoboard/canonical-source-loader";
import { getActiveWochenplanPlan } from "./plan-service";
import { resolvePublicCurrentWeekWindow } from "./public-current-week";
import { resolvePublicWeekplannerPlan } from "./public-plan-resolution";
import {
  evaluateWochenplanMatchPublication,
  evaluateWochenplanTournamentPublication,
  evaluateWochenplanTrainingPublication,
} from "./publication-policy";
import {
  mapWeekplannerItemToPublic,
  matchesTeamSlug,
  resolveItemTeamContext,
  toCalendarWeek,
  toWeekdayLabel,
} from "./public-feed-mapper";
import type {
  PublicWochenplanDay,
  PublicWochenplanSummary,
  WeekplanData,
} from "@/lib/website/types";
import {
  formatWochenplanVariantBadge,
  getWochenplanPublication,
} from "./publication-queries";
import { TRAINING_DEFAULT_TIMEZONE } from "@/lib/training/date-range";
import type { PublicationPolicyEvent } from "@/lib/publishing/policy/publication-policy";

const PUBLIC_TRAINING_POLICY_SELECT = {
  id: true,
  status: true,
  teamSeason: {
    select: {
      season: { select: { key: true } },
      team: {
        select: {
          ...CANONICAL_INFOBOARD_TEAM_DISPLAY_NAME_SELECT,
          id: true,
          slug: true,
        },
      },
    },
  },
} as const;

const PUBLIC_EVENT_POLICY_SELECT = {
  ...CANONICAL_EVENT_POLICY_SELECT,
  team: {
    select: {
      ...CANONICAL_INFOBOARD_TEAM_DISPLAY_NAME_SELECT,
      id: true,
      slug: true,
    },
  },
} as const;

export type BuildPublicCurrentWeekFeedInput = {
  tenantId: string;
  tenantName: string;
  timeZone?: string | null;
  teamSlug?: string | null;
  seasonKey?: string | null;
  now?: Date;
};

async function loadTenantBranding(tenantId: string): Promise<{
  logoUrl: string | null;
  timeZone: string;
}> {
  const tenant = await prisma.tenant.findFirst({
    where: { id: tenantId },
    select: { logoUrl: true, timezone: true },
  });
  return {
    logoUrl: tenant?.logoUrl ?? null,
    timeZone: tenant?.timezone?.trim() || TRAINING_DEFAULT_TIMEZONE,
  };
}

async function loadEventPolicyByEventId(
  tenantId: string,
  items: readonly WeekplannerItem[],
): Promise<Map<string, CanonicalEventPolicyRow>> {
  const eventIds = [
    ...new Set(
      items
        .filter((item) => item.type === "MATCH" || item.type === "TOURNAMENT")
        .map((item) => item.eventId),
    ),
  ];
  if (eventIds.length === 0) return new Map();

  const rows = await prisma.event.findMany({
    where: { tenantId, id: { in: eventIds } },
    select: PUBLIC_EVENT_POLICY_SELECT,
  });
  return new Map(rows.map((row) => [row.id, row as CanonicalEventPolicyRow]));
}

async function loadTrainingPolicyBySessionId(
  tenantId: string,
  items: readonly WeekplannerItem[],
): Promise<Map<string, CanonicalTrainingSessionPolicyRow>> {
  const sessionIds = [
    ...new Set(
      items
        .filter((item) => item.type === "TRAINING")
        .map((item) => item.trainingSessionId),
    ),
  ];
  if (sessionIds.length === 0) return new Map();

  const rows = await prisma.trainingSession.findMany({
    where: { tenantId, id: { in: sessionIds } },
    select: PUBLIC_TRAINING_POLICY_SELECT,
  });
  return new Map(rows.map((row) => [row.id, row as CanonicalTrainingSessionPolicyRow]));
}

function isEligibleForPublicFeed(
  item: WeekplannerItem,
  tenantId: string,
  context: {
    eventPolicyByEventId: ReadonlyMap<string, CanonicalEventPolicyRow>;
    trainingPolicyBySessionId: ReadonlyMap<string, CanonicalTrainingSessionPolicyRow>;
  },
): boolean {
  switch (item.type) {
    case "TRAINING": {
      const policy = context.trainingPolicyBySessionId.get(item.trainingSessionId);
      const decision = evaluateWochenplanTrainingPublication(
        tenantId,
        item.tenantId,
        policy?.status ?? "SCHEDULED",
      );
      return decision.eligible;
    }
    case "MATCH": {
      const policy = context.eventPolicyByEventId.get(item.eventId);
      if (!policy) return false;
      const event: PublicationPolicyEvent = {
        tenantId,
        type: "MATCH",
        status: policy.status,
        infoboardVisible: policy.infoboardVisible,
        websiteVisible: policy.websiteVisible,
        trainingsplanVisible: policy.trainingsplanVisible,
        homeAway: policy.homeAway,
      };
      return evaluateWochenplanMatchPublication(event, tenantId).eligible;
    }
    case "TOURNAMENT": {
      const policy = context.eventPolicyByEventId.get(item.eventId);
      if (!policy) return false;
      const event: PublicationPolicyEvent = {
        tenantId,
        type: "TOURNAMENT",
        status: policy.status,
        infoboardVisible: policy.infoboardVisible,
        websiteVisible: policy.websiteVisible,
        trainingsplanVisible: policy.trainingsplanVisible,
        homeAway: policy.homeAway,
      };
      return evaluateWochenplanTournamentPublication(event, tenantId).eligible;
    }
  }
}

function matchesSeasonKey(
  item: WeekplannerItem,
  seasonKey: string | null | undefined,
  context: {
    eventPolicyByEventId: ReadonlyMap<string, CanonicalEventPolicyRow>;
    trainingPolicyBySessionId: ReadonlyMap<string, CanonicalTrainingSessionPolicyRow>;
  },
): boolean {
  if (!seasonKey) return true;

  if (item.type === "TRAINING") {
    const policy = context.trainingPolicyBySessionId.get(item.trainingSessionId);
    return policy?.teamSeason.season.key === seasonKey;
  }

  const policy = context.eventPolicyByEventId.get(
    item.type === "MATCH" || item.type === "TOURNAMENT" ? item.eventId : "",
  );
  return policy?.season?.key === seasonKey;
}

function buildSummary(
  events: readonly PublicWochenplanDay["events"][number][],
  teamLabel: string | null,
): PublicWochenplanSummary {
  let trainingCount = 0;
  let matchCount = 0;
  let tournamentCount = 0;

  for (const event of events) {
    switch (event.kind) {
      case "TRAINING":
        trainingCount += 1;
        break;
      case "MATCH":
        matchCount += 1;
        break;
      case "TOURNAMENT":
        tournamentCount += 1;
        break;
    }
  }

  return {
    trainingCount,
    matchCount,
    tournamentCount,
    teamLabel,
  };
}

/**
 * Builds the canonical public current-week Wochenplan feed for one tenant.
 */
export async function buildPublicCurrentWeekFeed(
  input: BuildPublicCurrentWeekFeedInput,
): Promise<WeekplanData> {
  const branding = await loadTenantBranding(input.tenantId);
  const timeZone = input.timeZone?.trim() || branding.timeZone;
  const weekWindow = resolvePublicCurrentWeekWindow({ timeZone, now: input.now });

  const activePlan = await getActiveWochenplanPlan(input.tenantId);
  const planResolution = await resolvePublicWeekplannerPlan(
    input.tenantId,
    weekWindow.weekId,
    activePlan,
  );

  const week = await getWeekplannerWeek(
    input.tenantId,
    {
      from: weekWindow.from,
      to: weekWindow.to,
      days: weekWindow.days,
      param: weekWindow.weekId,
      previousParam: "",
      nextParam: "",
    },
    planResolution.weekplannerPlanId ?? undefined,
  );

  const allItems = week.days.flatMap((day) => day.items);

  const [eventPolicyByEventId, trainingPolicyBySessionId] = await Promise.all([
    loadEventPolicyByEventId(input.tenantId, allItems),
    loadTrainingPolicyBySessionId(input.tenantId, allItems),
  ]);

  const tournamentIds = allItems
    .filter((item) => item.type === "TOURNAMENT")
    .map((item) => item.eventId);
  const tournaments = await listTournamentsByIds(input.tenantId, tournamentIds);
  const tournamentByEventId = new Map(tournaments.map((t) => [t.id, t]));

  const policyContext = { eventPolicyByEventId, trainingPolicyBySessionId, tournamentByEventId };
  const mapperContext = {
    eventPolicyByEventId,
    trainingPolicyBySessionId,
    tournamentByEventId,
    tenantClubName: input.tenantName,
    tenantLogoUrl: branding.logoUrl,
  };

  let teamLabel: string | null = null;
  if (input.teamSlug) {
    for (const item of allItems) {
      const teamContext = resolveItemTeamContext(item, policyContext);
      const match = teamContext.allTeams.find((team) => team.teamSlug === input.teamSlug);
      if (match) {
        teamLabel = match.teamName;
        break;
      }
    }
  }

  const days: PublicWochenplanDay[] = weekWindow.days.map((dayKey) => {
    const dayItems = week.days.find((day) => day.dayKey === dayKey)?.items ?? [];

    const eligibleItems = dayItems.filter((item) => {
      if (!isEligibleForPublicFeed(item, input.tenantId, policyContext)) return false;
      if (!matchesSeasonKey(item, input.seasonKey, policyContext)) return false;
      const teamContext = resolveItemTeamContext(item, policyContext);
      return matchesTeamSlug(teamContext, input.teamSlug);
    });

    const events = eligibleItems
      .map((item) => mapWeekplannerItemToPublic(item, mapperContext))
      .sort((a, b) => a.startAt.getTime() - b.startAt.getTime());

    return {
      date: dayKey,
      calendarWeek: toCalendarWeek(dayKey),
      weekdayLabel: toWeekdayLabel(dayKey, timeZone),
      events,
    };
  });

  const flatEvents = days.flatMap((day) => day.events);
  const summary = buildSummary(flatEvents, teamLabel);

  const activePlanName = activePlan?.name ?? "Wochenplan";
  const pub = await getWochenplanPublication(input.tenantId, weekWindow.weekId);

  const publication = pub?.isPublished
    ? {
        weekId: pub.weekId,
        variantLabel: activePlanName,
        variantBadge: formatWochenplanVariantBadge(pub.weekId, activePlanName),
        isPublished: pub.isPublished,
        publishedAt: pub.publishedAt,
        activePlanId: activePlan?.id ?? null,
        activePlanName,
      }
    : null;

  return {
    publication,
    activePlan: {
      id: activePlan?.id ?? "",
      name: activePlanName,
    },
    currentWeek: {
      weekId: weekWindow.weekId,
      rangeLabel: weekWindow.rangeLabel,
      calendarWeekLabel: weekWindow.calendarWeekLabel,
      calendarWeek: weekWindow.calendarWeek,
      timeZone,
    },
    summary,
    days,
  };
}
