/**
 * CLUB-EVENTS-01: Service layer for tenant-managed Veranstaltungen (EventType.OTHER).
 *
 * All queries are tenant-scoped via tenantId from the session —
 * never from URL params or request body. Matches/Tournaments/Trainings
 * are excluded from all operations here.
 */

import { prisma } from "@/lib/db/prisma";

export class ClubEventNotFoundError extends Error {
  constructor() {
    super("Veranstaltung nicht gefunden.");
    this.name = "ClubEventNotFoundError";
  }
}

export class ClubEventValidationError extends Error {
  constructor(
    message: string,
    public readonly field?: string,
  ) {
    super(message);
    this.name = "ClubEventValidationError";
  }
}

export type ClubEvent = {
  id: string;
  title: string;
  description: string | null;
  location: string | null;
  startAt: Date;
  endAt: Date | null;
  organizerName: string | null;
  remarks: string | null;
  status: string;
  reviewStage: string;
  source: string;
  websiteVisible: boolean;
  infoboardVisible: boolean;
  homepageVisible: boolean;
  wochenplanVisible: boolean;
  trainingsplanVisible: boolean;
  teamPageVisible: boolean;
  tenantId: string | null;
  seasonId: string | null;
  teamId: string | null;
  createdAt: Date;
  updatedAt: Date;
  season: {
    id: string;
    key: string;
    name: string;
  } | null;
};

const CLUB_EVENT_SELECT = {
  id: true,
  title: true,
  description: true,
  location: true,
  startAt: true,
  endAt: true,
  organizerName: true,
  remarks: true,
  status: true,
  reviewStage: true,
  source: true,
  websiteVisible: true,
  infoboardVisible: true,
  homepageVisible: true,
  wochenplanVisible: true,
  trainingsplanVisible: true,
  teamPageVisible: true,
  tenantId: true,
  seasonId: true,
  teamId: true,
  createdAt: true,
  updatedAt: true,
  season: {
    select: {
      id: true,
      key: true,
      name: true,
    },
  },
} as const;

/**
 * List all type=OTHER events for the given tenant, ordered by startAt asc.
 */
export async function listClubEvents(tenantId: string): Promise<ClubEvent[]> {
  return prisma.event.findMany({
    where: {
      type: "OTHER",
      tenantId,
    },
    orderBy: [{ startAt: "asc" }, { createdAt: "desc" }],
    select: CLUB_EVENT_SELECT,
  });
}

/**
 * Get a single type=OTHER event for the given tenant, or null if not found.
 * Enforces tenant isolation.
 */
export async function getClubEvent(
  tenantId: string,
  eventId: string,
): Promise<ClubEvent | null> {
  return prisma.event.findFirst({
    where: {
      id: eventId,
      type: "OTHER",
      tenantId,
    },
    select: CLUB_EVENT_SELECT,
  });
}

export type UpdateClubEventInput = {
  title?: string;
  description?: string | null;
  location?: string | null;
  startAt?: Date;
  endAt?: Date | null;
  organizerName?: string | null;
  remarks?: string | null;
  websiteVisible?: boolean;
  infoboardVisible?: boolean;
  homepageVisible?: boolean;
  wochenplanVisible?: boolean;
  trainingsplanVisible?: boolean;
  teamPageVisible?: boolean;
};

/**
 * Update a type=OTHER event for the given tenant.
 * Throws ClubEventNotFoundError when the event does not exist or belongs to a different tenant.
 * Throws ClubEventValidationError for invalid field values.
 */
export async function updateClubEvent(
  tenantId: string,
  eventId: string,
  input: UpdateClubEventInput,
): Promise<ClubEvent> {
  const existing = await prisma.event.findFirst({
    where: { id: eventId, type: "OTHER", tenantId },
    select: { id: true, status: true, source: true },
  });

  if (!existing) {
    throw new ClubEventNotFoundError();
  }

  if (existing.status === "ARCHIVED") {
    throw new ClubEventValidationError(
      "Archivierte Veranstaltungen können nicht bearbeitet werden.",
    );
  }

  if (input.title !== undefined && !String(input.title ?? "").trim()) {
    throw new ClubEventValidationError("Titel ist erforderlich.", "title");
  }

  if (input.startAt !== undefined && Number.isNaN(input.startAt.getTime())) {
    throw new ClubEventValidationError(
      "Startdatum ist ungültig.",
      "startAt",
    );
  }

  if (
    input.endAt !== undefined &&
    input.endAt !== null &&
    Number.isNaN(input.endAt.getTime())
  ) {
    throw new ClubEventValidationError("Enddatum ist ungültig.", "endAt");
  }

  const data: Record<string, unknown> = {};

  if (input.title !== undefined) data.title = String(input.title).trim();
  if (input.description !== undefined)
    data.description =
      input.description === null
        ? null
        : String(input.description).trim() || null;
  if (input.location !== undefined)
    data.location =
      input.location === null ? null : String(input.location).trim() || null;
  if (input.startAt !== undefined) data.startAt = input.startAt;
  if (input.endAt !== undefined) data.endAt = input.endAt;
  if (input.organizerName !== undefined)
    data.organizerName =
      input.organizerName === null
        ? null
        : String(input.organizerName).trim() || null;
  if (input.remarks !== undefined)
    data.remarks =
      input.remarks === null ? null : String(input.remarks).trim() || null;
  if (input.websiteVisible !== undefined)
    data.websiteVisible = Boolean(input.websiteVisible);
  if (input.infoboardVisible !== undefined)
    data.infoboardVisible = Boolean(input.infoboardVisible);
  if (input.homepageVisible !== undefined)
    data.homepageVisible = Boolean(input.homepageVisible);
  if (input.wochenplanVisible !== undefined)
    data.wochenplanVisible = Boolean(input.wochenplanVisible);
  if (input.trainingsplanVisible !== undefined)
    data.trainingsplanVisible = Boolean(input.trainingsplanVisible);
  if (input.teamPageVisible !== undefined)
    data.teamPageVisible = Boolean(input.teamPageVisible);

  return prisma.event.update({
    where: { id: eventId },
    data,
    select: CLUB_EVENT_SELECT,
  });
}

/**
 * Archive (soft-delete) a type=OTHER event: sets status=ARCHIVED.
 * Throws ClubEventNotFoundError when the event does not exist or belongs to a different tenant.
 */
export async function archiveClubEvent(
  tenantId: string,
  eventId: string,
): Promise<ClubEvent> {
  const existing = await prisma.event.findFirst({
    where: { id: eventId, type: "OTHER", tenantId },
    select: { id: true, status: true },
  });

  if (!existing) {
    throw new ClubEventNotFoundError();
  }

  return prisma.event.update({
    where: { id: eventId },
    data: { status: "ARCHIVED" },
    select: CLUB_EVENT_SELECT,
  });
}

/**
 * Restore an archived type=OTHER event: sets status=SCHEDULED.
 * Throws ClubEventNotFoundError when the event does not exist or belongs to a different tenant.
 */
export async function restoreClubEvent(
  tenantId: string,
  eventId: string,
): Promise<ClubEvent> {
  const existing = await prisma.event.findFirst({
    where: { id: eventId, type: "OTHER", tenantId },
    select: { id: true, status: true },
  });

  if (!existing) {
    throw new ClubEventNotFoundError();
  }

  return prisma.event.update({
    where: { id: eventId },
    data: { status: "SCHEDULED" },
    select: CLUB_EVENT_SELECT,
  });
}

/**
 * Permanently delete a type=OTHER event for the given tenant.
 * Throws ClubEventNotFoundError when the event does not exist or belongs to a different tenant.
 */
export async function deleteClubEvent(
  tenantId: string,
  eventId: string,
): Promise<void> {
  const existing = await prisma.event.findFirst({
    where: { id: eventId, type: "OTHER", tenantId },
    select: { id: true },
  });

  if (!existing) {
    throw new ClubEventNotFoundError();
  }

  await prisma.event.delete({ where: { id: eventId } });
}
