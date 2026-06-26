/**
 * lib/website/public-teams-feed.ts
 *
 * Public teams query for /api/public/[tenant]/website/teams.
 *
 * Tenant isolation is enforced at the DB level via Team.tenantId
 * (migration: 20260626000000_team_tenant_isolation).
 *
 * Design invariants:
 * - Only active and website-visible teams for the given tenant are returned.
 * - Private/admin-only fields are never returned: isActive, websiteVisible,
 *   infoboardVisible, orgUnitId, sortOrder, tenantId, createdAt, updatedAt.
 * - displayName falls back to team.name when no active TeamSeason is found.
 * - Season is resolved by active season flag when seasonKey is not supplied.
 */

import { prisma } from "@/lib/db/prisma";
import type { PublicTeamListItem } from "@/lib/website/types";

// Local type matching the Prisma select shape, used to avoid implicit `any`
// on the map callback (Prisma client must be generated for full inference).
type TeamRow = {
  id: string;
  name: string;
  slug: string;
  category: string;
  genderGroup: string | null;
  ageGroup: string | null;
  teamSeasons: Array<{
    displayName: string;
    shortName: string | null;
    season: { key: string; name: string };
  }>;
};

export type GetPublicTeamsInput = {
  /** Required: DB-level tenant isolation via Team.tenantId. */
  tenantId: string;
  seasonKey?: string | null;
};

/**
 * Returns website-visible active teams for the given tenant with their
 * active-season display names.
 *
 * Results are ordered by category, sortOrder, then name — consistent with
 * the admin teams list ordering.
 */
export async function getPublicTeams(
  input: GetPublicTeamsInput,
): Promise<PublicTeamListItem[]> {
  const seasonWhere = input.seasonKey
    ? { season: { key: input.seasonKey } }
    : { season: { isActive: true } };

  const teams = await prisma.team.findMany({
    where: {
      tenantId: input.tenantId,
      isActive: true,
      websiteVisible: true,
    },
    orderBy: [{ category: "asc" }, { sortOrder: "asc" }, { name: "asc" }],
    select: {
      id: true,
      name: true,
      slug: true,
      category: true,
      genderGroup: true,
      ageGroup: true,
      teamSeasons: {
        where: seasonWhere,
        orderBy: { createdAt: "desc" },
        take: 1,
        select: {
          displayName: true,
          shortName: true,
          season: { select: { key: true, name: true } },
        },
      },
    },
  });

  return (teams as TeamRow[]).map((team) => {
    const activeSeason = team.teamSeasons[0] ?? null;
    return {
      id: team.id,
      name: team.name,
      slug: team.slug,
      category: team.category,
      genderGroup: team.genderGroup,
      ageGroup: team.ageGroup,
      displayName: activeSeason?.displayName ?? team.name,
      shortName: activeSeason?.shortName ?? null,
      season: activeSeason?.season ?? null,
    };
  });
}
