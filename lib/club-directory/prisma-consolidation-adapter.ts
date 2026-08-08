/**
 * lib/club-directory/prisma-consolidation-adapter.ts
 *
 * CLUB-DIRECTORY-02C — wraps the real Prisma delegates in the narrow,
 * structural `ClubConsolidationDatabase` interface expected by
 * lib/club-directory/consolidation-service.ts. Forces the include/select
 * shape on every call so callers cannot accidentally under-fetch relations
 * the service depends on, and provides genuine transactional atomicity via
 * Prisma's interactive `$transaction`.
 */

import { Prisma, type PrismaClient } from "@prisma/client";

import type { ClubConsolidationDatabase } from "./consolidation-service";

type ClubConsolidationPrismaDelegates = Pick<
  PrismaClient,
  "externalTeamProviderMapping" | "externalTeam" | "externalClub" | "externalClubProviderMapping"
>;

export type ClubConsolidationPrismaClient = ClubConsolidationPrismaDelegates & {
  $transaction: PrismaClient["$transaction"];
};

const teamMappingSelect = {
  externalTeamId: true,
  providerTeamId: true,
  externalTeam: { select: { id: true, externalClubId: true, archivedAt: true } },
} as const;

function buildDelegates(
  client: ClubConsolidationPrismaDelegates,
): Omit<ClubConsolidationDatabase, "transaction"> {
  return {
    externalTeamProviderMapping: {
      findMany: (args: object) =>
        client.externalTeamProviderMapping.findMany({
          ...(args as Prisma.ExternalTeamProviderMappingFindManyArgs),
          select: teamMappingSelect,
        }) as unknown as ReturnType<ClubConsolidationDatabase["externalTeamProviderMapping"]["findMany"]>,
    },
    externalTeam: {
      update: (args: object) =>
        client.externalTeam.update({
          ...(args as Prisma.ExternalTeamUpdateArgs),
          select: { id: true, externalClubId: true },
        }) as unknown as ReturnType<ClubConsolidationDatabase["externalTeam"]["update"]>,
    },
    externalClub: {
      findMany: (args: object) =>
        client.externalClub.findMany({
          ...(args as Prisma.ExternalClubFindManyArgs),
          select: { id: true, logoUrl: true, createdAt: true, archivedAt: true },
        }) as unknown as ReturnType<ClubConsolidationDatabase["externalClub"]["findMany"]>,
      update: (args: object) =>
        client.externalClub.update({
          ...(args as Prisma.ExternalClubUpdateArgs),
          select: { id: true, logoUrl: true, createdAt: true, archivedAt: true },
        }) as unknown as ReturnType<ClubConsolidationDatabase["externalClub"]["update"]>,
    },
    externalClubProviderMapping: {
      findFirst: (args: object) =>
        client.externalClubProviderMapping.findFirst({
          ...(args as Prisma.ExternalClubProviderMappingFindFirstArgs),
          select: { id: true, externalClubId: true },
        }) as unknown as ReturnType<ClubConsolidationDatabase["externalClubProviderMapping"]["findFirst"]>,
      upsert: (args: object) =>
        client.externalClubProviderMapping.upsert({
          ...(args as Prisma.ExternalClubProviderMappingUpsertArgs),
          select: { id: true, externalClubId: true },
        }) as unknown as ReturnType<ClubConsolidationDatabase["externalClubProviderMapping"]["upsert"]>,
    },
  };
}

function buildScopedDatabase(
  client: ClubConsolidationPrismaDelegates,
): ClubConsolidationDatabase {
  const delegates = buildDelegates(client);
  const database: ClubConsolidationDatabase = {
    ...delegates,
    transaction: (fn) => fn(database),
  };
  return database;
}

export function createClubConsolidationDatabase(
  client: ClubConsolidationPrismaClient,
): ClubConsolidationDatabase {
  const delegates = buildDelegates(client);

  const database: ClubConsolidationDatabase = {
    ...delegates,
    transaction: (fn) =>
      client.$transaction((tx: Prisma.TransactionClient) => fn(buildScopedDatabase(tx))),
  };

  return database;
}
