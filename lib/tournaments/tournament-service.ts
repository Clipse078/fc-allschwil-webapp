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
  type TournamentEventRow,
} from "./queries";
import {
  TournamentNotFoundError,
  TournamentValidationError,
  TournamentInvalidTransitionError,
} from "./errors";
import type {
  TournamentDto,
  ListTournamentsFilter,
  UpdateTournamentInput,
} from "./types";

// ── Mapping ───────────────────────────────────────────────────────────────────

function toDto(row: TournamentEventRow): TournamentDto {
  if (row.tenantId === null) {
    throw new Error(`Tournament event ${row.id} has no tenantId.`);
  }

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
    competitionLabel: row.competitionLabel,
    resultLabel: row.resultLabel,
    remarks: row.remarks,
    season: row.season,
    team: row.team,
    visibility: {
      websiteVisible: row.websiteVisible,
      infoboardVisible: row.infoboardVisible,
      homepageVisible: row.homepageVisible,
      wochenplanVisible: row.wochenplanVisible,
      teamPageVisible: row.teamPageVisible,
    },
    allocation: {
      pitchCode: row.pitchCode,
      homeDressingRoomCode: row.homeDressingRoomCode,
      awayDressingRoomCode: row.awayDressingRoomCode,
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
  const rows = await findAllTournamentEvents(tenantId, { status: filter.status });
  return rows.map(toDto);
}

/**
 * Retrieves a single Tournament by id.
 *
 * @throws {TournamentNotFoundError} Not found, cross-tenant, or not a TOURNAMENT event.
 */
export async function getTournament(tenantId: string, tournamentId: string): Promise<TournamentDto> {
  const row = await findTournamentEventById(tenantId, tournamentId);
  if (!row) {
    throw new TournamentNotFoundError(tournamentId);
  }
  return toDto(row);
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
  if (input.websiteVisible !== undefined) data.websiteVisible = input.websiteVisible;
  if (input.infoboardVisible !== undefined) data.infoboardVisible = input.infoboardVisible;
  if (input.homepageVisible !== undefined) data.homepageVisible = input.homepageVisible;
  if (input.wochenplanVisible !== undefined) data.wochenplanVisible = input.wochenplanVisible;
  if (input.teamPageVisible !== undefined) data.teamPageVisible = input.teamPageVisible;
  if (input.pitchCode !== undefined) data.pitchCode = input.pitchCode?.trim() || null;
  if (input.homeDressingRoomCode !== undefined) {
    data.homeDressingRoomCode = input.homeDressingRoomCode?.trim() || null;
  }
  if (input.awayDressingRoomCode !== undefined) {
    data.awayDressingRoomCode = input.awayDressingRoomCode?.trim() || null;
  }

  if (Object.keys(data).length === 0) {
    return toDto(existing);
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
    return toDto(existing);
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
    return toDto(existing);
  }

  if (existing.status !== "CANCELLED") {
    throw new TournamentInvalidTransitionError(
      `Cannot restore a Tournament with status "${existing.status}"`,
    );
  }

  await prisma.event.update({ where: { id: tournamentId }, data: { status: "SCHEDULED" } });
  return getTournament(tenantId, tournamentId);
}
