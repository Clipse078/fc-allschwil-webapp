/**
 * Initiatives module queries.
 *
 * TODO(governance — Module Admin Config sprint):
 * When module-level access control is implemented, listInitiatives() should
 * accept a session/user context and filter by AccessPolicy or role-based
 * visibility flags (isPublicToTenant, reviewStage visibility).
 *
 * TODO(multi-tenancy): replace ACTIVE_TENANT_SLUG with tenant context from session.
 */
import { prisma } from "@/lib/db/prisma";
import { InitiativeStatus, InitiativePriority } from "@prisma/client";
import { ACTIVE_TENANT_SLUG } from "@/lib/platform/constants";

export type { InitiativeStatus, InitiativePriority };

export type InitiativeListFilter = {
  status?: string;
  priority?: string;
  seasonId?: string;
  teamId?: string;
  orgUnitLabel?: string;
};

function parseInitiativeStatus(value?: string): InitiativeStatus | undefined {
  if (!value) return undefined;
  if ((Object.values(InitiativeStatus) as string[]).includes(value)) {
    return value as InitiativeStatus;
  }
  return undefined;
}

function parseInitiativePriority(value?: string): InitiativePriority | undefined {
  if (!value) return undefined;
  if ((Object.values(InitiativePriority) as string[]).includes(value)) {
    return value as InitiativePriority;
  }
  return undefined;
}

export async function listInitiatives(filter?: InitiativeListFilter) {
  return prisma.initiative.findMany({
    where: {
      tenantSlug: ACTIVE_TENANT_SLUG, // TODO(multi-tenancy): replace with session tenant
      status: parseInitiativeStatus(filter?.status),
      priority: parseInitiativePriority(filter?.priority),
      seasonId: filter?.seasonId ?? undefined,
      teamId: filter?.teamId ?? undefined,
      orgUnitLabel: filter?.orgUnitLabel ?? undefined,
    },
    orderBy: [{ priority: "desc" }, { dueDate: "asc" }, { createdAt: "desc" }],
    select: {
      id: true,
      title: true,
      summary: true,
      status: true,
      priority: true,
      dueDate: true,
      orgUnitLabel: true,
      ownerName: true,
      seasonId: true,
      teamId: true,
      createdAt: true,
      _count: {
        select: { tasks: true, milestones: true },
      },
    },
  });
}

export type InitiativeListItem = Awaited<ReturnType<typeof listInitiatives>>[number];

export async function getInitiativeById(id: string) {
  // TODO(multi-tenancy): add tenantSlug filter once multi-tenancy is active.
  return prisma.initiative.findUnique({
    where: { id },
    include: {
      tasks:      { orderBy: [{ status: "asc" }, { sortOrder: "asc" }] },
      milestones: { orderBy: { sortOrder: "asc" } },
      season:     { select: { id: true, key: true, name: true } },
      team:       { select: { id: true, name: true, slug: true } },
    },
  });
}

export type InitiativeDetail = Awaited<ReturnType<typeof getInitiativeById>>;
