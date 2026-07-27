/**
 * lib/integrations/sfv/provider-adapter.ts
 *
 * SFV provider adapter for the canonical mapping layer (TEAM-PROVIDER-01).
 *
 * Implements the IProviderAdapter interface using existing SFV client and
 * tenant-config infrastructure. This is the ONLY file where SFV-specific
 * code is allowed to interact with the provider-neutral mapping layer.
 *
 * Architecture invariants:
 *   - No SFV logic in canonical services. All SFV coupling is here.
 *   - Delegates to existing fetchTeamList() and requireEnabledSfvConfigForTenant().
 *   - Competition context is used to narrow the team list by league (LeagueId param).
 *   - Returns normalised ProviderTeam DTOs — no SFV-specific types escape this module.
 *
 * Registration:
 *   Call registerSfvAdapter() once at application startup (e.g. in instrumentation.ts
 *   or the first API route that uses provider mapping).
 */

import type { IProviderAdapter, ProviderTeam, FetchProviderTeamsInput } from "@/lib/provider-mapping/types";
import { registerProviderAdapter } from "@/lib/provider-mapping/provider-registry";
import { requireEnabledSfvConfigForTenant } from "./tenant-config-service";
import { fetchTeamList } from "./client";
import { prisma } from "@/lib/db/prisma";

export const SFV_PROVIDER_KEY = "SFV";

// ── Adapter implementation ────────────────────────────────────────────────────

class SfvProviderAdapter implements IProviderAdapter {
  readonly providerKey = SFV_PROVIDER_KEY;

  /**
   * Fetches all SFV teams for this tenant's configured club and season.
   *
   * When competitionId is provided, resolves the competition's externalCompetitionId
   * and uses it as the LeagueId filter on the SFV API call.
   *
   * @throws {SfvTenantConfigNotFoundError} — no SFV config for tenant
   * @throws {SfvTenantConfigDisabledError} — SFV integration disabled
   * @throws {SfvError} — SFV API error
   */
  async fetchProviderTeams(input: FetchProviderTeamsInput): Promise<ProviderTeam[]> {
    const { tenantId, competitionId } = input;
    const config = await requireEnabledSfvConfigForTenant(tenantId);

    // Resolve competition context → league filter
    let leagueId: number | undefined;
    if (competitionId) {
      const competition = await prisma.competition.findFirst({
        where: { id: competitionId, tenantId },
        select: { externalCompetitionId: true },
      });
      if (competition?.externalCompetitionId != null) {
        leagueId = competition.externalCompetitionId;
      }
    }

    const sfvTeams = await fetchTeamList({
      SeasonId: config.defaultSeasonId,
      ClubId: config.clubId,
      ...(config.organisationId != null ? { OrganisationId: config.organisationId } : {}),
      ...(leagueId != null ? { LeagueId: leagueId } : {}),
    });

    return sfvTeams.map((t): ProviderTeam => ({
      externalTeamId: t.teamId,
      externalSeasonId: config.defaultSeasonId,
      name: t.teamFullname ?? t.teamName ?? String(t.teamId),
      leagueId: t.teamLeagueId ?? null,
      leagueName: t.teamLeagueName ?? null,
      organisationId: t.teamOrganisationId ?? null,
      ageCategory: null,   // SFV team list does not expose age category directly
      gender: null,        // SFV team list does not expose gender directly
      isActive: t.isTeamActive,
    }));
  }

  /**
   * Returns the SFV season ID configured for this tenant.
   *
   * @throws {SfvTenantConfigNotFoundError} — no SFV config for tenant
   * @throws {SfvTenantConfigDisabledError} — SFV integration disabled
   */
  async getProviderSeasonId(tenantId: string): Promise<number> {
    const config = await requireEnabledSfvConfigForTenant(tenantId);
    return config.defaultSeasonId;
  }
}

// ── Singleton ─────────────────────────────────────────────────────────────────

const sfvAdapter = new SfvProviderAdapter();

/**
 * Registers the SFV adapter in the canonical provider registry.
 *
 * Call once at application startup. Safe to call multiple times in test
 * environments where the registry is cleared between tests.
 */
export function registerSfvAdapter(): void {
  registerProviderAdapter(sfvAdapter);
}

export { sfvAdapter };
