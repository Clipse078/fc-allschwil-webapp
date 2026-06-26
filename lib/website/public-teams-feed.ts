/**
 * lib/website/public-teams-feed.ts
 *
 * Public teams query for /api/public/[tenant]/website/teams.
 *
 * ─── TENANT ISOLATION STATUS ────────────────────────────────────────────────
 * ISOLATION GAP: The Team model does not carry a tenantId FK in the current
 * schema. There is no reliable indirect isolation path:
 *
 *   - Team.orgUnitId → OrgUnit.tenantId:  orgUnitId is nullable; teams without
 *     an OrgUnit assignment would be silently excluded, producing false negatives
 *     rather than false positives. Not a structural guarantee.
 *   - Team → Event.tenantId:  Event.tenantId is nullable (legacy events = null);
 *     new teams without events would be excluded. Semantically incorrect.
 *   - TeamSeason → Season:  Season has no tenantId. Dead end.
 *
 * Per the SportClubEvo engineering standard "Every public query must be
 * tenant-scoped at the database/query level", this function MUST NOT be called
 * by the public teams endpoint until the migration adding Team.tenantId is
 * deployed and the where clause below is updated.
 *
 * The public teams route (app/api/public/[tenant]/website/teams/route.ts)
 * currently returns { teams: [] } until this gap is resolved.
 *
 * ─── REQUIRED MIGRATION ─────────────────────────────────────────────────────
 * Migration name: add_team_tenant_isolation
 *
 * SQL:
 *   ALTER TABLE "Team" ADD COLUMN "tenantId" TEXT;
 *
 *   UPDATE "Team" SET "tenantId" = (
 *     SELECT id FROM "Tenant" WHERE key = 'fc-allschwil' AND status = 'ACTIVE'
 *   ) WHERE "tenantId" IS NULL;
 *
 *   ALTER TABLE "Team"
 *     ADD CONSTRAINT "Team_tenantId_fkey"
 *     FOREIGN KEY ("tenantId") REFERENCES "Tenant"("id")
 *     ON DELETE SET NULL ON UPDATE CASCADE;
 *
 *   CREATE INDEX "Team_tenantId_idx" ON "Team"("tenantId");
 *
 * Prisma schema change (add to model Team):
 *   tenantId String?
 *   tenant   Tenant? @relation(fields: [tenantId], references: [id],
 *                               onDelete: SetNull, onUpdate: Cascade)
 *
 * Also add `teams Team[]` to model Tenant.
 *
 * After the migration, update the where clause here:
 *   where: {
 *     tenantId: input.tenantId,   ← add this line
 *     isActive: true,
 *     websiteVisible: true,
 *   }
 *
 * And make tenantId required in GetPublicTeamsInput.
 * ────────────────────────────────────────────────────────────────────────────
 *
 * Design invariants (post-migration):
 * - Only active and website-visible teams for the given tenant are returned.
 * - Private/admin-only fields are never returned: isActive, websiteVisible,
 *   infoboardVisible, orgUnitId, sortOrder, createdAt, updatedAt.
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
  /**
   * Required for DB-level tenant isolation once the Team.tenantId migration
   * is applied. Currently accepted but NOT yet used in the Prisma where clause
   * because Team has no tenantId FK. See isolation gap note above.
   */
  tenantId?: string | null;
  seasonKey?: string | null;
};

/**
 * Returns website-visible active teams with their active-season display names.
 *
 * WARNING: This function does NOT yet apply tenantId scoping at the DB level.
 * It must NOT be called by the public website endpoint until the Team.tenantId
 * migration is deployed. The public route currently returns [] as a safe fallback.
 * See the isolation gap documentation at the top of this file.
 *
 * Results are ordered by category, sortOrder, then name — consistent with
 * the admin teams list ordering.
 */
export async function getPublicTeams(
  input: GetPublicTeamsInput = {},
): Promise<PublicTeamListItem[]> {
  const seasonWhere = input.seasonKey
    ? { season: { key: input.seasonKey } }
    : { season: { isActive: true } };

  // TODO: Add `tenantId: input.tenantId` to the where clause after the
  // Team.tenantId migration is applied. See isolation gap documentation above.
  const teams = await prisma.team.findMany({
    where: {
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
