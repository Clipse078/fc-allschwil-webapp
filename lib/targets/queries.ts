/**
 * Targets module queries.
 *
 * TODO(governance — Module Admin Config sprint):
 * listTargets() should eventually filter by AccessPolicy / reviewStage visibility
 * and accept a session/user context for role-based visibility.
 *
 * TODO(multi-tenancy): replace ACTIVE_TENANT_SLUG with tenant context from session.
 */
import { prisma } from "@/lib/db/prisma";
import { TargetStatus } from "@prisma/client";
import { ACTIVE_TENANT_SLUG } from "@/lib/platform/constants";

export type { TargetStatus };

export type TargetListFilter = {
  status?: string;
  moduleKey?: string;
  targetCategory?: string;
  seasonId?: string;
  teamId?: string;
  orgUnitLabel?: string;
};

function parseTargetStatus(value?: string): TargetStatus | undefined {
  if (!value) return undefined;
  if ((Object.values(TargetStatus) as string[]).includes(value)) {
    return value as TargetStatus;
  }
  return undefined;
}

export async function listTargets(filter?: TargetListFilter) {
  return prisma.target.findMany({
    where: {
      tenantSlug: ACTIVE_TENANT_SLUG, // TODO(multi-tenancy): replace with session tenant
      status:         parseTargetStatus(filter?.status),
      moduleKey:      filter?.moduleKey      ?? undefined,
      targetCategory: filter?.targetCategory ?? undefined,
      seasonId:       filter?.seasonId       ?? undefined,
      teamId:         filter?.teamId         ?? undefined,
      orgUnitLabel:   filter?.orgUnitLabel   ?? undefined,
    },
    orderBy: [{ status: "asc" }, { endsAt: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      status: true,
      periodType: true,
      endsAt: true,
      orgUnitLabel: true,
      moduleKey: true,
      targetCategory: true,
      ageGroupHint: true,
      suggestedBySystem: true,
      recommendedRangeMin: true,
      recommendedRangeMax: true,
      createdAt: true,
      _count: { select: { metrics: true } },
    },
  });
}

export type TargetListItem = Awaited<ReturnType<typeof listTargets>>[number];

export async function getTargetById(id: string) {
  // TODO(multi-tenancy): add tenantSlug filter once multi-tenancy is active.
  return prisma.target.findUnique({
    where: { id },
    include: {
      metrics: {
        orderBy: { sortOrder: "asc" },
        include: {
          dataPoints: {
            orderBy: { measuredAt: "desc" },
            take: 1, // latest reading only for list display
          },
        },
      },
      season: { select: { id: true, key: true, name: true } },
      team:   { select: { id: true, name: true, slug: true } },
    },
  });
}

export type TargetDetail = Awaited<ReturnType<typeof getTargetById>>;
