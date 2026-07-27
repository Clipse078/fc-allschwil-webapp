/**
 * lib/competitions/validators.ts
 *
 * Input validation for the Competition module.
 *
 * Pure functions — no I/O, no side effects.
 * All validators throw typed errors for invalid input.
 */

import type { CreateCompetitionInput, UpdateCompetitionInput } from "./dto";

// ── Error types ────────────────────────────────────────────────────────────────

export class CompetitionValidationError extends Error {
  constructor(
    public readonly field: string,
    message: string,
  ) {
    super(message);
    this.name = "CompetitionValidationError";
  }
}

// ── Helpers ────────────────────────────────────────────────────────────────────

const VALID_COMPETITION_TYPES = ["LEAGUE", "CUP", "TOURNAMENT_SERIES", "OTHER"] as const;
const VALID_GENDERS = ["MALE", "FEMALE", "MIXED"] as const;
const MAX_NAME_LENGTH = 255;
const MAX_SHORT_NAME_LENGTH = 50;
const MAX_GROUP_NAME_LENGTH = 100;
const MAX_AGE_CATEGORY_LENGTH = 50;
const MAX_PROVIDER_LENGTH = 50;

function assertNonEmpty(value: string, field: string): void {
  if (!value || !value.trim()) {
    throw new CompetitionValidationError(field, `${field} must not be empty.`);
  }
}

function assertMaxLength(value: string | undefined, field: string, max: number): void {
  if (value !== undefined && value.length > max) {
    throw new CompetitionValidationError(
      field,
      `${field} must not exceed ${max} characters (got ${value.length}).`,
    );
  }
}

// ── Public validators ──────────────────────────────────────────────────────────

/**
 * Validates input for creating a Competition.
 * Throws CompetitionValidationError on the first invalid field.
 */
export function validateCreateCompetitionInput(input: CreateCompetitionInput): void {
  assertNonEmpty(input.provider, "provider");
  assertMaxLength(input.provider, "provider", MAX_PROVIDER_LENGTH);

  assertNonEmpty(input.officialName, "officialName");
  assertMaxLength(input.officialName, "officialName", MAX_NAME_LENGTH);

  assertMaxLength(input.shortName, "shortName", MAX_SHORT_NAME_LENGTH);
  assertMaxLength(input.groupName, "groupName", MAX_GROUP_NAME_LENGTH);
  assertMaxLength(input.ageCategory, "ageCategory", MAX_AGE_CATEGORY_LENGTH);

  if (
    input.competitionType !== undefined &&
    !VALID_COMPETITION_TYPES.includes(input.competitionType as (typeof VALID_COMPETITION_TYPES)[number])
  ) {
    throw new CompetitionValidationError(
      "competitionType",
      `competitionType must be one of: ${VALID_COMPETITION_TYPES.join(", ")}.`,
    );
  }

  if (
    input.gender !== undefined &&
    !VALID_GENDERS.includes(input.gender as (typeof VALID_GENDERS)[number])
  ) {
    throw new CompetitionValidationError(
      "gender",
      `gender must be one of: ${VALID_GENDERS.join(", ")}.`,
    );
  }

  if (input.externalCompetitionId !== undefined && !Number.isInteger(input.externalCompetitionId)) {
    throw new CompetitionValidationError(
      "externalCompetitionId",
      "externalCompetitionId must be an integer.",
    );
  }

  if (input.externalSeasonId !== undefined && !Number.isInteger(input.externalSeasonId)) {
    throw new CompetitionValidationError(
      "externalSeasonId",
      "externalSeasonId must be an integer.",
    );
  }
}

/**
 * Validates input for updating a Competition.
 * Throws CompetitionValidationError on the first invalid field.
 */
export function validateUpdateCompetitionInput(input: UpdateCompetitionInput): void {
  if (input.officialName !== undefined) {
    assertNonEmpty(input.officialName, "officialName");
    assertMaxLength(input.officialName, "officialName", MAX_NAME_LENGTH);
  }
  assertMaxLength(input.shortName, "shortName", MAX_SHORT_NAME_LENGTH);
  assertMaxLength(input.groupName, "groupName", MAX_GROUP_NAME_LENGTH);
  assertMaxLength(input.ageCategory, "ageCategory", MAX_AGE_CATEGORY_LENGTH);

  if (
    input.competitionType !== undefined &&
    !VALID_COMPETITION_TYPES.includes(input.competitionType as (typeof VALID_COMPETITION_TYPES)[number])
  ) {
    throw new CompetitionValidationError(
      "competitionType",
      `competitionType must be one of: ${VALID_COMPETITION_TYPES.join(", ")}.`,
    );
  }

  if (
    input.gender !== undefined &&
    !VALID_GENDERS.includes(input.gender as (typeof VALID_GENDERS)[number])
  ) {
    throw new CompetitionValidationError(
      "gender",
      `gender must be one of: ${VALID_GENDERS.join(", ")}.`,
    );
  }
}
