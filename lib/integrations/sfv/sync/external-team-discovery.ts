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
 *   - CLUB-DIRECTORY-02B: opportunistically enrich the resolved
 *     ExternalClub's crest from SFV's team-picture endpoint (see
 *     team-logo.ts) — but ONLY when the club does not already have a logo
 *     (tenant-managed or previously provider-filled). This keeps repeated
 *     syncs idempotent and avoids an SFV network call for every already-
 *     enriched opponent on every run (see resolveOpponentLogoIfNeeded
 *     below). The actual "never overwrite a tenant logo" rule is enforced
 *     one layer down, unchanged, by
 *     lib/club-directory/provider-sync.ts#buildExternalClubTenantFieldUpdate
 *     — this module never touches ExternalClub.logoUrl directly.
 *
 * Architecture invariant: this module NEVER creates a tenant-owned Team —
 * only canonical Club Directory ExternalClub/ExternalTeam records, which is
 * the entire point of routing external opponents through the Club Directory
 * instead of the tenant Team table (see schedule-persistence.ts doc header).
 */

import { prisma } from "@/lib/db/prisma";
import { createClubDirectoryMutationDatabase } from "@/lib/club-directory/prisma-mutation-adapter";
import { createClubDirectoryQueryDatabase } from "@/lib/club-directory/prisma-adapter";
import { discoverExternalTeamFromProvider } from "@/lib/club-directory/discovery-service";
import { findExternalTeamByProviderIdentity } from "@/lib/club-directory/query-service";
import { resolveProviderLogoDataUri } from "./team-logo";

const PROVIDER = "SFV";

export type ExternalOpponentResolver = (
  sfvTeamId: number,
  sfvTeamName: string | null,
) => Promise<string | null>;

/**
 * Decides whether this SFV teamId still needs a fresh logo fetch, and
 * performs it (best-effort) when so.
 *
 * "Needs a fetch" means: no canonical ExternalTeam has been linked to this
 * provider identity yet (brand-new discovery — the about-to-be-created club
 * obviously has no logo), OR one exists but its parent ExternalClub.logoUrl
 * is still empty (never yet enriched, and never manually set by a Club
 * Admin). Once a club has ANY logo — tenant-uploaded or provider-filled —
 * this returns null without calling the SFV picture endpoint at all,
 * satisfying "avoid unnecessary provider/network calls" without needing any
 * separate cache: the ExternalClub row itself is the durable memoization.
 *
 * Never throws: a failure of this pre-check (e.g. a transient DB error)
 * simply skips enrichment for this call — discovery/link below still
 * proceeds exactly as it would if no logo were available this round.
 */
async function resolveOpponentLogoIfNeeded(
  queryDatabase: ReturnType<typeof createClubDirectoryQueryDatabase>,
  tenantId: string,
  sfvTeamId: number,
): Promise<string | null> {
  try {
    const existing = await findExternalTeamByProviderIdentity(queryDatabase, {
      tenantId,
      provider: PROVIDER,
      providerTeamId: sfvTeamId,
    });

    const alreadyEnriched = existing !== null && existing.externalClub.logoUrl !== null;
    if (alreadyEnriched) {
      return null;
    }
  } catch {
    return null;
  }

  return resolveProviderLogoDataUri(sfvTeamId);
}

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
  const queryDatabase = createClubDirectoryQueryDatabase(prisma);
  const cache = new Map<number, Promise<string | null>>();

  return (sfvTeamId: number, sfvTeamName: string | null): Promise<string | null> => {
    const cached = cache.get(sfvTeamId);
    if (cached !== undefined) {
      return cached;
    }

    const pending = (async () => {
      const providerLogoUrl = await resolveOpponentLogoIfNeeded(queryDatabase, tenantId, sfvTeamId);

      const result = await discoverExternalTeamFromProvider(
        database,
        {
          tenantId,
          provider: PROVIDER,
          providerTeamId: sfvTeamId,
          providerTeamName: sfvTeamName,
          providerLogoUrl,
        },
        syncedAt,
      );

      return result.team.id;
    })().catch(() => null);

    cache.set(sfvTeamId, pending);
    return pending;
  };
}
