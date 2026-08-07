/**
 * lib/integrations/sfv/sync/external-team-discovery.ts
 *
 * CLUB-DIRECTORY-02 — SFV-side adapter that wires the provider-agnostic
 * `discoverExternalTeamFromProvider` (lib/club-directory/discovery-service.ts)
 * into schedule sync.
 *
 * Responsibilities:
 *   - Resolve an SFV opponent teamId to a canonical Club Directory
 *     ExternalTeam id, creating the canonical shell on first sight.
 *   - Memoize per SFV teamId for the lifetime of a single sync run, so an
 *     opponent appearing in several schedule entries within the same run is
 *     only discovered/resolved once (still fully idempotent across runs —
 *     see discoverExternalTeamFromProvider).
 *   - Never throw: discovery is best-effort. A single opponent lookup
 *     failure must never block match persistence — schedule sync behaves
 *     exactly as before CLUB-DIRECTORY-02 when discovery fails
 *     (homeExternalTeamId/awayExternalTeamId simply stay null, same as the
 *     pre-existing "external opponent — name only" behaviour).
 *
 * Architecture invariant: this module NEVER creates a tenant-owned Team —
 * only canonical Club Directory ExternalClub/ExternalTeam records, which is
 * the entire point of routing external opponents through the Club Directory
 * instead of the tenant Team table (see schedule-persistence.ts doc header).
 */

import { prisma } from "@/lib/db/prisma";
import { createClubDirectoryMutationDatabase } from "@/lib/club-directory/prisma-mutation-adapter";
import { discoverExternalTeamFromProvider } from "@/lib/club-directory/discovery-service";

const PROVIDER = "SFV";

export type ExternalOpponentResolver = (
  sfvTeamId: number,
  sfvTeamName: string | null,
) => Promise<string | null>;

/**
 * Builds a memoized resolver for one sync run.
 *
 * `syncedAt` is the sync run's own timestamp (SfvScheduleSyncContext.syncedAt)
 * so `lastSyncedAt` on any refreshed ExternalTeamProviderMapping matches the
 * rest of this run's provider-owned fields.
 */
export function createExternalOpponentResolver(
  tenantId: string,
  syncedAt: Date,
): ExternalOpponentResolver {
  const database = createClubDirectoryMutationDatabase(prisma);
  const cache = new Map<number, Promise<string | null>>();

  return (sfvTeamId: number, sfvTeamName: string | null): Promise<string | null> => {
    const cached = cache.get(sfvTeamId);
    if (cached !== undefined) {
      return cached;
    }

    const pending = discoverExternalTeamFromProvider(
      database,
      {
        tenantId,
        provider: PROVIDER,
        providerTeamId: sfvTeamId,
        providerTeamName: sfvTeamName,
      },
      syncedAt,
    )
      .then((result) => result.team.id)
      .catch(() => null);

    cache.set(sfvTeamId, pending);
    return pending;
  };
}
