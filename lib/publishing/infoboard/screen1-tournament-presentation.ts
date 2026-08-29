/**
 * lib/publishing/infoboard/screen1-tournament-presentation.ts
 *
 * INFOBOARD-LOGO-02 — tournament participant presentation for Screen 1.
 *
 * Maps canonical TournamentParticipant rows to InfoboardEventPresentationExtension
 * entries (logo row + Kabinen allocation block). Tenant-scoped; never crosses
 * tenant boundaries.
 */

import type {
  InfoboardEventPresentationExtension,
  InfoboardTeamAllocationPresentation,
} from "@/components/infoboard/screen1/screen1-presentation-types";
import {
  normalizeClubNameForLookup,
  resolveTournamentOrganizerIdentity,
  resolveTournamentParticipantLogoUrl,
  type ResolvedOrganizerClub,
} from "@/lib/tournaments/club-identity";
import { resolveInfoboardTeamDisplayName } from "@/lib/publishing/presentation/infoboard-team-display-name";
import type { TournamentHomeAway } from "@/lib/tournaments/types";

export const TOURNAMENT_FEED_EVENT_ID_PREFIX = "tournament:" as const;

/**
 * Canonical Weekplanner feed events use prefixed ids (tournament:{eventId}) while
 * TournamentParticipant.eventId stores the raw Event.id. Screen 1 extensions must
 * be keyed by the feed id so InfoboardScreen1 can match them at render time.
 */
export function resolveCanonicalTournamentEventId(feedEventId: string): string {
  return feedEventId.startsWith(TOURNAMENT_FEED_EVENT_ID_PREFIX)
    ? feedEventId.slice(TOURNAMENT_FEED_EVENT_ID_PREFIX.length)
    : feedEventId;
}

export type Screen1TournamentFeedContext = {
  /** InfoboardScreen1Event.id as rendered in the feed (may include tournament: prefix). */
  readonly feedEventId: string;
  /** Raw Event.id used by TournamentParticipant.eventId. */
  readonly canonicalEventId: string;
  readonly organizerName: string | null;
  readonly teamDisplayName: string | null;
  readonly homeAway: string | null;
};

type DressingRoomAllocationRow = {
  readonly facilityResource: {
    readonly code: string;
    readonly name: string;
  };
  readonly displayOrder: number;
};

type TournamentParticipantRow = {
  readonly id: string;
  readonly eventId: string;
  readonly displayName: string | null;
  readonly manualLabel: string | null;
  readonly displayOrder: number;
  readonly team: {
    readonly name: string;
    readonly shortName: string | null;
    readonly alternativeName: string | null;
    readonly infoboardDisplayName: string | null;
    readonly infoboardTrainingDisplayName: string | null;
    readonly infoboardMatchDisplayName: string | null;
    readonly infoboardTournamentDisplayName: string | null;
  } | null;
  readonly externalClub: {
    readonly name: string;
    readonly shortName: string | null;
    readonly logoUrl: string | null;
    readonly logoContrastMode: string;
  } | null;
  readonly externalTeam: {
    readonly name: string;
    readonly shortName: string | null;
    readonly alternativeName: string | null;
    readonly logoUrl: string | null;
    readonly externalClub: {
      readonly name: string;
      readonly logoUrl: string | null;
      readonly logoContrastMode: string;
    };
  } | null;
  readonly dressingRoomAllocations: readonly DressingRoomAllocationRow[];
};

export type Screen1TournamentPresentationDatabase = {
  readonly tournamentParticipant: {
    readonly findMany: (args: {
      readonly where: Record<string, unknown>;
      readonly select: Record<string, unknown>;
      readonly orderBy: ReadonlyArray<Record<string, unknown>>;
    }) => Promise<readonly TournamentParticipantRow[]>;
  };
};

export const SCREEN1_TOURNAMENT_PARTICIPANT_SELECT = {
  id: true,
  eventId: true,
  displayName: true,
  manualLabel: true,
  displayOrder: true,
  team: {
    select: {
      name: true,
      shortName: true,
      alternativeName: true,
      infoboardDisplayName: true,
      infoboardTrainingDisplayName: true,
      infoboardMatchDisplayName: true,
      infoboardTournamentDisplayName: true,
    },
  },
  externalClub: {
    select: {
      name: true,
      shortName: true,
      logoUrl: true,
      logoContrastMode: true,
    },
  },
  externalTeam: {
    select: {
      name: true,
      shortName: true,
      alternativeName: true,
      logoUrl: true,
      externalClub: {
        select: {
          name: true,
          logoUrl: true,
          logoContrastMode: true,
        },
      },
    },
  },
  dressingRoomAllocations: {
    orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
    select: {
      displayOrder: true,
      facilityResource: {
        select: {
          code: true,
          name: true,
        },
      },
    },
  },
} as const;

function normalizeHomeAway(value: string | null | undefined): TournamentHomeAway {
  return value?.trim().toUpperCase() === "AWAY" ? "AWAY" : "HOME";
}

function resolveParticipantDisplayName(row: TournamentParticipantRow): string {
  const configured = row.displayName?.trim();
  if (configured) return configured;
  if (row.team) {
    return (
      resolveInfoboardTeamDisplayName(
        {
          infoboardTournamentDisplayName: row.team.infoboardTournamentDisplayName,
          infoboardDisplayName: row.team.infoboardDisplayName,
          alternativeName: row.team.alternativeName,
          shortName: row.team.shortName,
          name: row.team.name,
        },
        "TOURNAMENT",
      ) ?? row.team.name
    );
  }
  if (row.externalClub) return row.externalClub.name;
  if (row.externalTeam) return row.externalTeam.name;
  return row.manualLabel?.trim() ?? "";
}

function resolveParticipantLogoUrl(
  row: TournamentParticipantRow,
  tenantLogoUrl: string | null,
): string | null {
  return resolveTournamentParticipantLogoUrl(row, tenantLogoUrl);
}

function resolveDressingRoomLabel(
  allocations: readonly DressingRoomAllocationRow[],
): string | null {
  const first = allocations[0];
  if (!first) return null;
  const code = first.facilityResource.code?.trim();
  if (code) return code;
  return first.facilityResource.name?.trim() || null;
}

function mapParticipantRows(
  participants: readonly TournamentParticipantRow[],
  tenantLogoUrl: string | null,
): readonly InfoboardTeamAllocationPresentation[] {
  const sortedParticipants = [...participants].sort(
    (a, b) => a.displayOrder - b.displayOrder,
  );
  return sortedParticipants.map((row) => ({
    id: row.id,
    teamDisplayName: resolveParticipantDisplayName(row),
    dressingRoomLabel: resolveDressingRoomLabel(row.dressingRoomAllocations),
    clubLogoUrl: resolveParticipantLogoUrl(row, tenantLogoUrl),
    ...(row.team ? { isHomeTeam: true } : {}),
  }));
}

function registerAllocationName(
  seenNames: Set<string>,
  displayName: string,
): boolean {
  const key = normalizeClubNameForLookup(displayName);
  if (seenNames.has(key)) return false;
  seenNames.add(key);
  return true;
}

/**
 * Builds minimal logo-row identities when a tournament has no explicit
 * TournamentParticipant rows. Uses canonical organizer + tenant-team semantics.
 */
function buildFallbackParticipantAllocations(
  context: Screen1TournamentFeedContext,
  tenantName: string,
  tenantLogoUrl: string | null,
  organizerClubsByName: ReadonlyMap<string, ResolvedOrganizerClub>,
): readonly InfoboardTeamAllocationPresentation[] {
  const allocations: InfoboardTeamAllocationPresentation[] = [];
  const seenNames = new Set<string>();

  const organizerName = context.organizerName?.trim();
  if (organizerName && registerAllocationName(seenNames, organizerName)) {
    const organizerClub = organizerClubsByName.get(organizerName) ?? null;
    const organizerIdentity = resolveTournamentOrganizerIdentity({
      organizerName,
      homeAway: normalizeHomeAway(context.homeAway),
      tenantName,
      tenantLogoUrl,
      resolvedOrganizerClub: organizerClub,
    });
    allocations.push({
      id: `fallback-organizer:${context.canonicalEventId}`,
      teamDisplayName: organizerName,
      dressingRoomLabel: null,
      clubLogoUrl: organizerIdentity.logoUrl,
    });
  }

  const teamName = context.teamDisplayName?.trim();
  if (teamName && registerAllocationName(seenNames, teamName)) {
    allocations.push({
      id: `fallback-team:${context.canonicalEventId}`,
      teamDisplayName: teamName,
      dressingRoomLabel: null,
      isHomeTeam: true,
      clubLogoUrl: tenantLogoUrl?.trim() || null,
    });
  }

  return allocations;
}

/**
 * Loads tournament participant presentation extensions for the given canonical
 * Event ids. Returns one extension per event that has at least one participant.
 */
export async function loadScreen1TournamentPresentationExtensions(
  database: Screen1TournamentPresentationDatabase,
  tenantId: string,
  canonicalTournamentEventIds: readonly string[],
  tenantLogoUrl: string | null,
): Promise<readonly InfoboardEventPresentationExtension[]> {
  if (canonicalTournamentEventIds.length === 0) return [];

  const rows = await database.tournamentParticipant.findMany({
    where: {
      tenantId,
      eventId: { in: [...canonicalTournamentEventIds] },
    },
    select: SCREEN1_TOURNAMENT_PARTICIPANT_SELECT,
    orderBy: [{ displayOrder: "asc" }, { createdAt: "asc" }],
  });

  const byEventId = new Map<string, TournamentParticipantRow[]>();
  for (const row of rows) {
    const bucket = byEventId.get(row.eventId);
    if (bucket) {
      bucket.push(row);
    } else {
      byEventId.set(row.eventId, [row]);
    }
  }

  const extensions: InfoboardEventPresentationExtension[] = [];
  for (const [eventId, participants] of byEventId) {
    const participantAllocations = mapParticipantRows(participants, tenantLogoUrl);
    if (participantAllocations.length > 0) {
      extensions.push({ eventId, participantAllocations });
    }
  }

  return extensions;
}

/**
 * Builds Screen 1 tournament presentation extensions keyed by feed event ids.
 * Explicit TournamentParticipant rows take priority; organizer/tenant-team
 * fallbacks apply only when no explicit participants exist.
 */
export async function buildScreen1TournamentPresentationExtensions(
  database: Screen1TournamentPresentationDatabase,
  params: {
    readonly tenantId: string;
    readonly tenantName: string;
    readonly tenantLogoUrl: string | null;
    readonly tournaments: readonly Screen1TournamentFeedContext[];
    readonly organizerClubsByName?: ReadonlyMap<string, ResolvedOrganizerClub>;
  },
): Promise<readonly InfoboardEventPresentationExtension[]> {
  const {
    tenantId,
    tenantName,
    tenantLogoUrl,
    tournaments,
    organizerClubsByName = new Map(),
  } = params;

  if (tournaments.length === 0) return [];

  const canonicalIds = tournaments.map((tournament) => tournament.canonicalEventId);
  const explicitExtensions = await loadScreen1TournamentPresentationExtensions(
    database,
    tenantId,
    canonicalIds,
    tenantLogoUrl,
  );

  const explicitByCanonicalId = new Map(
    explicitExtensions.map((extension) => [extension.eventId, extension]),
  );

  const extensions: InfoboardEventPresentationExtension[] = [];
  for (const tournament of tournaments) {
    const explicit = explicitByCanonicalId.get(tournament.canonicalEventId);
    const participantAllocations =
      explicit?.participantAllocations ??
      buildFallbackParticipantAllocations(
        tournament,
        tenantName,
        tenantLogoUrl,
        organizerClubsByName,
      );

    if (participantAllocations.length > 0) {
      extensions.push({
        eventId: tournament.feedEventId,
        participantAllocations,
      });
    }
  }

  return extensions;
}
