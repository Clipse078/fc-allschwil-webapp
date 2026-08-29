/**
 * lib/club-directory/prisma-adapter.ts
 *
 * Wraps the real Prisma `externalClub` / `externalTeam` delegates in the
 * narrow, structural `ClubDirectoryQueryDatabase` interface expected by
 * lib/club-directory/query-service.ts. Forces the include/select shape on
 * every call so callers cannot accidentally under-fetch relations the
 * service depends on.
 */

import { Prisma } from "@prisma/client";

import type { ClubDirectoryQueryDatabase } from "./query-service";

const clubListSelect = {
  id: true,
  tenantId: true,
  name: true,
  shortName: true,
  alternativeName: true,
  logoUrl: true,
  logoContrastMode: true,
  source: true,
  archivedAt: true,
  createdAt: true,
  updatedAt: true,
  _count: { select: { externalTeams: true, providerMappings: true } },
} as const;

const clubDetailInclude = {
  providerMappings: true,
  externalTeams: { include: { providerMappings: true } },
  _count: { select: { externalTeams: true, providerMappings: true } },
} as const;

const teamListInclude = { providerMappings: true } as const;

const teamDetailInclude = {
  providerMappings: true,
  externalClub: {
    select: { id: true, name: true, shortName: true, logoUrl: true, archivedAt: true },
  },
} as const;

export interface ClubDirectoryPrismaClient {
  externalClub: Pick<Prisma.ExternalClubDelegate, "findMany" | "findFirst">;
  externalTeam: Pick<Prisma.ExternalTeamDelegate, "findMany" | "findFirst">;
}

export function createClubDirectoryQueryDatabase(
  client: ClubDirectoryPrismaClient,
): ClubDirectoryQueryDatabase {
  return {
    externalClub: {
      findMany: (args: object) =>
        client.externalClub.findMany({
          ...(args as Prisma.ExternalClubFindManyArgs),
          select: clubListSelect,
        }) as unknown as ReturnType<ClubDirectoryQueryDatabase["externalClub"]["findMany"]>,
      findFirst: (args: object) =>
        client.externalClub.findFirst({
          ...(args as Prisma.ExternalClubFindFirstArgs),
          include: clubDetailInclude,
        }) as unknown as ReturnType<ClubDirectoryQueryDatabase["externalClub"]["findFirst"]>,
    },
    externalTeam: {
      findMany: (args: object) =>
        client.externalTeam.findMany({
          ...(args as Prisma.ExternalTeamFindManyArgs),
          include: teamListInclude,
        }) as unknown as ReturnType<ClubDirectoryQueryDatabase["externalTeam"]["findMany"]>,
      findFirst: (args: object) =>
        client.externalTeam.findFirst({
          ...(args as Prisma.ExternalTeamFindFirstArgs),
          include: teamDetailInclude,
        }) as unknown as ReturnType<ClubDirectoryQueryDatabase["externalTeam"]["findFirst"]>,
    },
  };
}
