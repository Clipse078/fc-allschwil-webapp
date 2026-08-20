/**
 * lib/registrations/waiting-list-queries.ts
 *
 * REG-WAIT-01: Read-model queries for the canonical Waiting List domain.
 *
 * All queries are tenant-scoped and never leak cross-tenant data.
 * Relationship resolution is done server-side; clients receive ready-to-render
 * typed read-model shapes.
 */

import { Prisma, WaitingListStatus, WaitingListPriority, WaitingListScopeType } from "@prisma/client";
import { prisma } from "@/lib/db/prisma";
import { requireTenant } from "@/lib/tenants/require-tenant";

// ── Shared select ───────────────────────────────────────────────────────────

const waitingListEntrySelect = {
  id: true,
  tenantId: true,
  registrationId: true,
  personId: true,
  scopeType: true,
  targetGroupId: true,
  orgUnitId: true,
  teamSeasonId: true,
  status: true,
  priority: true,
  responsibleUserId: true,
  reason: true,
  internalNote: true,
  addedAt: true,
  addedByUserId: true,
  lastContactedAt: true,
  offeredAt: true,
  resolvedAt: true,
  resolvedByUserId: true,
  createdAt: true,
  updatedAt: true,
  registration: {
    select: {
      id: true,
      type: true,
      status: true,
      firstName: true,
      lastName: true,
      email: true,
      phone: true,
      birthYear: true,
      birthDate: true,
      submittedAt: true,
      targetGroupId: true,
      assignedToUserId: true,
      personId: true,
    },
  },
  person: {
    select: {
      id: true,
      firstName: true,
      lastName: true,
      displayName: true,
      email: true,
      phone: true,
      dateOfBirth: true,
      tenantId: true,
    },
  },
  targetGroup: {
    select: { id: true, key: true, name: true },
  },
  orgUnit: {
    select: { id: true, key: true, name: true, type: true },
  },
  teamSeason: {
    select: {
      id: true,
      displayName: true,
      shortName: true,
      status: true,
      team: { select: { id: true, name: true } },
      season: { select: { id: true, name: true } },
    },
  },
  responsibleUser: {
    select: { id: true, firstName: true, lastName: true, email: true },
  },
  addedByUser: {
    select: { id: true, firstName: true, lastName: true },
  },
  resolvedByUser: {
    select: { id: true, firstName: true, lastName: true },
  },
} satisfies Prisma.WaitingListEntrySelect;

type WaitingListEntryRecord = Prisma.WaitingListEntryGetPayload<{
  select: typeof waitingListEntrySelect;
}>;

function serializeEntry(entry: WaitingListEntryRecord) {
  return {
    ...entry,
    addedAt: entry.addedAt.toISOString(),
    lastContactedAt: entry.lastContactedAt?.toISOString() ?? null,
    offeredAt: entry.offeredAt?.toISOString() ?? null,
    resolvedAt: entry.resolvedAt?.toISOString() ?? null,
    createdAt: entry.createdAt.toISOString(),
    updatedAt: entry.updatedAt.toISOString(),
    registration: {
      ...entry.registration,
      birthDate: entry.registration.birthDate?.toISOString() ?? null,
      submittedAt: entry.registration.submittedAt.toISOString(),
    },
    person: entry.person
      ? {
          ...entry.person,
          dateOfBirth: entry.person.dateOfBirth?.toISOString() ?? null,
        }
      : null,
  };
}

export type WaitingListEntryItem = ReturnType<typeof serializeEntry>;

// ── Filter type ─────────────────────────────────────────────────────────────

export type WaitingListFilter = {
  status?: WaitingListStatus | WaitingListStatus[];
  priority?: WaitingListPriority;
  scopeType?: WaitingListScopeType;
  targetGroupId?: string;
  orgUnitId?: string;
  teamSeasonId?: string;
  responsibleUserId?: string;
  search?: string;
};

// ── List query ───────────────────────────────────────────────────────────────

export async function listWaitingListEntriesForTenant(
  tenantSlug: string,
  filter: WaitingListFilter = {},
): Promise<WaitingListEntryItem[]> {
  const tenant = await requireTenant(tenantSlug);

  const where: Prisma.WaitingListEntryWhereInput = {
    tenantId: tenant.id,
  };

  if (filter.status) {
    where.status = Array.isArray(filter.status) ? { in: filter.status } : filter.status;
  }
  if (filter.priority) where.priority = filter.priority;
  if (filter.scopeType) where.scopeType = filter.scopeType;
  if (filter.targetGroupId) where.targetGroupId = filter.targetGroupId;
  if (filter.orgUnitId) where.orgUnitId = filter.orgUnitId;
  if (filter.teamSeasonId) where.teamSeasonId = filter.teamSeasonId;
  if (filter.responsibleUserId) where.responsibleUserId = filter.responsibleUserId;

  if (filter.search) {
    const q = filter.search.trim();
    where.OR = [
      { registration: { firstName: { contains: q, mode: "insensitive" } } },
      { registration: { lastName: { contains: q, mode: "insensitive" } } },
      { registration: { email: { contains: q, mode: "insensitive" } } },
      { person: { firstName: { contains: q, mode: "insensitive" } } },
      { person: { lastName: { contains: q, mode: "insensitive" } } },
    ];
  }

  const entries = await prisma.waitingListEntry.findMany({
    where,
    orderBy: [
      { priority: "desc" },
      { addedAt: "asc" },
    ],
    select: waitingListEntrySelect,
  });

  return entries.map(serializeEntry);
}

// ── Single entry ─────────────────────────────────────────────────────────────

export async function getWaitingListEntryForTenant(
  tenantSlug: string,
  entryId: string,
): Promise<WaitingListEntryItem | null> {
  const tenant = await requireTenant(tenantSlug);

  const entry = await prisma.waitingListEntry.findFirst({
    where: { id: entryId, tenantId: tenant.id },
    select: waitingListEntrySelect,
  });

  if (!entry) return null;
  return serializeEntry(entry);
}

// ── Active entry check ───────────────────────────────────────────────────────

const TERMINAL_STATUSES: WaitingListStatus[] = ["PLACED", "WITHDRAWN", "REJECTED", "ARCHIVED"];

export async function getActiveWaitingListEntryForRegistration(
  tenantId: string,
  registrationId: string,
): Promise<{ id: string; status: WaitingListStatus } | null> {
  return prisma.waitingListEntry.findFirst({
    where: {
      tenantId,
      registrationId,
      status: { notIn: TERMINAL_STATUSES },
    },
    select: { id: true, status: true },
  });
}
