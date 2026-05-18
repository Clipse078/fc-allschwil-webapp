import { prisma } from "@/lib/db/prisma";
import { MeetingStatus } from "@prisma/client";
import { ACTIVE_TENANT_SLUG } from "@/lib/platform/constants";

export type { MeetingStatus };

export type MeetingListFilter = {
  /** Filter by MeetingStatus enum value. Invalid values are silently ignored. */
  status?: string;
  seasonId?: string;
  teamId?: string;
  /** Filter by free-text org unit label (exact match). */
  orgUnitLabel?: string;
};

/** Parses a string into MeetingStatus, returning undefined for unknown values. */
function parseMeetingStatus(value?: string): MeetingStatus | undefined {
  if (!value) return undefined;
  if ((Object.values(MeetingStatus) as string[]).includes(value)) {
    return value as MeetingStatus;
  }
  return undefined;
}

/**
 * Returns a flat list of meetings for the current tenant, ordered by scheduledAt desc.
 *
 * TODO(multi-tenancy): replace ACTIVE_TENANT_SLUG with the tenant slug/id resolved
 * from the authenticated session once multi-tenancy is implemented in the Organisation Builder.
 */
export async function listMeetings(filter?: MeetingListFilter) {
  return prisma.meeting.findMany({
    where: {
      tenantSlug: ACTIVE_TENANT_SLUG, // TODO(multi-tenancy): replace with session tenant
      status: parseMeetingStatus(filter?.status),
      seasonId: filter?.seasonId ?? undefined,
      teamId: filter?.teamId ?? undefined,
      orgUnitLabel: filter?.orgUnitLabel ?? undefined,
    },
    orderBy: { scheduledAt: "desc" },
    select: {
      id: true,
      title: true,
      status: true,
      scheduledAt: true,
      endedAt: true,
      location: true,
      orgUnitLabel: true,
      seasonId: true,
      teamId: true,
      createdAt: true,
      _count: {
        select: { participants: true },
      },
    },
  });
}

export type MeetingListItem = Awaited<ReturnType<typeof listMeetings>>[number];

/**
 * Returns a single meeting with all related records included.
 *
 * TODO(multi-tenancy): add tenantSlug filter once multi-tenancy is active.
 */
export async function getMeetingById(id: string) {
  return prisma.meeting.findUnique({
    where: { id },
    include: {
      agendaItems: { orderBy: { sortOrder: "asc" } },
      participants: {
        orderBy: [{ role: "asc" }, { displayName: "asc" }],
      },
      decisions: { orderBy: { sortOrder: "asc" } },
      actions: {
        orderBy: [{ status: "asc" }, { sortOrder: "asc" }],
      },
      season: { select: { id: true, key: true, name: true } },
      team: { select: { id: true, name: true, slug: true } },
    },
  });
}

export type MeetingDetail = Awaited<ReturnType<typeof getMeetingById>>;
