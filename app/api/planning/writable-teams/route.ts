/**
 * GET /api/planning/writable-teams?domain=training|match|tournament
 *
 * ORG-ACCESS-03 — Returns the IDs and display names of teams for which the
 * authenticated user has write authorization in the specified planning domain.
 *
 * Used exclusively to populate team pickers in planning CREATE forms.
 * Does NOT affect Center overview queries (read visibility remains broad).
 *
 * Coordinator (tenant-wide permission): all tenant teams.
 * Scoped user: only teams whose canonical OrgUnit is covered by their scope.
 * Unauthenticated / no planning permission: empty list.
 *
 * Response: { teams: { id, name, displayName, ageGroup, genderGroup, isActive }[] }
 */

import { type NextRequest, NextResponse } from "next/server";
import { auth } from "@/auth";
import { prisma } from "@/lib/db/prisma";
import { createPlanningAuthorizationPolicy } from "@/lib/planning/planning-authorization-policy";
import type { PlanningDomain } from "@/lib/planning/planning-authorization-policy";

const VALID_DOMAINS = new Set<PlanningDomain>(["training", "match", "tournament"]);

export async function GET(request: NextRequest): Promise<NextResponse> {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const tenantId = session.user.activeTenantId;
  if (!tenantId) {
    return NextResponse.json({ error: "Tenant context required" }, { status: 403 });
  }

  const domainParam = request.nextUrl.searchParams.get("domain") ?? "";
  if (!VALID_DOMAINS.has(domainParam as PlanningDomain)) {
    return NextResponse.json(
      { error: "domain must be one of: training, match, tournament" },
      { status: 400 },
    );
  }

  const domain = domainParam as PlanningDomain;
  const userId = session.user.effectiveUserId ?? session.user.id;
  if (!userId) {
    return NextResponse.json({ error: "User identity required" }, { status: 403 });
  }

  const policy = createPlanningAuthorizationPolicy(prisma);

  const writableTeamIds = await policy.getWritableTeamIds(
    { userId, tenantId },
    domain,
  );

  if (writableTeamIds.length === 0) {
    return NextResponse.json({ teams: [] });
  }

  // Load team display data for the writable team IDs
  const teams = await prisma.team.findMany({
    where: { id: { in: writableTeamIds }, tenantId },
    select: {
      id: true,
      name: true,
      shortName: true,
      ageGroup: true,
      genderGroup: true,
      isActive: true,
      sortOrder: true,
    },
    orderBy: { sortOrder: "asc" },
  });

  const result = teams.map((t) => ({
    id: t.id,
    name: t.name,
    displayName: t.shortName ?? t.name,
    ageGroup: t.ageGroup ?? null,
    genderGroup: t.genderGroup ?? null,
    isActive: t.isActive,
  }));

  return NextResponse.json({ teams: result });
}
