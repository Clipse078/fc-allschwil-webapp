/**
 * lib/publishing/infoboard/screen1-tournament-presentation.ts
 *
 * INFOBOARD-LOGO-02 — tournament participant presentation for Screen 1.
 *
 * Maps canonical TournamentParticipant rows to InfoboardEventPresentationExtension
 * entries (logo row + Kabinen allocation block). Tenant-scoped; never crosses
 * tenant boundaries.
 */

import { resolveExternalTeamLogoUrl } from "@/lib/club-directory/logo";
import { resolveInfoboardTeamDisplayName } from "@/lib/publishing/presentation/infoboard-team-display-name";
import type { InfoboardEventPresentationExtension } from "@/components/infoboard/screen1/screen1-presentation-types";

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
  } | null;
  readonly externalClub: {
    readonly name: string;
    readonly shortName: string | null;
    readonly logoUrl: string | null;
  } | null;
  readonly externalTeam: {
    readonly name: string;
    readonly shortName: string | null;
    readonly alternativeName: string | null;
    readonly logoUrl: string | null;
    readonly externalClub: {
      readonly name: string;
      readonly logoUrl: string | null;
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
    },
  },
  externalClub: {
    select: {
      name: true,
      shortName: true,
      logoUrl: true,
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

function resolveParticipantDisplayName(row: TournamentParticipantRow): string {
  const configured = row.displayName?.trim();
  if (configured) return configured;
  if (row.team) {
    return (
      resolveInfoboardTeamDisplayName({
        infoboardDisplayName: row.team.infoboardDisplayName,
        alternativeName: row.team.alternativeName,
        shortName: row.team.shortName,
        name: row.team.name,
      }) ?? row.team.name
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
  if (row.team) return tenantLogoUrl?.trim() || null;
  if (row.externalClub) return row.externalClub.logoUrl?.trim() || null;
  if (row.externalTeam) {
    return resolveExternalTeamLogoUrl(row.externalTeam, row.externalTeam.externalClub);
  }
  return null;
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

/**
 * Loads tournament participant presentation extensions for the given tournament
 * event ids. Returns one extension per event that has at least one participant.
 */
export async function loadScreen1TournamentPresentationExtensions(
  database: Screen1TournamentPresentationDatabase,
  tenantId: string,
  tournamentEventIds: readonly string[],
  tenantLogoUrl: string | null,
): Promise<readonly InfoboardEventPresentationExtension[]> {
  if (tournamentEventIds.length === 0) return [];

  const rows = await database.tournamentParticipant.findMany({
    where: {
      tenantId,
      eventId: { in: [...tournamentEventIds] },
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
    const sortedParticipants = [...participants].sort(
      (a, b) => a.displayOrder - b.displayOrder,
    );
    const participantAllocations = sortedParticipants.map((row) => ({
      id: row.id,
      teamDisplayName: resolveParticipantDisplayName(row),
      dressingRoomLabel: resolveDressingRoomLabel(row.dressingRoomAllocations),
      clubLogoUrl: resolveParticipantLogoUrl(row, tenantLogoUrl),
    }));

    if (participantAllocations.length > 0) {
      extensions.push({ eventId, participantAllocations });
    }
  }

  return extensions;
}
