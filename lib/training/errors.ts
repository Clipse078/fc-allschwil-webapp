/**
 * lib/training/errors.ts
 *
 * Domain error types for the Training module.
 *
 * Typed errors allow callers to distinguish failure modes without
 * parsing error messages.
 */

// ── TRAINING-CORE-01 errors ───────────────────────────────────────────────────

export class TrainingSeriesNotFoundError extends Error {
  constructor(seriesId: string) {
    super(`TrainingSeries not found: ${seriesId}`);
    this.name = "TrainingSeriesNotFoundError";
  }
}

export class TrainingSeriesConflictError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TrainingSeriesConflictError";
  }
}

export class TrainingSeriesValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TrainingSeriesValidationError";
  }
}

export class TrainingSeriesTeamSeasonNotFoundError extends Error {
  constructor(teamSeasonId: string) {
    super(`TeamSeason not found or does not belong to this tenant: ${teamSeasonId}`);
    this.name = "TrainingSeriesTeamSeasonNotFoundError";
  }
}

export class TrainingSeriesArchivedTeamError extends Error {
  constructor(teamId: string) {
    super(`Cannot create a TrainingSeries for an archived team: ${teamId}`);
    this.name = "TrainingSeriesArchivedTeamError";
  }
}

// ── TRAINING-PLANS-01 errors ──────────────────────────────────────────────────
//
// Error code key: name property matches the error class name.
// Callers use instanceof checks for type-safe error handling.

/** The requested TrainingPlan was not found (or belongs to another tenant). */
export class TrainingPlanNotFoundError extends Error {
  readonly code = "TRAINING_PLAN_NOT_FOUND" as const;
  constructor(planId: string) {
    super(`TrainingPlan not found: ${planId}`);
    this.name = "TrainingPlanNotFoundError";
  }
}

/** A plan with the same name already exists in this tenant+season scope. */
export class TrainingPlanNameConflictError extends Error {
  readonly code = "TRAINING_PLAN_NAME_CONFLICT" as const;
  constructor(name: string) {
    super(`A non-archived TrainingPlan named "${name}" already exists in this tenant and season`);
    this.name = "TrainingPlanNameConflictError";
  }
}

/** An attempt was made to create a second default plan in the same tenant+season. */
export class TrainingPlanDefaultConflictError extends Error {
  readonly code = "TRAINING_PLAN_DEFAULT_CONFLICT" as const;
  constructor() {
    super("A non-archived default TrainingPlan already exists for this tenant and season");
    this.name = "TrainingPlanDefaultConflictError";
  }
}

/** Archiving the current default plan is forbidden until another plan is made default. */
export class TrainingPlanDefaultArchiveForbiddenError extends Error {
  readonly code = "TRAINING_PLAN_DEFAULT_ARCHIVE_FORBIDDEN" as const;
  constructor() {
    super(
      "Cannot archive the current default TrainingPlan. Assign a new default plan first.",
    );
    this.name = "TrainingPlanDefaultArchiveForbiddenError";
  }
}

/** The plan belongs to a different tenant. */
export class TrainingPlanTenantMismatchError extends Error {
  readonly code = "TRAINING_PLAN_TENANT_MISMATCH" as const;
  constructor() {
    super("TrainingPlan does not belong to the given tenant");
    this.name = "TrainingPlanTenantMismatchError";
  }
}

/** The plan belongs to a different season than expected. */
export class TrainingPlanSeasonMismatchError extends Error {
  readonly code = "TRAINING_PLAN_SEASON_MISMATCH" as const;
  constructor(message?: string) {
    super(message ?? "TrainingPlan season does not match the expected season");
    this.name = "TrainingPlanSeasonMismatchError";
  }
}

/** The supplied reorder ID list is invalid (duplicates, foreign IDs, etc.). */
export class TrainingPlanInvalidOrderError extends Error {
  readonly code = "TRAINING_PLAN_INVALID_ORDER" as const;
  constructor(message: string) {
    super(message);
    this.name = "TrainingPlanInvalidOrderError";
  }
}

/** Cross-season copy is not supported because TrainingSeries identities differ. */
export class TrainingPlanCopyNotSupportedError extends Error {
  readonly code = "TRAINING_PLAN_COPY_NOT_SUPPORTED" as const;
  constructor(message: string) {
    super(message);
    this.name = "TrainingPlanCopyNotSupportedError";
  }
}

/** The requested TrainingPlanAssignment was not found. */
export class TrainingPlanAssignmentNotFoundError extends Error {
  readonly code = "TRAINING_PLAN_ASSIGNMENT_NOT_FOUND" as const;
  constructor(assignmentId: string) {
    super(`TrainingPlanAssignment not found: ${assignmentId}`);
    this.name = "TrainingPlanAssignmentNotFoundError";
  }
}

/** An assignment for this plan+series combination already exists. */
export class TrainingPlanAssignmentConflictError extends Error {
  readonly code = "TRAINING_PLAN_ASSIGNMENT_CONFLICT" as const;
  constructor() {
    super("A TrainingPlanAssignment for this plan and series already exists");
    this.name = "TrainingPlanAssignmentConflictError";
  }
}

/** The assignment's series belongs to a different tenant than the plan. */
export class TrainingPlanAssignmentTenantMismatchError extends Error {
  readonly code = "TRAINING_PLAN_ASSIGNMENT_TENANT_MISMATCH" as const;
  constructor() {
    super("TrainingSeries and TrainingPlan belong to different tenants");
    this.name = "TrainingPlanAssignmentTenantMismatchError";
  }
}

/** The series' season does not match the plan's season. */
export class TrainingPlanAssignmentSeasonMismatchError extends Error {
  readonly code = "TRAINING_PLAN_ASSIGNMENT_SEASON_MISMATCH" as const;
  constructor() {
    super(
      "TrainingSeries TeamSeason season does not match the TrainingPlan season",
    );
    this.name = "TrainingPlanAssignmentSeasonMismatchError";
  }
}

/** A time override is invalid (bad format, start >= end). */
export class TrainingPlanAssignmentInvalidTimeError extends Error {
  readonly code = "TRAINING_PLAN_ASSIGNMENT_INVALID_TIME" as const;
  constructor(message: string) {
    super(message);
    this.name = "TrainingPlanAssignmentInvalidTimeError";
  }
}

/** Season not found. */
export class SeasonNotFoundError extends Error {
  readonly code = "SEASON_NOT_FOUND" as const;
  constructor(seasonId: string) {
    super(`Season not found: ${seasonId}`);
    this.name = "SeasonNotFoundError";
  }
}

// =============================================================================
// TRAINING-ALLOCATIONS-01 errors
// =============================================================================

/** The requested TrainingAllocation was not found (or belongs to another tenant). */
export class TrainingAllocationNotFoundError extends Error {
  readonly code = "TRAINING_ALLOCATION_NOT_FOUND" as const;
  constructor(allocationId: string) {
    super(`TrainingAllocation not found: ${allocationId}`);
    this.name = "TrainingAllocationNotFoundError";
  }
}

/** A duplicate allocation of the same resource to the same training series. */
export class TrainingAllocationDuplicateError extends Error {
  readonly code = "TRAINING_ALLOCATION_DUPLICATE" as const;
  constructor(trainingSeriesId: string, facilityResourceId: string) {
    super(
      `FacilityResource "${facilityResourceId}" is already allocated to TrainingSeries "${trainingSeriesId}"`,
    );
    this.name = "TrainingAllocationDuplicateError";
  }
}

/** The FacilityResource is archived and cannot receive new allocations. */
export class TrainingAllocationArchivedResourceError extends Error {
  readonly code = "TRAINING_ALLOCATION_ARCHIVED_RESOURCE" as const;
  constructor(facilityResourceId: string) {
    super(`FacilityResource "${facilityResourceId}" is archived and cannot receive new allocations`);
    this.name = "TrainingAllocationArchivedResourceError";
  }
}

/** The FacilityResource does not belong to the tenant or does not exist. */
export class TrainingAllocationResourceNotFoundError extends Error {
  readonly code = "TRAINING_ALLOCATION_RESOURCE_NOT_FOUND" as const;
  constructor(facilityResourceId: string) {
    super(`FacilityResource not found: ${facilityResourceId}`);
    this.name = "TrainingAllocationResourceNotFoundError";
  }
}

/** The TrainingSeries and FacilityResource belong to different tenants. */
export class TrainingAllocationTenantMismatchError extends Error {
  readonly code = "TRAINING_ALLOCATION_TENANT_MISMATCH" as const;
  constructor() {
    super("TrainingSeries and FacilityResource belong to different tenants");
    this.name = "TrainingAllocationTenantMismatchError";
  }
}

/** The parent Facility of the FacilityResource is archived and cannot receive new allocations. */
export class TrainingAllocationArchivedFacilityError extends Error {
  readonly code = "TRAINING_ALLOCATION_ARCHIVED_FACILITY" as const;
  constructor(facilityId: string) {
    super(`Facility "${facilityId}" is archived. Its resources cannot receive new allocations.`);
    this.name = "TrainingAllocationArchivedFacilityError";
  }
}
