/**
 * lib/weekplanner/plan-errors.ts
 *
 * WEEKPLANNER-01B — typed domain errors for WeekplannerPlan /
 * WeekplannerPlanAllocation. Mirrors the existing lib/training/errors.ts
 * convention: callers use `instanceof` checks, never message parsing.
 */

/** The requested WeekplannerPlan was not found (or belongs to another tenant). */
export class WeekplannerPlanNotFoundError extends Error {
  readonly code = "WEEKPLANNER_PLAN_NOT_FOUND" as const;
  constructor(planId: string) {
    super(`WeekplannerPlan not found: ${planId}`);
    this.name = "WeekplannerPlanNotFoundError";
  }
}

/** The plan name is empty, whitespace-only, or exceeds the maximum length. */
export class WeekplannerPlanValidationError extends Error {
  readonly code = "WEEKPLANNER_PLAN_VALIDATION" as const;
  constructor(message: string) {
    super(message);
    this.name = "WeekplannerPlanValidationError";
  }
}

/** A non-archived plan with the same name already exists for this tenant+week. */
export class WeekplannerPlanNameConflictError extends Error {
  readonly code = "WEEKPLANNER_PLAN_NAME_CONFLICT" as const;
  constructor(name: string) {
    super(`An active plan named "${name}" already exists for this week`);
    this.name = "WeekplannerPlanNameConflictError";
  }
}

/** The plan is archived; archived plans cannot be renamed or receive new/changed overrides. */
export class WeekplannerPlanArchivedError extends Error {
  readonly code = "WEEKPLANNER_PLAN_ARCHIVED" as const;
  constructor(planId: string) {
    super(`WeekplannerPlan "${planId}" is archived`);
    this.name = "WeekplannerPlanArchivedError";
  }
}

/**
 * WEEKPLANNER-01E-C1 — a concurrent activateWeekplannerPlan() call for a
 * DIFFERENT plan in the same tenant+week committed first, so the DB's
 * partial unique index (`WeekplannerPlan_tenantId_weekId_isActive_unique`)
 * rejected this request's own activation (Postgres unique-violation /
 * Prisma P2002). The target plan was NOT activated and the previously
 * active plan (if any) was left untouched — see
 * lib/weekplanner/plan-service.ts#activateWeekplannerPlan. Safe to retry;
 * no retry is implemented here.
 */
export class WeekplannerPlanActivationConflictError extends Error {
  readonly code = "WEEKPLANNER_PLAN_ACTIVATION_CONFLICT" as const;
  constructor(planId: string) {
    super(`WeekplannerPlan "${planId}" could not be activated — another plan was activated concurrently for this week`);
    this.name = "WeekplannerPlanActivationConflictError";
  }
}

/**
 * Hard-delete is only "safe" (per product spec) when the plan holds zero
 * WeekplannerPlanAllocation rows — otherwise archive instead of delete.
 */
export class WeekplannerPlanDeleteUnsafeError extends Error {
  readonly code = "WEEKPLANNER_PLAN_DELETE_UNSAFE" as const;
  constructor(planId: string) {
    super(
      `WeekplannerPlan "${planId}" has resource-allocation overrides and cannot be deleted — archive it instead`,
    );
    this.name = "WeekplannerPlanDeleteUnsafeError";
  }
}

/** The requested WeekplannerPlanAllocation was not found (or belongs to another tenant/plan). */
export class WeekplannerPlanAllocationNotFoundError extends Error {
  readonly code = "WEEKPLANNER_PLAN_ALLOCATION_NOT_FOUND" as const;
  constructor(allocationId: string) {
    super(`WeekplannerPlanAllocation not found: ${allocationId}`);
    this.name = "WeekplannerPlanAllocationNotFoundError";
  }
}

/** A duplicate override for the same activity + group + participant + resource within one plan. */
export class WeekplannerPlanAllocationDuplicateError extends Error {
  readonly code = "WEEKPLANNER_PLAN_ALLOCATION_DUPLICATE" as const;
  constructor() {
    super("This resource is already overridden for this activity and allocation group in this plan");
    this.name = "WeekplannerPlanAllocationDuplicateError";
  }
}

/** The referenced canonical activity (TrainingSession or Event) was not found in this tenant, or has the wrong type. */
export class WeekplannerPlanAllocationActivityNotFoundError extends Error {
  readonly code = "WEEKPLANNER_PLAN_ALLOCATION_ACTIVITY_NOT_FOUND" as const;
  constructor(activityType: string, activityId: string) {
    super(`${activityType} activity not found: ${activityId}`);
    this.name = "WeekplannerPlanAllocationActivityNotFoundError";
  }
}

/** participantId is missing where required (TOURNAMENT+DRESSING_ROOM) or set where not allowed. */
export class WeekplannerPlanAllocationInvalidParticipantError extends Error {
  readonly code = "WEEKPLANNER_PLAN_ALLOCATION_INVALID_PARTICIPANT" as const;
  constructor(message: string) {
    super(message);
    this.name = "WeekplannerPlanAllocationInvalidParticipantError";
  }
}

/** The FacilityResource's type does not belong to the requested allocationGroup (e.g. a dressing room for PITCH_HALL). */
export class WeekplannerPlanAllocationGroupMismatchError extends Error {
  readonly code = "WEEKPLANNER_PLAN_ALLOCATION_GROUP_MISMATCH" as const;
  constructor(message: string) {
    super(message);
    this.name = "WeekplannerPlanAllocationGroupMismatchError";
  }
}

/** The FacilityResource does not belong to the tenant or does not exist. */
export class WeekplannerPlanAllocationResourceNotFoundError extends Error {
  readonly code = "WEEKPLANNER_PLAN_ALLOCATION_RESOURCE_NOT_FOUND" as const;
  constructor(facilityResourceId: string) {
    super(`FacilityResource not found: ${facilityResourceId}`);
    this.name = "WeekplannerPlanAllocationResourceNotFoundError";
  }
}

/** The FacilityResource is archived and cannot receive new overrides. */
export class WeekplannerPlanAllocationArchivedResourceError extends Error {
  readonly code = "WEEKPLANNER_PLAN_ALLOCATION_ARCHIVED_RESOURCE" as const;
  constructor(facilityResourceId: string) {
    super(`FacilityResource "${facilityResourceId}" is archived and cannot receive new overrides`);
    this.name = "WeekplannerPlanAllocationArchivedResourceError";
  }
}

/** The parent Facility of the FacilityResource is archived and cannot receive new overrides. */
export class WeekplannerPlanAllocationArchivedFacilityError extends Error {
  readonly code = "WEEKPLANNER_PLAN_ALLOCATION_ARCHIVED_FACILITY" as const;
  constructor(facilityId: string) {
    super(`Facility "${facilityId}" is archived. Its resources cannot receive new overrides.`);
    this.name = "WeekplannerPlanAllocationArchivedFacilityError";
  }
}

/** WEEKPLANNER-01D — the requested WeekplannerPlanActivityOverride was not found (or belongs to another tenant/plan). */
export class WeekplannerPlanTimeOverrideNotFoundError extends Error {
  readonly code = "WEEKPLANNER_PLAN_TIME_OVERRIDE_NOT_FOUND" as const;
  constructor(activityType: string, activityId: string) {
    super(`WeekplannerPlanActivityOverride not found for ${activityType} activity ${activityId}`);
    this.name = "WeekplannerPlanTimeOverrideNotFoundError";
  }
}

/**
 * WEEKPLANNER-01D — the requested override start/end would resolve to
 * either an invalid range (end at or before start) or a different calendar
 * day than the canonical activity — a time override may only shift the
 * time-of-day within the SAME day (anti-drift: no date/day overrides).
 */
export class WeekplannerPlanTimeOverrideInvalidRangeError extends Error {
  readonly code = "WEEKPLANNER_PLAN_TIME_OVERRIDE_INVALID_RANGE" as const;
  constructor(message: string) {
    super(message);
    this.name = "WeekplannerPlanTimeOverrideInvalidRangeError";
  }
}
