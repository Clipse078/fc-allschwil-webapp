/**
 * lib/club-directory/prisma-mutation-adapter.ts
 *
 * Wraps the real Prisma delegates in the narrow, structural
 * `ClubDirectoryMutationDatabase` interface expected by
 * lib/club-directory/mutation-service.ts.
 *
 * CLUB-DIRECTORY-02 concurrency fix: also provides genuine transactional
 * atomicity (`transaction()`, backed by Prisma's interactive
 * `$transaction`) and a duplicate-safe `externalTeamProviderMapping.create()`
 * that translates a real Postgres unique-constraint violation (P2002) into
 * `ClubDirectoryUniqueConstraintError` — the signal discovery-service.ts
 * uses to detect "a concurrent caller already claimed this provider
 * identity" and recover by adopting the winner's row instead of leaving a
 * duplicate shell behind.
 */

import { Prisma, type PrismaClient } from "@prisma/client";

import {
  ClubDirectoryUniqueConstraintError,
  type ClubDirectoryMutationDatabase,
} from "./mutation-service";

type ClubDirectoryMutationPrismaDelegates = Pick<
  PrismaClient,
  "externalClub" | "externalTeam" | "externalClubProviderMapping" | "externalTeamProviderMapping"
>;

export type ClubDirectoryMutationPrismaClient = ClubDirectoryMutationPrismaDelegates & {
  $transaction: PrismaClient["$transaction"];
};

/**
 * Detects a Postgres/Prisma unique-constraint violation (P2002).
 *
 * Both ExternalTeamProviderMapping (`@@unique([tenantId, provider,
 * providerTeamId, providerSeasonId])`) and ExternalClubProviderMapping
 * (`@@unique([tenantId, provider, providerClubId])`) have exactly one
 * unique constraint besides their cuid() primary key, and this wrapper is
 * only ever used for a plain `create()` call carrying that exact key (see
 * the interface docs on `ClubDirectoryMutationDatabase`), so any P2002
 * raised by either specific call is guaranteed to be that row's own
 * constraint. Any other error code propagates unchanged — this adapter
 * never masks a real failure as a benign race.
 */
function isProviderMappingUniqueViolation(error: unknown): boolean {
  return error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002";
}

function buildDelegates(
  client: ClubDirectoryMutationPrismaDelegates,
): Omit<ClubDirectoryMutationDatabase, "transaction"> {
  return {
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
      create: async (args: object) => {
        try {
          return await client.externalClubProviderMapping.create(
            args as Prisma.ExternalClubProviderMappingCreateArgs,
          );
        } catch (error) {
          if (isProviderMappingUniqueViolation(error)) {
            throw new ClubDirectoryUniqueConstraintError(
              "ExternalClubProviderMapping already exists for this (tenantId, provider, providerClubId).",
            );
          }
          throw error;
        }
      },
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
      create: async (args: object) => {
        try {
          return await client.externalTeamProviderMapping.create(
            args as Prisma.ExternalTeamProviderMappingCreateArgs,
          );
        } catch (error) {
          if (isProviderMappingUniqueViolation(error)) {
            throw new ClubDirectoryUniqueConstraintError(
              "ExternalTeamProviderMapping already exists for this (tenantId, provider, providerTeamId, providerSeasonId).",
            );
          }
          throw error;
        }
      },
    },
  };
}

/**
 * Builds a `ClubDirectoryMutationDatabase` from a set of delegates that are
 * already inside a transactional scope (or, for the top-level database, the
 * plain client). `transaction()` on this nested database is a pass-through
 * — Prisma transactions do not nest, and discovery-service.ts never calls
 * `.transaction()` from within a callback it already received, so this is
 * never exercised in practice; it only exists so the returned object fully
 * satisfies the `ClubDirectoryMutationDatabase` contract.
 */
function buildScopedDatabase(client: ClubDirectoryMutationPrismaDelegates): ClubDirectoryMutationDatabase {
  const delegates = buildDelegates(client);
  const database: ClubDirectoryMutationDatabase = {
    ...delegates,
    transaction: (fn) => fn(database),
  };
  return database;
}

export function createClubDirectoryMutationDatabase(
  client: ClubDirectoryMutationPrismaClient,
): ClubDirectoryMutationDatabase {
  const delegates = buildDelegates(client);

  const database: ClubDirectoryMutationDatabase = {
    ...delegates,
    transaction: (fn) =>
      client.$transaction((tx: Prisma.TransactionClient) => fn(buildScopedDatabase(tx))),
  };

  return database;
}
