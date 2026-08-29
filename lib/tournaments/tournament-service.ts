/**
 * lib/tournaments/tournament-service.ts
 *
 * TOURNAMENTCENTER-01 — canonical Tournament Management MVP domain service.
 *
 * A "Tournament" is NOT a new persisted entity — it is the canonical `Event`
 * model (see prisma/schema.prisma) filtered to `type: "TOURNAMENT"`. This
 * service exists to give TournamentCenter its own tenant-scoped, validated
 * CRUD surface without duplicating Event as a second model, per the
 * TOURNAMENTCENTER-01 architecture decision (reuse Event.type=TOURNAMENT).
 *
 * Creation continues to go through the existing, already-reviewed
 * POST /api/events endpoint (see components/admin/events/TournamentEventCreateForm.tsx)
 * — this service adds the genuine gaps that endpoint does not cover:
 * tenant-scoped listing/reading, editing, and cancel/restore lifecycle.
 *
 * Security invariants:
 *   - tenantId always comes from a trusted session context — never from input.
 *   - Every query/mutation is scoped to tenantId AND type: "TOURNAMENT" via
 *     lib/tournaments/queries.ts — a cross-tenant id, or an id belonging to a
 *     MATCH/TRAINING/OTHER event, is treated as not found.
 *
 * Lifecycle: a Tournament is a single (non-recurring) operational event, the
 * same shape as a Matchcenter match. Its lifecycle therefore follows the
 * TrainingSession single-occurrence convention (cancel/restore via status),
 * not the TrainingSeries archive convention (which exists for retiring a
 * recurring *template*, which a tournament never is).
 */

import { prisma } from "@/lib/db/prisma";
import {
  findTournamentEventById,
  findAllTournamentEvents,
  tournamentEventSelect,
  type TournamentEventRow,
} from "./queries";
import {
  resolveTournamentOrganizerIdentity,
  resolveTournamentParticipantLogoUrl,
  type ResolvedOrganizerClub,
} from "./club-identity";
import { resolveOrganizerClubsByName } from "./organizer-club-resolver";
import {
  TournamentNotFoundError,
  TournamentValidationError,
  TournamentInvalidTransitionError,
} from "./errors";
import type {
  TournamentDto,
  TournamentParticipantDto,
  TournamentResourceAllocationDto,
  TournamentHomeAway,
  ListTournamentsFilter,
  UpdateTournamentInput,
} from "./types";

// ── Mapping ───────────────────────────────────────────────────────────────────

/**
 * Mirrors lib/matchcenter/operational-state.ts's normalizedHomeAway(): only
 * an exact "HOME"/"AWAY" (case-insensitive) is recognised; anything else
 * (including null/unset, which is the default for a freshly created
 * tournament) is treated as HOME — a tournament is assumed FCA-hosted
 * until explicitly marked otherwise.
 */
function normalizeHomeAway(value: string | null): TournamentHomeAway {
  return value?.trim().toUpperCase() === "AWAY" ? "AWAY" : "HOME";
}

function toParticipantDto(
  row: TournamentEventRow["tournamentParticipants"][number],
  tenantLogoUrl: string | null,
): TournamentParticipantDto {
  const logoUrl = resolveTournamentParticipantLogoUrl(row, tenantLogoUrl);
  const dressingRoomAllocations = row.dressingRoomAllocations.map((allocation) => ({
    id: allocation.id,
    facilityResourceId: allocation.facilityResource.id,
    facilityResourceCode: allocation.facilityResource.code,
    facilityResourceName: allocation.facilityResource.name,
    facilityResourceType: allocation.facilityResource.type,
    facilityId: allocation.facilityResource.facilityId,
    facilityName: allocation.facilityResource.facility.name,
    notes: allocation.notes,
    displayOrder: allocation.displayOrder,
  }));

  if (row.team) {
    return {
      id: row.id,
      tournamentId: row.eventId,
      kind: "TEAM",
      displayName: row.team.name,
      logoUrl,
      team: row.team,
      externalTeam: null,
      externalClub: null,
      manualLabel: null,
      displayOrder: row.displayOrder,
      dressingRoomAllocations,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  // TOURNAMENTCENTER-UX-03 — canonical NEW external-participant kind.
  if (row.externalClub) {
    const rawDisplayName = row.displayName?.trim() || null;
    return {
      id: row.id,
      tournamentId: row.eventId,
      kind: "EXTERNAL_CLUB",
      displayName: rawDisplayName ?? row.externalClub.name,
      logoUrl,
      team: null,
      externalTeam: null,
      externalClub: {
        club: {
          id: row.externalClub.id,
          name: row.externalClub.name,
          shortName: row.externalClub.shortName,
          logoUrl: row.externalClub.logoUrl,
        },
        rawDisplayName,
      },
      manualLabel: null,
      displayOrder: row.displayOrder,
      dressingRoomAllocations,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  // HISTORICAL ONLY — rows created before TOURNAMENTCENTER-UX-03.
  if (row.externalTeam) {
    return {
      id: row.id,
      tournamentId: row.eventId,
      kind: "EXTERNAL_TEAM",
      displayName: row.externalTeam.name,
      logoUrl,
      team: null,
      externalTeam: {
        id: row.externalTeam.id,
        name: row.externalTeam.name,
        shortName: row.externalTeam.shortName,
        categoryLabel: row.externalTeam.categoryLabel,
        club: {
          id: row.externalTeam.externalClub.id,
          name: row.externalTeam.externalClub.name,
          shortName: row.externalTeam.externalClub.shortName,
          logoUrl: row.externalTeam.externalClub.logoUrl,
        },
      },
      externalClub: null,
      manualLabel: null,
      displayOrder: row.displayOrder,
      dressingRoomAllocations,
      createdAt: row.createdAt.toISOString(),
      updatedAt: row.updatedAt.toISOString(),
    };
  }

  return {
    id: row.id,
    tournamentId: row.eventId,
    kind: "MANUAL",
    displayName: row.manualLabel ?? "Unbenannt",
    logoUrl: null,
    team: null,
    externalTeam: null,
    externalClub: null,
    manualLabel: row.manualLabel,
    displayOrder: row.displayOrder,
    dressingRoomAllocations,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

function toResourceAllocationDto(
  row: TournamentEventRow["tournamentResourceAllocations"][number],
): TournamentResourceAllocationDto {
  return {
    id: row.id,
    facilityResourceId: row.facilityResource.id,
    facilityResourceCode: row.facilityResource.code,
    facilityResourceName: row.facilityResource.name,
    facilityResourceType: row.facilityResource.type,
    facilityId: row.facilityResource.facilityId,
    facilityName: row.facilityResource.facility.name,
    notes: row.notes,
    displayOrder: row.displayOrder,
  };
}

type TournamentTenantContext = {
  name: string;
  logoUrl: string | null;
};

async function loadTournamentTenantContext(
  tenantId: string,
): Promise<TournamentTenantContext> {
  const tenant = await prisma.tenant.findFirst({
    where: { id: tenantId },
    select: { name: true, logoUrl: true },
  });
  return {
    name: tenant?.name ?? "",
    logoUrl: tenant?.logoUrl ?? null,
  };
}

function toDto(
  row: TournamentEventRow,
  tenantContext: TournamentTenantContext,
  organizerClub: ResolvedOrganizerClub | null,
): TournamentDto {
  if (row.tenantId === null) {
    throw new Error(`Tournament event ${row.id} has no tenantId.`);
  }

  const homeAway = normalizeHomeAway(row.homeAway);
  const organizerIdentity = resolveTournamentOrganizerIdentity({
    organizerName: row.organizerName,
    homeAway,
    tenantName: tenantContext.name,
    tenantLogoUrl: tenantContext.logoUrl,
    resolvedOrganizerClub: organizerClub,
  });

  return {
    id: row.id,
    tenantId: row.tenantId,
    title: row.title,
    description: row.description,
    status: row.status as TournamentDto["status"],
    source: row.source,
    startAt: row.startAt.toISOString(),
    endAt: row.endAt ? row.endAt.toISOString() : null,
    meetingTime: row.meetingTime ? row.meetingTime.toISOString() : null,
    location: row.location,
    organizerName: row.organizerName,
    organizerLogoUrl: organizerIdentity.logoUrl,
    organizerExternalClubId: organizerIdentity.externalClubId,
    competitionLabel: row.competitionLabel,
    resultLabel: row.resultLabel,
    remarks: row.remarks,
    season: row.season,
    team: row.team,
    teamLogoUrl: row.team ? tenantContext.logoUrl?.trim() || null : null,
    homeAway,
    participants: row.tournamentParticipants.map((participant) =>
      toParticipantDto(participant, tenantContext.logoUrl),
    ),
    resourceAllocations: row.tournamentResourceAllocations.map(toResourceAllocationDto),
    visibility: {
      websiteVisible: row.websiteVisible,
      infoboardVisible: row.infoboardVisible,
      homepageVisible: row.homepageVisible,
      wochenplanVisible: row.wochenplanVisible,
      teamPageVisible: row.teamPageVisible,
    },
    reviewStage: row.reviewStage,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

// ── Validation ────────────────────────────────────────────────────────────────

function validateUpdateInput(input: UpdateTournamentInput): void {
  if (input.title !== undefined && !input.title.trim()) {
    throw new TournamentValidationError("title must not be empty");
  }

  if (input.startAt !== undefined && Number.isNaN(input.startAt.getTime())) {
    throw new TournamentValidationError("startAt is invalid");
  }

  if (input.endAt !== undefined && input.endAt !== null && Number.isNaN(input.endAt.getTime())) {
    throw new TournamentValidationError("endAt is invalid");
  }

  if (
    input.meetingTime !== undefined &&
    input.meetingTime !== null &&
    Number.isNaN(input.meetingTime.getTime())
  ) {
    throw new TournamentValidationError("meetingTime is invalid");
  }

  if (input.startAt !== undefined && input.endAt !== undefined && input.endAt !== null) {
    if (input.endAt.getTime() < input.startAt.getTime()) {
      throw new TournamentValidationError("endAt must not be before startAt");
    }
  }

  if (
    input.startAt !== undefined &&
    input.meetingTime !== undefined &&
    input.meetingTime !== null
  ) {
    if (input.meetingTime.getTime() > input.startAt.getTime()) {
      throw new TournamentValidationError("meetingTime must not be after startAt");
    }
  }

  if (
    input.homeAway !== undefined &&
    input.homeAway !== "HOME" &&
    input.homeAway !== "AWAY"
  ) {
    throw new TournamentValidationError('homeAway must be "HOME" or "AWAY"');
  }
}

// ── Public service API ────────────────────────────────────────────────────────

/**
 * Lists Tournaments (Event rows with type=TOURNAMENT) for a tenant.
 * Defaults to all statuses; pass `filter.status` to narrow.
 */
export async function listTournaments(
  tenantId: string,
  filter: ListTournamentsFilter = {},
): Promise<TournamentDto[]> {
  const [rows, tenantContext] = await Promise.all([
    findAllTournamentEvents(tenantId, { status: filter.status }),
    loadTournamentTenantContext(tenantId),
  ]);

  const organizerClubs = await resolveOrganizerClubsByName(
    tenantId,
    rows.map((row) => row.organizerName ?? ""),
  );

  return rows.map((row) =>
    toDto(
      row,
      tenantContext,
      row.organizerName?.trim()
        ? organizerClubs.get(row.organizerName.trim()) ?? null
        : null,
    ),
  );
}

/**
 * Lists tournaments by event ids for public feed enrichment.
 * Returns only tournaments matching the supplied ids (tenant-scoped).
 */
export async function listTournamentsByIds(
  tenantId: string,
  tournamentIds: readonly string[],
): Promise<TournamentDto[]> {
  if (tournamentIds.length === 0) return [];

  const [rows, tenantContext] = await Promise.all([
    prisma.event.findMany({
      where: {
        tenantId,
        type: "TOURNAMENT",
        id: { in: [...tournamentIds] },
      },
      orderBy: [{ startAt: "asc" }, { id: "asc" }],
      select: tournamentEventSelect,
    }),
    loadTournamentTenantContext(tenantId),
  ]);

  const organizerClubs = await resolveOrganizerClubsByName(
    tenantId,
    rows.map((row) => row.organizerName ?? ""),
  );

  return rows.map((row) =>
    toDto(
      row,
      tenantContext,
      row.organizerName?.trim()
        ? organizerClubs.get(row.organizerName.trim()) ?? null
        : null,
    ),
  );
}

/**
 * Retrieves a single Tournament by id.
 *
 * @throws {TournamentNotFoundError} Not found, cross-tenant, or not a TOURNAMENT event.
 */
export async function getTournament(tenantId: string, tournamentId: string): Promise<TournamentDto> {
  const [row, tenantContext] = await Promise.all([
    findTournamentEventById(tenantId, tournamentId),
    loadTournamentTenantContext(tenantId),
  ]);
  if (!row) {
    throw new TournamentNotFoundError(tournamentId);
  }

  const organizerClubs = await resolveOrganizerClubsByName(
    tenantId,
    row.organizerName?.trim() ? [row.organizerName.trim()] : [],
  );

  return toDto(
    row,
    tenantContext,
    row.organizerName?.trim()
      ? organizerClubs.get(row.organizerName.trim()) ?? null
      : null,
  );
}

/**
 * Updates the locally-managed operational and core fields of a Tournament.
 *
 * Only ever mutates the fields present in `input` (partial update).
 * Does not touch reviewStage/review workflow fields — mirrors the
 * Matchcenter PATCH convention for post-creation operational edits.
 *
 * @throws {TournamentValidationError}   Input validation failed.
 * @throws {TournamentNotFoundError}     Not found or cross-tenant.
 */
export async function updateTournament(
  tenantId: string,
  tournamentId: string,
  input: UpdateTournamentInput,
): Promise<TournamentDto> {
  validateUpdateInput(input);

  const existing = await findTournamentEventById(tenantId, tournamentId);
  if (!existing) {
    throw new TournamentNotFoundError(tournamentId);
  }

  if (input.teamId !== undefined && input.teamId !== null) {
    const team = await prisma.team.findFirst({
      where: { id: input.teamId, tenantId },
      select: { id: true },
    });
    if (!team) {
      throw new TournamentValidationError("teamId does not belong to this tenant");
    }
  }

  const data: Record<string, unknown> = {};

  if (input.title !== undefined) data.title = input.title.trim();
  if (input.description !== undefined) data.description = input.description?.trim() || null;
  if (input.location !== undefined) data.location = input.location?.trim() || null;
  if (input.startAt !== undefined) data.startAt = input.startAt;
  if (input.endAt !== undefined) data.endAt = input.endAt;
  if (input.meetingTime !== undefined) data.meetingTime = input.meetingTime;
  if (input.organizerName !== undefined) data.organizerName = input.organizerName?.trim() || null;
  if (input.competitionLabel !== undefined) data.competitionLabel = input.competitionLabel?.trim() || null;
  if (input.resultLabel !== undefined) data.resultLabel = input.resultLabel?.trim() || null;
  if (input.remarks !== undefined) data.remarks = input.remarks?.trim() || null;
  if (input.teamId !== undefined) data.teamId = input.teamId;
  if (input.homeAway !== undefined) data.homeAway = input.homeAway;
  if (input.websiteVisible !== undefined) data.websiteVisible = input.websiteVisible;
  if (input.infoboardVisible !== undefined) data.infoboardVisible = input.infoboardVisible;
  if (input.homepageVisible !== undefined) data.homepageVisible = input.homepageVisible;
  if (input.wochenplanVisible !== undefined) data.wochenplanVisible = input.wochenplanVisible;
  if (input.teamPageVisible !== undefined) data.teamPageVisible = input.teamPageVisible;

  if (Object.keys(data).length === 0) {
    const tenantContext = await loadTournamentTenantContext(tenantId);
    const organizerClubs = await resolveOrganizerClubsByName(
      tenantId,
      existing.organizerName?.trim() ? [existing.organizerName.trim()] : [],
    );
    return toDto(
      existing,
      tenantContext,
      existing.organizerName?.trim()
        ? organizerClubs.get(existing.organizerName.trim()) ?? null
        : null,
    );
  }

  await prisma.event.update({ where: { id: tournamentId }, data });
  return getTournament(tenantId, tournamentId);
}

/**
 * Cancels a Tournament (status -> CANCELLED). Idempotent when already
 * CANCELLED. Cancelling automatically removes it from all public feeds
 * (getPublicEvents only ever selects SCHEDULED/LIVE/COMPLETED/POSTPONED) —
 * no separate visibility flag needs to be toggled.
 *
 * @throws {TournamentNotFoundError} Not found or cross-tenant.
 * @throws {TournamentInvalidTransitionError} Not currently in a cancellable state.
 */
export async function cancelTournament(tenantId: string, tournamentId: string): Promise<TournamentDto> {
  const existing = await findTournamentEventById(tenantId, tournamentId);
  if (!existing) {
    throw new TournamentNotFoundError(tournamentId);
  }

  if (existing.status === "CANCELLED") {
    return getTournament(tenantId, tournamentId);
  }

  if (existing.status === "ARCHIVED" || existing.status === "COMPLETED") {
    throw new TournamentInvalidTransitionError(
      `Cannot cancel a Tournament with status "${existing.status}"`,
    );
  }

  await prisma.event.update({ where: { id: tournamentId }, data: { status: "CANCELLED" } });
  return getTournament(tenantId, tournamentId);
}

/**
 * Restores a previously-CANCELLED Tournament back to SCHEDULED. Idempotent
 * when already SCHEDULED.
 *
 * @throws {TournamentNotFoundError} Not found or cross-tenant.
 * @throws {TournamentInvalidTransitionError} Not currently CANCELLED.
 */
export async function restoreTournament(tenantId: string, tournamentId: string): Promise<TournamentDto> {
  const existing = await findTournamentEventById(tenantId, tournamentId);
  if (!existing) {
    throw new TournamentNotFoundError(tournamentId);
  }

  if (existing.status === "SCHEDULED") {
    return getTournament(tenantId, tournamentId);
  }

  if (existing.status !== "CANCELLED") {
    throw new TournamentInvalidTransitionError(
      `Cannot restore a Tournament with status "${existing.status}"`,
    );
  }

  await prisma.event.update({ where: { id: tournamentId }, data: { status: "SCHEDULED" } });
  return getTournament(tenantId, tournamentId);
}
