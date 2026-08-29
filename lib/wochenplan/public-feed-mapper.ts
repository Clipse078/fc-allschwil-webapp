/**
 * lib/wochenplan/public-feed-mapper.ts
 *
 * WOCHENPLAN-2.0-01C — maps canonical WeekplannerItems + policy metadata to
 * the public current-week Wochenplan DTO contract.
 *
 * Sporting identity reuses the same canonical club/Verein/ExternalClub logo
 * infrastructure as Infoboard and TournamentCenter — no Wochenplan-specific
 * logo tables or filename guessing.
 */

import { resolveExternalClubLogoUrl, resolveExternalTeamLogoUrl } from "@/lib/club-directory/logo";
import { resolveClubIdentityLogoUrl } from "@/lib/matchcenter/club-identity";
import { resolvePitchDisplay } from "@/lib/publishing/presentation/allocation-display-resolver";
import type { TournamentDto } from "@/lib/tournaments/types";
import type {
  PublicWochenplanClubIdentity,
  PublicWochenplanEventItem,
  PublicWochenplanMatchIdentity,
  PublicWochenplanPitch,
  PublicWebsiteEventItem,
  PublicWebsiteTournamentOrganizer,
  PublicWebsiteTournamentParticipant,
} from "@/lib/website/types";
import type {
  WeekplannerItem,
  WeekplannerMatchItem,
  WeekplannerResourceRef,
  WeekplannerTournamentItem,
  WeekplannerTrainingItem,
} from "@/lib/weekplanner/types";
import type {
  CanonicalEventPolicyRow,
  CanonicalInfoboardTeamDisplayNameRow,
  CanonicalTrainingSessionPolicyRow,
} from "@/lib/publishing/infoboard/canonical-source-loader";
import { getIsoWeekNumber } from "@/lib/weekplanner/date";

export type WochenplanTeamAssociation = {
  teamId: string;
  teamSlug: string;
  teamName: string;
};

export type WochenplanItemTeamContext = {
  primaryTeam: WochenplanTeamAssociation | null;
  allTeams: readonly WochenplanTeamAssociation[];
};

function meaningful(value: string | null | undefined): string | null {
  if (value == null) return null;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

function toTeamAssociation(
  team: CanonicalInfoboardTeamDisplayNameRow & { id: string; slug: string },
): WochenplanTeamAssociation {
  return {
    teamId: team.id,
    teamSlug: team.slug,
    teamName: team.name,
  };
}

export function resolveTrainingTeamContext(
  policy: CanonicalTrainingSessionPolicyRow | undefined,
): WochenplanItemTeamContext {
  const team = policy?.teamSeason.team;
  if (!team || !("id" in team) || !("slug" in team)) {
    return { primaryTeam: null, allTeams: [] };
  }
  const association = toTeamAssociation(
    team as CanonicalInfoboardTeamDisplayNameRow & { id: string; slug: string },
  );
  return { primaryTeam: association, allTeams: [association] };
}

export function resolveMatchTeamContext(
  policy: CanonicalEventPolicyRow | undefined,
): WochenplanItemTeamContext {
  const team = policy?.team;
  if (!team || !("id" in team) || !("slug" in team)) {
    return { primaryTeam: null, allTeams: [] };
  }
  const association = toTeamAssociation(
    team as CanonicalInfoboardTeamDisplayNameRow & { id: string; slug: string },
  );
  return { primaryTeam: association, allTeams: [association] };
}

export function resolveTournamentTeamContext(
  tournament: TournamentDto | undefined,
): WochenplanItemTeamContext {
  if (!tournament) return { primaryTeam: null, allTeams: [] };

  const teams = tournament.participants
    .filter((participant) => participant.kind === "TEAM" && participant.team)
    .map((participant) => ({
      teamId: participant.team!.id,
      teamSlug: participant.team!.slug,
      teamName: participant.displayName,
    }));

  return {
    primaryTeam: teams[0] ?? null,
    allTeams: teams,
  };
}

export function matchesTeamSlug(
  context: WochenplanItemTeamContext,
  teamSlug: string | null | undefined,
): boolean {
  if (!teamSlug) return true;
  return context.allTeams.some((team) => team.teamSlug === teamSlug);
}

function resolvePitchLocation(ref: WeekplannerResourceRef | undefined): string | null {
  if (!ref) return null;
  return resolvePitchDisplay({
    code: ref.code,
    name: ref.name,
    facilityName: ref.facilityName,
  });
}

function toPublicPitch(ref: WeekplannerResourceRef | undefined): PublicWochenplanPitch | null {
  if (!ref) return null;
  return {
    name: ref.name,
    facilityName: ref.facilityName,
  };
}

function buildOwnClubIdentity(
  team: CanonicalInfoboardTeamDisplayNameRow | null | undefined,
  tenantClubName: string,
  tenantLogoUrl: string | null,
  fallbackDisplayName: string | null,
): PublicWochenplanClubIdentity {
  return {
    displayName:
      meaningful(team?.name) ??
      meaningful(fallbackDisplayName) ??
      tenantClubName,
    logoUrl: tenantLogoUrl,
    teamId: team && "id" in team ? (team as { id: string }).id : null,
    externalClubId: null,
  };
}

type ExternalTeamPolicyRow = NonNullable<
  NonNullable<CanonicalEventPolicyRow["matchExternalMapping"]>["awayExternalTeam"]
>;

type ExternalClubPolicyRow = NonNullable<CanonicalEventPolicyRow["opponentExternalClub"]>;

function buildExternalClubIdentity(
  externalClub: ExternalClubPolicyRow,
  fallbackDisplayName: string | null,
): PublicWochenplanClubIdentity {
  return {
    displayName: meaningful(externalClub.name) ?? meaningful(fallbackDisplayName) ?? "",
    logoUrl: resolveExternalClubLogoUrl(externalClub),
    teamId: null,
    externalClubId: null,
  };
}

function buildExternalTeamIdentity(
  externalTeam: ExternalTeamPolicyRow | null,
  fallbackDisplayName: string | null,
): PublicWochenplanClubIdentity {
  if (!externalTeam) {
    return {
      displayName: meaningful(fallbackDisplayName) ?? "",
      logoUrl: null,
      teamId: null,
      externalClubId: null,
    };
  }

  return {
    displayName:
      meaningful(externalTeam.name) ??
      meaningful(externalTeam.externalClub.name) ??
      meaningful(fallbackDisplayName) ??
      "",
    logoUrl: resolveExternalTeamLogoUrl(externalTeam, externalTeam.externalClub),
    teamId: null,
    externalClubId: null,
  };
}

export function buildPublicMatchIdentity(
  policy: CanonicalEventPolicyRow | undefined,
  item: WeekplannerMatchItem,
  tenantClubName: string,
  tenantLogoUrl: string | null,
): PublicWochenplanMatchIdentity {
  const mapping = policy?.matchExternalMapping ?? null;
  const eventTeam = policy?.team ?? null;
  const homeAway = (policy?.homeAway ?? "HOME").trim().toUpperCase();
  const ownTeamIsAway = homeAway === "AWAY";

  if (mapping) {
    return {
      home: mapping.homeTeam
        ? buildOwnClubIdentity(
            mapping.homeTeam,
            tenantClubName,
            tenantLogoUrl,
            ownTeamIsAway ? item.opponentName : item.teamNames[0] ?? null,
          )
        : buildExternalTeamIdentity(
            mapping.homeExternalTeam,
            ownTeamIsAway ? item.opponentName : item.teamNames[0] ?? null,
          ),
      away: mapping.awayTeam
        ? buildOwnClubIdentity(
            mapping.awayTeam,
            tenantClubName,
            tenantLogoUrl,
            ownTeamIsAway ? item.teamNames[0] ?? null : item.opponentName,
          )
        : buildExternalTeamIdentity(
            mapping.awayExternalTeam,
            ownTeamIsAway ? item.teamNames[0] ?? null : item.opponentName,
          ),
    };
  }

  const opponentClub = policy?.opponentExternalClub ?? null;

  if (ownTeamIsAway) {
    return {
      home: opponentClub
        ? buildExternalClubIdentity(opponentClub, item.opponentName)
        : buildExternalTeamIdentity(null, item.opponentName),
      away: buildOwnClubIdentity(eventTeam, tenantClubName, tenantLogoUrl, item.teamNames[0] ?? null),
    };
  }

  return {
    home: buildOwnClubIdentity(eventTeam, tenantClubName, tenantLogoUrl, item.teamNames[0] ?? null),
    away: opponentClub
      ? buildExternalClubIdentity(opponentClub, item.opponentName)
      : buildExternalTeamIdentity(null, item.opponentName),
  };
}

function mapTrainingStatus(status: string | undefined): string {
  switch (status?.trim().toUpperCase()) {
    case "CANCELLED":
    case "CANCELED":
      return "CANCELLED";
    case "POSTPONED":
      return "POSTPONED";
    case "MOVED":
    case "SCHEDULED":
    default:
      return "SCHEDULED";
  }
}

function toPublicWebsiteEventBase(input: {
  id: string;
  title: string;
  type: "TRAINING" | "MATCH" | "TOURNAMENT";
  status: string;
  startAt: Date;
  endAt: Date;
  location: string | null;
  teamContext: WochenplanItemTeamContext;
  seasonKey: string | null;
  seasonName: string | null;
  opponentName?: string | null;
  organizerName?: string | null;
  competitionLabel?: string | null;
  homeAway?: string | null;
  resultLabel?: string | null;
  meetingTime?: Date | null;
}): PublicWebsiteEventItem {
  const team = input.teamContext.primaryTeam;
  return {
    id: input.id,
    title: input.title,
    type: input.type,
    status: input.status,
    startAt: input.startAt,
    endAt: input.endAt,
    location: input.location,
    description: null,
    opponentName: input.opponentName ?? null,
    organizerName: input.organizerName ?? null,
    competitionLabel: input.competitionLabel ?? null,
    homeAway: input.homeAway ?? null,
    resultLabel: input.resultLabel ?? null,
    meetingTime: input.meetingTime ?? null,
    team: team
      ? {
          id: team.teamId,
          name: team.teamName,
          slug: team.teamSlug,
          category: "",
          genderGroup: null,
          ageGroup: null,
        }
      : null,
    season: input.seasonKey
      ? { key: input.seasonKey, name: input.seasonName ?? input.seasonKey }
      : null,
  };
}

export function mapTrainingToPublicEvent(
  item: WeekplannerTrainingItem,
  policy: CanonicalTrainingSessionPolicyRow | undefined,
  teamContext: WochenplanItemTeamContext,
): PublicWochenplanEventItem {
  const location = resolvePitchLocation(item.pitchAllocations[0]);
  const base = toPublicWebsiteEventBase({
    id: item.trainingSessionId,
    title: item.title,
    type: "TRAINING",
    status: mapTrainingStatus(policy?.status),
    startAt: item.startAt,
    endAt: item.endAt,
    location,
    teamContext,
    seasonKey: policy?.teamSeason.season.key ?? null,
    seasonName: policy?.teamSeason.season.key ?? null,
  });

  return {
    ...base,
    kind: "TRAINING",
    pitch: toPublicPitch(item.pitchAllocations[0]),
  };
}

export function mapMatchToPublicEvent(
  item: WeekplannerMatchItem,
  policy: CanonicalEventPolicyRow | undefined,
  teamContext: WochenplanItemTeamContext,
  tenantClubName: string,
  tenantLogoUrl: string | null,
): PublicWochenplanEventItem {
  const location = resolvePitchLocation(item.pitchAllocations[0]);
  const base = toPublicWebsiteEventBase({
    id: item.eventId,
    title: item.title,
    type: "MATCH",
    status: policy?.status ?? "SCHEDULED",
    startAt: item.startAt,
    endAt: item.endAt,
    location,
    teamContext,
    seasonKey: policy?.season?.key ?? null,
    seasonName: policy?.season?.key ?? null,
    opponentName: item.opponentName,
    competitionLabel: policy?.competitionLabel ?? null,
    homeAway: policy?.homeAway ?? "HOME",
    resultLabel: policy?.resultLabel ?? null,
    meetingTime: policy?.meetingTime ?? null,
  });

  return {
    ...base,
    kind: "MATCH",
    matchIdentity: buildPublicMatchIdentity(policy, item, tenantClubName, tenantLogoUrl),
    pitch: toPublicPitch(item.pitchAllocations[0]),
  };
}

function toPublicOrganizer(tournament: TournamentDto): PublicWebsiteTournamentOrganizer | null {
  const displayName = tournament.organizerName?.trim();
  if (!displayName) return null;
  return {
    displayName,
    logoUrl: tournament.organizerLogoUrl,
    externalClubId: tournament.organizerExternalClubId,
  };
}

function toPublicParticipant(
  participant: TournamentDto["participants"][number],
): PublicWebsiteTournamentParticipant {
  return {
    id: participant.id,
    displayName: participant.displayName,
    logoUrl: participant.logoUrl,
    kind: participant.kind,
    teamId: participant.team?.id ?? null,
    externalClubId: participant.externalClub?.club.id ?? null,
  };
}

export function mapTournamentToPublicEvent(
  item: WeekplannerTournamentItem,
  policy: CanonicalEventPolicyRow | undefined,
  tournament: TournamentDto | undefined,
  teamContext: WochenplanItemTeamContext,
): PublicWochenplanEventItem {
  const location = resolvePitchLocation(item.pitchAllocations[0]);
  const baseEvent = toPublicWebsiteEventBase({
    id: item.eventId,
    title: item.title,
    type: "TOURNAMENT",
    status: policy?.status ?? "SCHEDULED",
    startAt: item.startAt,
    endAt: item.endAt,
    location,
    teamContext,
    seasonKey: policy?.season?.key ?? null,
    seasonName: policy?.season?.key ?? null,
    organizerName: policy?.organizerName ?? tournament?.organizerName ?? null,
    competitionLabel: policy?.competitionLabel ?? null,
    homeAway: policy?.homeAway ?? "HOME",
    resultLabel: policy?.resultLabel ?? null,
    meetingTime: policy?.meetingTime ?? null,
  });

  if (tournament) {
    return {
      ...baseEvent,
      kind: "TOURNAMENT",
      organizer: toPublicOrganizer(tournament),
      participants: tournament.participants.map(toPublicParticipant),
      pitch: toPublicPitch(item.pitchAllocations[0]),
    };
  }

  return {
    ...baseEvent,
    kind: "TOURNAMENT",
    organizer: policy?.organizerName
      ? { displayName: policy.organizerName, logoUrl: null, externalClubId: null }
      : null,
    participants: [],
    pitch: toPublicPitch(item.pitchAllocations[0]),
  };
}

const WEEKDAY_FORMATTER_CACHE = new Map<string, Intl.DateTimeFormat>();

function getWeekdayFormatter(timeZone: string): Intl.DateTimeFormat {
  const cached = WEEKDAY_FORMATTER_CACHE.get(timeZone);
  if (cached) return cached;
  const formatter = new Intl.DateTimeFormat("de-CH", {
    weekday: "long",
    timeZone,
  });
  WEEKDAY_FORMATTER_CACHE.set(timeZone, formatter);
  return formatter;
}

export function toWeekdayLabel(dayKey: string, timeZone: string): string {
  const [year, month, day] = dayKey.split("-").map(Number);
  const noonUtc = new Date(Date.UTC(year, month - 1, day, 12, 0, 0));
  return getWeekdayFormatter(timeZone).format(noonUtc);
}

export function toCalendarWeek(dayKey: string): number {
  return getIsoWeekNumber(dayKey);
}

export function mapWeekplannerItemToPublic(
  item: WeekplannerItem,
  context: {
    eventPolicyByEventId: ReadonlyMap<string, CanonicalEventPolicyRow>;
    trainingPolicyBySessionId: ReadonlyMap<string, CanonicalTrainingSessionPolicyRow>;
    tournamentByEventId: ReadonlyMap<string, TournamentDto>;
    tenantClubName: string;
    tenantLogoUrl: string | null;
  },
): PublicWochenplanEventItem {
  switch (item.type) {
    case "TRAINING": {
      const policy = context.trainingPolicyBySessionId.get(item.trainingSessionId);
      const teamContext = resolveTrainingTeamContext(policy);
      return mapTrainingToPublicEvent(item, policy, teamContext);
    }
    case "MATCH": {
      const policy = context.eventPolicyByEventId.get(item.eventId);
      const teamContext = resolveMatchTeamContext(policy);
      return mapMatchToPublicEvent(
        item,
        policy,
        teamContext,
        context.tenantClubName,
        context.tenantLogoUrl,
      );
    }
    case "TOURNAMENT": {
      const policy = context.eventPolicyByEventId.get(item.eventId);
      const tournament = context.tournamentByEventId.get(item.eventId);
      const teamContext = resolveTournamentTeamContext(tournament);
      return mapTournamentToPublicEvent(item, policy, tournament, teamContext);
    }
  }
}

export function resolveItemTeamContext(
  item: WeekplannerItem,
  context: {
    eventPolicyByEventId: ReadonlyMap<string, CanonicalEventPolicyRow>;
    trainingPolicyBySessionId: ReadonlyMap<string, CanonicalTrainingSessionPolicyRow>;
    tournamentByEventId: ReadonlyMap<string, TournamentDto>;
  },
): WochenplanItemTeamContext {
  switch (item.type) {
    case "TRAINING":
      return resolveTrainingTeamContext(
        context.trainingPolicyBySessionId.get(item.trainingSessionId),
      );
    case "MATCH":
      return resolveMatchTeamContext(context.eventPolicyByEventId.get(item.eventId));
    case "TOURNAMENT":
      return resolveTournamentTeamContext(context.tournamentByEventId.get(item.eventId));
  }
}
