/**
 * lib/club-directory/prisma-mutation-adapter.ts
 *
 * Wraps the real Prisma delegates in the narrow, structural
 * `ClubDirectoryMutationDatabase` interface expected by
 * lib/club-directory/mutation-service.ts.
 */

import { Prisma, type PrismaClient } from "@prisma/client";

import type { ClubDirectoryMutationDatabase } from "./mutation-service";

export type ClubDirectoryMutationPrismaClient = Pick<
  PrismaClient,
  "externalClub" | "externalTeam" | "externalClubProviderMapping" | "externalTeamProviderMapping"
>;

export function createClubDirectoryMutationDatabase(
  client: ClubDirectoryMutationPrismaClient,
): ClubDirectoryMutationDatabase {
  const database: ClubDirectoryMutationDatabase = {
    externalClub: {
      findFirst: (args: object) =>
        client.externalClub.findFirst(args as Prisma.ExternalClubFindFirstArgs),
      create: (args: object) => client.externalClub.create(args as Prisma.ExternalClubCreateArgs),
      update: (args: object) => client.externalClub.update(args as Prisma.ExternalClubUpdateArgs),
    },
    externalTeam: {
      findFirst: (args: object) =>
        client.externalTeam.findFirst(args as Prisma.ExternalTeamFindFirstArgs),
      create: (args: object) => client.externalTeam.create(args as Prisma.ExternalTeamCreateArgs),
      update: (args: object) => client.externalTeam.update(args as Prisma.ExternalTeamUpdateArgs),
    },
    externalClubProviderMapping: {
      findFirst: (args: object) =>
        client.externalClubProviderMapping.findFirst(
          args as Prisma.ExternalClubProviderMappingFindFirstArgs,
        ),
      upsert: (args: object) =>
        client.externalClubProviderMapping.upsert(
          args as Prisma.ExternalClubProviderMappingUpsertArgs,
        ),
    },
    externalTeamProviderMapping: {
      findFirst: (args: object) =>
        client.externalTeamProviderMapping.findFirst(
          args as Prisma.ExternalTeamProviderMappingFindFirstArgs,
        ),
      upsert: (args: object) =>
        client.externalTeamProviderMapping.upsert(
          args as Prisma.ExternalTeamProviderMappingUpsertArgs,
        ),
    },
  };

  return database;
}
