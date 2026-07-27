/**
 * lib/training/training-service.ts
 *
 * Domain service for the canonical Training Foundation (TRAINING-CORE-01).
 *
 * Manages the lifecycle of TrainingSeries — the canonical recurring training
 * identities for every SportClubEvo TeamSeason.
 *
 * Architecture:
 *   Organisation → Team → TeamSeason → TrainingSeries
 *
 * Canonical principles:
 *   - A TrainingSeries is ONE recurring training identity (e.g. "E1 Tuesday Training").
 *   - It is NEVER duplicated for different weekplans, pitches, or dressing rooms.
 *   - Every series belongs to exactly one TeamSeason.
 *   - No resource allocation, weekplans, or publishing at this layer.
 *
 * Security invariants:
 *   - tenantId always comes from a trusted session context — never from input.
 *   - All DB queries are scoped to tenantId via the TeamSeason → Team join.
 *   - Tenant A cannot read or modify Tenant B's training series.
 *
 * Validation invariants:
 *   - TeamSeason must exist and belong to the tenant.
 *   - Team must be active (not archived).
 *   - title is unique within a TeamSeason.
 *   - startsAt must precede endsAt.
 *   - At least one weekday must be provided.
 */

import { prisma } from "@/lib/db/prisma";
import type {
  TrainingSeriesDto,
  CreateTrainingSeriesInput,
  UpdateTrainingSeriesInput,
  ListTrainingSeriesFilter,
  Weekday,
} from "./types";
import {
  TrainingSeriesNotFoundError,
  TrainingSeriesConflictError,
  TrainingSeriesValidationError,
  TrainingSeriesTeamSeasonNotFoundError,
  TrainingSeriesArchivedTeamError,
} from "./errors";
import {
  findTrainingSeriesById,
  findAllTrainingSeries,
  findTeamSeasonForTenant,
  type TrainingSeriesRow,
} from "./queries";

// ── Helpers ───────────────────────────────────────────────────────────────────

/** Converts a DB row to the public DTO shape. */
function toDto(row: TrainingSeriesRow): TrainingSeriesDto {
  return {
    id: row.id,
    tenantId: row.tenantId,
    teamSeasonId: row.teamSeasonId,
    title: row.title,
    description: row.description,
    status: row.status,
    startsAt: row.startsAt,
    endsAt: row.endsAt,
    timezone: row.timezone,
    weekdays: row.recurrenceDays.map((d) => d.weekday as Weekday),
    validFrom: row.validFrom?.toISOString() ?? null,
    validUntil: row.validUntil?.toISOString() ?? null,
    archivedAt: row.archivedAt?.toISOString() ?? null,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

/**
 * Validates an IANA timezone identifier using the Intl API.
 *
 * Uses Intl.DateTimeFormat to attempt construction with the given timezone.
 * Invalid identifiers throw a RangeError, which we catch and convert to a
 * typed validation error.
 */
function validateTimezone(timezone: string): void {
  try {
    Intl.DateTimeFormat(undefined, { timeZone: timezone });
  } catch {
    throw new TrainingSeriesValidationError(
      `timezone must be a valid IANA timezone identifier, got: "${timezone}"`,
    );
  }
}

/**
 * Validates time-of-day strings ("HH:mm") and their relative order.
 *
 * Converts to minutes-since-midnight for comparison, which handles the full
 * 00:00–23:59 range without Date parsing edge cases.
 */
function parseTimeMinutes(time: string): number {
  const match = /^(\d{2}):(\d{2})$/.exec(time);
  if (!match) return NaN;
  const h = parseInt(match[1], 10);
  const m = parseInt(match[2], 10);
  if (h > 23 || m > 59) return NaN;
  return h * 60 + m;
}

function validateTimes(startsAt: string, endsAt: string): void {
  const start = parseTimeMinutes(startsAt);
  const end = parseTimeMinutes(endsAt);
  if (isNaN(start)) {
    throw new TrainingSeriesValidationError(
      `startsAt must be a valid time string "HH:mm", got: "${startsAt}"`,
    );
  }
  if (isNaN(end)) {
    throw new TrainingSeriesValidationError(
      `endsAt must be a valid time string "HH:mm", got: "${endsAt}"`,
    );
  }
  if (start >= end) {
    throw new TrainingSeriesValidationError(
      `startsAt ("${startsAt}") must be before endsAt ("${endsAt}")`,
    );
  }
}

/** Validates and normalises the create input. */
function validateCreateInput(input: CreateTrainingSeriesInput): void {
  if (!input.title?.trim()) {
    throw new TrainingSeriesValidationError("title is required and must not be empty");
  }
  if (!input.teamSeasonId?.trim()) {
    throw new TrainingSeriesValidationError("teamSeasonId is required");
  }
  if (!input.weekdays || input.weekdays.length === 0) {
    throw new TrainingSeriesValidationError("at least one weekday is required for recurrence");
  }
  validateTimes(input.startsAt, input.endsAt);
  if (input.timezone !== undefined && input.timezone.trim()) {
    validateTimezone(input.timezone.trim());
  }
  if (input.validFrom != null && input.validUntil != null) {
    if (input.validFrom >= input.validUntil) {
      throw new TrainingSeriesValidationError("validFrom must be before validUntil");
    }
  }
}

/** Validates the update input (only validates fields that are present). */
function validateUpdateInput(input: UpdateTrainingSeriesInput): void {
  if (input.title !== undefined && !input.title.trim()) {
    throw new TrainingSeriesValidationError("title must not be empty");
  }
  if (input.weekdays !== undefined && input.weekdays.length === 0) {
    throw new TrainingSeriesValidationError("weekdays must not be empty when provided");
  }
  if (input.startsAt !== undefined || input.endsAt !== undefined) {
    if (input.startsAt !== undefined && input.endsAt !== undefined) {
      validateTimes(input.startsAt, input.endsAt);
    } else if (input.startsAt !== undefined) {
      const start = parseTimeMinutes(input.startsAt);
      if (isNaN(start)) {
        throw new TrainingSeriesValidationError(
          `startsAt must be a valid time string "HH:mm", got: "${input.startsAt}"`,
        );
      }
    } else if (input.endsAt !== undefined) {
      const end = parseTimeMinutes(input.endsAt);
      if (isNaN(end)) {
        throw new TrainingSeriesValidationError(
          `endsAt must be a valid time string "HH:mm", got: "${input.endsAt}"`,
        );
      }
    }
  }
  if (input.timezone !== undefined) {
    validateTimezone(input.timezone);
  }
  if (input.validFrom != null && input.validUntil != null) {
    if (input.validFrom >= input.validUntil) {
      throw new TrainingSeriesValidationError("validFrom must be before validUntil");
    }
  }
}

// ── Tenant/Team validation ────────────────────────────────────────────────────

/**
 * Resolves and validates a TeamSeason for the given tenant.
 *
 * @throws {TrainingSeriesTeamSeasonNotFoundError} When TeamSeason not found or cross-tenant.
 * @throws {TrainingSeriesArchivedTeamError} When the team is inactive (archived).
 */
async function requireActiveTeamSeason(
  tenantId: string,
  teamSeasonId: string,
): Promise<void> {
  const teamSeason = await findTeamSeasonForTenant(tenantId, teamSeasonId);
  if (!teamSeason) {
    throw new TrainingSeriesTeamSeasonNotFoundError(teamSeasonId);
  }
  if (!teamSeason.team.isActive) {
    throw new TrainingSeriesArchivedTeamError(teamSeason.team.id);
  }
}

// ── Public service API ────────────────────────────────────────────────────────

/**
 * Creates a new TrainingSeries for the given tenant and TeamSeason.
 *
 * @throws {TrainingSeriesValidationError}              Input validation failed.
 * @throws {TrainingSeriesTeamSeasonNotFoundError}      TeamSeason not found or cross-tenant.
 * @throws {TrainingSeriesArchivedTeamError}            Team is archived.
 * @throws {TrainingSeriesConflictError}                Duplicate title within the same TeamSeason.
 */
export async function createTrainingSeries(
  tenantId: string,
  input: CreateTrainingSeriesInput,
): Promise<TrainingSeriesDto> {
  validateCreateInput(input);
  await requireActiveTeamSeason(tenantId, input.teamSeasonId);

  const uniqueWeekdays = [...new Set(input.weekdays)];

  try {
    const row = await prisma.trainingSeries.create({
      data: {
        tenantId,
        teamSeasonId: input.teamSeasonId,
        title: input.title.trim(),
        description: input.description?.trim() ?? null,
        status: "ACTIVE",
        startsAt: input.startsAt,
        endsAt: input.endsAt,
        timezone: input.timezone?.trim() || "UTC",
        validFrom: input.validFrom ?? null,
        validUntil: input.validUntil ?? null,
        archivedAt: null,
        recurrenceDays: {
          create: uniqueWeekdays.map((weekday) => ({ weekday })),
        },
      },
      include: {
        recurrenceDays: {
          select: { weekday: true },
          orderBy: { weekday: "asc" },
        },
      },
    });

    return toDto(row as TrainingSeriesRow);
  } catch (err) {
    if (
      err instanceof Error &&
      err.message.includes("Unique constraint") &&
      err.message.includes("TrainingSeries")
    ) {
      throw new TrainingSeriesConflictError(
        `A TrainingSeries with title "${input.title}" already exists for this TeamSeason.`,
      );
    }
    throw err;
  }
}

/**
 * Updates mutable fields of an existing TrainingSeries.
 *
 * When `weekdays` is provided, the recurrence days are fully replaced.
 *
 * @throws {TrainingSeriesValidationError}   Input validation failed.
 * @throws {TrainingSeriesNotFoundError}     Series not found or cross-tenant.
 * @throws {TrainingSeriesConflictError}     New title conflicts with an existing series.
 */
export async function updateTrainingSeries(
  tenantId: string,
  seriesId: string,
  input: UpdateTrainingSeriesInput,
): Promise<TrainingSeriesDto> {
  validateUpdateInput(input);

  const existing = await findTrainingSeriesById(tenantId, seriesId);
  if (!existing) {
    throw new TrainingSeriesNotFoundError(seriesId);
  }

  try {
    const row = await prisma.trainingSeries.update({
      where: { id: seriesId },
      data: {
        ...(input.title !== undefined ? { title: input.title.trim() } : {}),
        ...(input.description !== undefined
          ? { description: input.description?.trim() ?? null }
          : {}),
        ...(input.startsAt !== undefined ? { startsAt: input.startsAt } : {}),
        ...(input.endsAt !== undefined ? { endsAt: input.endsAt } : {}),
        ...(input.timezone !== undefined ? { timezone: input.timezone.trim() } : {}),
        ...(input.validFrom !== undefined ? { validFrom: input.validFrom ?? null } : {}),
        ...(input.validUntil !== undefined ? { validUntil: input.validUntil ?? null } : {}),
        ...(input.status !== undefined ? { status: input.status } : {}),
        ...(input.weekdays !== undefined
          ? {
              recurrenceDays: {
                deleteMany: {},
                create: [...new Set(input.weekdays)].map((weekday) => ({ weekday })),
              },
            }
          : {}),
      },
      include: {
        recurrenceDays: {
          select: { weekday: true },
          orderBy: { weekday: "asc" },
        },
      },
    });

    return toDto(row as TrainingSeriesRow);
  } catch (err) {
    if (
      err instanceof Error &&
      err.message.includes("Unique constraint") &&
      err.message.includes("TrainingSeries")
    ) {
      throw new TrainingSeriesConflictError(
        `A TrainingSeries with title "${input.title}" already exists for this TeamSeason.`,
      );
    }
    throw err;
  }
}

/**
 * Archives a TrainingSeries.
 *
 * Sets status = ARCHIVED and archivedAt = now(). The series remains in the DB
 * for historical reference. Use restoreTrainingSeries() to reactivate it.
 *
 * Archiving an already-archived series is idempotent.
 *
 * @throws {TrainingSeriesNotFoundError} Series not found or cross-tenant.
 */
export async function archiveTrainingSeries(
  tenantId: string,
  seriesId: string,
): Promise<TrainingSeriesDto> {
  const existing = await findTrainingSeriesById(tenantId, seriesId);
  if (!existing) {
    throw new TrainingSeriesNotFoundError(seriesId);
  }

  const row = await prisma.trainingSeries.update({
    where: { id: seriesId },
    data: {
      status: "ARCHIVED",
      archivedAt: existing.archivedAt ?? new Date(),
    },
    include: {
      recurrenceDays: {
        select: { weekday: true },
        orderBy: { weekday: "asc" },
      },
    },
  });

  return toDto(row as TrainingSeriesRow);
}

/**
 * Restores an archived TrainingSeries to INACTIVE status.
 *
 * Clears archivedAt. The caller may subsequently activate it via
 * updateTrainingSeries() with status = ACTIVE.
 *
 * @throws {TrainingSeriesNotFoundError} Series not found or cross-tenant.
 */
export async function restoreTrainingSeries(
  tenantId: string,
  seriesId: string,
): Promise<TrainingSeriesDto> {
  const existing = await findTrainingSeriesById(tenantId, seriesId);
  if (!existing) {
    throw new TrainingSeriesNotFoundError(seriesId);
  }

  const row = await prisma.trainingSeries.update({
    where: { id: seriesId },
    data: {
      status: "INACTIVE",
      archivedAt: null,
    },
    include: {
      recurrenceDays: {
        select: { weekday: true },
        orderBy: { weekday: "asc" },
      },
    },
  });

  return toDto(row as TrainingSeriesRow);
}

/**
 * Lists TrainingSeries for a tenant with optional filters.
 *
 * Archived series are excluded by default. Set includeArchived = true to
 * include them.
 */
export async function listTrainingSeries(
  tenantId: string,
  filter: ListTrainingSeriesFilter = {},
): Promise<TrainingSeriesDto[]> {
  const rows = await findAllTrainingSeries(tenantId, {
    teamSeasonId: filter.teamSeasonId,
    status: filter.status,
    includeArchived: filter.includeArchived,
  });
  return rows.map(toDto);
}

/**
 * Retrieves a single TrainingSeries by id.
 *
 * @throws {TrainingSeriesNotFoundError} Series not found or cross-tenant.
 */
export async function getTrainingSeries(
  tenantId: string,
  seriesId: string,
): Promise<TrainingSeriesDto> {
  const row = await findTrainingSeriesById(tenantId, seriesId);
  if (!row) {
    throw new TrainingSeriesNotFoundError(seriesId);
  }
  return toDto(row);
}
