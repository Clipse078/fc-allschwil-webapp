/**
 * lib/competitions/competition-resolver.ts
 *
 * Matchcenter-facing resolver for canonical Competition lookups.
 *
 * Exposes resolveCompetition() which locates the canonical Competition for
 * a given provider + external identifiers. Used by Matchcenter to enrich
 * match records with canonical competition context.
 *
 * Architecture invariants:
 *   - Read-only. No writes or side effects.
 *   - tenantId from trusted session context only.
 *   - Returns null when no match — callers decide fallback behaviour.
 *   - Does NOT resolve matches. Match resolution comes in a later slice.
 */

import type { CompetitionDto } from "./dto";
import { resolveCompetitionByProviderIds } from "./queries";

// ── Public resolver ────────────────────────────────────────────────────────────

/**
 * Resolves the canonical Competition for a given provider + external IDs.
 *
 * Used by Matchcenter to locate the Competition record for an incoming
 * provider match, without importing or creating anything.
 *
 * Returns null when:
 *   - No Competition row exists for this (tenantId, provider,
 *     externalCompetitionId, externalSeasonId) combination.
 *   - The competition exists but has been archived.
 *
 * IMPORTANT: Does NOT resolve matches. Match assignment to competitions
 * is a separate concern handled in a later slice.
 *
 * @param tenantId              Trusted session-derived tenant identifier.
 * @param provider              Provider identifier (e.g. "SFV").
 * @param externalCompetitionId Provider's competition/league identifier.
 * @param externalSeasonId      Provider's season identifier.
 * @returns                     Canonical CompetitionDto or null.
 */
export async function resolveCompetition(
  tenantId: string,
  provider: string,
  externalCompetitionId: number,
  externalSeasonId: number,
): Promise<CompetitionDto | null> {
  const competition = await resolveCompetitionByProviderIds(
    tenantId,
    provider,
    externalCompetitionId,
    externalSeasonId,
  );

  if (!competition || competition.isArchived) {
    return null;
  }

  return competition;
}
