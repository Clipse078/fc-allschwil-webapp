/**
 * lib/integrations/sfv/tenant-config-validation.ts
 *
 * Pure validation functions for TenantSfvConfigInput.
 *
 * All functions are stateless and pure — no I/O, no DB access, no side effects.
 * They validate structural correctness only (types, ranges, format) and never
 * check whether a clubId or seasonId exists in the SFV system.
 *
 * Validation rules:
 *   clubId         — required; positive integer (>= 1, <= 2,147,483,647).
 *   defaultSeasonId — required; positive integer (>= 1, <= 2,147,483,647).
 *   organisationId  — optional; when present, positive integer (same bounds).
 *   enabled         — required; boolean.
 *
 * Integer bounds: PostgreSQL INTEGER range (max 2,147,483,647). SFV identifiers
 * are well within this range in practice, but the upper bound is enforced to
 * prevent DB overflow errors that would otherwise surface at persistence time.
 */

import {
  type TenantSfvConfigInput,
  SfvTenantConfigValidationError,
} from "./tenant-config-types";

// PostgreSQL INTEGER max value (2^31 − 1)
const PG_INT_MAX = 2_147_483_647;

/**
 * Returns true when value is a safe positive integer within PostgreSQL INTEGER range.
 */
function isPositiveInt(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 1 &&
    value <= PG_INT_MAX
  );
}

/**
 * Validates a clubId value.
 *
 * Returns true when value is a positive integer in [1, 2_147_483_647].
 * Returns false for zero, negative, fractional, NaN, Infinity, or non-numbers.
 */
export function isValidClubId(value: unknown): value is number {
  return isPositiveInt(value);
}

/**
 * Validates a defaultSeasonId value.
 *
 * Returns true when value is a positive integer in [1, 2_147_483_647].
 * Returns false for zero, negative, fractional, NaN, Infinity, or non-numbers.
 */
export function isValidDefaultSeasonId(value: unknown): value is number {
  return isPositiveInt(value);
}

/**
 * Validates an organisationId value.
 *
 * Returns true when value is null, undefined, or a positive integer in
 * [1, 2_147_483_647]. The field is optional — callers may omit it entirely
 * or explicitly pass null.
 */
export function isValidOrganisationId(value: unknown): boolean {
  if (value === null || value === undefined) return true;
  return isPositiveInt(value);
}

/**
 * Validates a complete TenantSfvConfigInput object.
 *
 * Throws SfvTenantConfigValidationError for the first invalid field encountered.
 * Returns the validated input (same reference) when all fields are valid.
 *
 * Field order matches the type definition for predictable error ordering.
 */
export function validateTenantSfvConfigInput(
  input: TenantSfvConfigInput,
): TenantSfvConfigInput {
  if (!isValidClubId(input.clubId)) {
    throw new SfvTenantConfigValidationError(
      "clubId",
      "must be a positive integer between 1 and 2,147,483,647",
    );
  }

  if (!isValidDefaultSeasonId(input.defaultSeasonId)) {
    throw new SfvTenantConfigValidationError(
      "defaultSeasonId",
      "must be a positive integer between 1 and 2,147,483,647",
    );
  }

  if (!isValidOrganisationId(input.organisationId)) {
    throw new SfvTenantConfigValidationError(
      "organisationId",
      "must be null, undefined, or a positive integer between 1 and 2,147,483,647",
    );
  }

  if (typeof input.enabled !== "boolean") {
    throw new SfvTenantConfigValidationError(
      "enabled",
      "must be a boolean",
    );
  }

  return input;
}
