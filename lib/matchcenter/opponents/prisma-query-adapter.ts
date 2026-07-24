import { Prisma } from "@prisma/client";

import type { OpponentQueryDatabase } from "./query-service";

const opponentInclude = { externalMappings: true } as const;

/**
 * Narrow structural type: only the two operations this adapter delegates to.
 * Using a structural interface (rather than Pick<PrismaClient, "opponent">)
 * keeps the parameter mockable in tests while preserving full Prisma-typed
 * inference for the return type.
 */
export interface OpponentPrismaClient {
  opponent: Pick<Prisma.OpponentDelegate, "findMany" | "findFirst">;
}

/**
 * Wraps the Prisma opponent delegate in a narrow adapter that satisfies
 * OpponentQueryDatabase. The adapter forces `include: { externalMappings: true }`
 * on every call so that TypeScript can resolve the concrete return type and
 * verify assignability to OpponentRecord.
 */
export function createOpponentQueryDatabase(
  client: OpponentPrismaClient,
): OpponentQueryDatabase {
  return {
    opponent: {
      findMany: (args: object) =>
        client.opponent.findMany({
          ...(args as Prisma.OpponentFindManyArgs),
          include: opponentInclude,
        }),
      findFirst: (args: object) =>
        client.opponent.findFirst({
          ...(args as Prisma.OpponentFindFirstArgs),
          include: opponentInclude,
        }),
    },
  };
}
