/**
 * lib/wochenplan/plan-errors.ts
 *
 * WOCHENPLAN-2.0-01B — typed domain errors for WochenplanPlan.
 */

export class WochenplanPlanNotFoundError extends Error {
  readonly code = "WOCHENPLAN_PLAN_NOT_FOUND" as const;
  constructor(planId: string) {
    super(`WochenplanPlan not found: ${planId}`);
    this.name = "WochenplanPlanNotFoundError";
  }
}

export class WochenplanPlanValidationError extends Error {
  readonly code = "WOCHENPLAN_PLAN_VALIDATION" as const;
  constructor(message: string) {
    super(message);
    this.name = "WochenplanPlanValidationError";
  }
}

export class WochenplanPlanNameConflictError extends Error {
  readonly code = "WOCHENPLAN_PLAN_NAME_CONFLICT" as const;
  constructor(name: string) {
    super(`An active plan named "${name}" already exists for this tenant`);
    this.name = "WochenplanPlanNameConflictError";
  }
}

export class WochenplanPlanArchivedError extends Error {
  readonly code = "WOCHENPLAN_PLAN_ARCHIVED" as const;
  constructor(planId: string) {
    super(`WochenplanPlan "${planId}" is archived`);
    this.name = "WochenplanPlanArchivedError";
  }
}

export class WochenplanPlanDefaultArchiveForbiddenError extends Error {
  readonly code = "WOCHENPLAN_PLAN_DEFAULT_ARCHIVE_FORBIDDEN" as const;
  constructor(planId: string) {
    super(`The default WochenplanPlan "${planId}" cannot be archived`);
    this.name = "WochenplanPlanDefaultArchiveForbiddenError";
  }
}

export class WochenplanPlanActivationConflictError extends Error {
  readonly code = "WOCHENPLAN_PLAN_ACTIVATION_CONFLICT" as const;
  constructor(planId: string) {
    super(
      `WochenplanPlan "${planId}" could not be activated — another plan was activated concurrently`,
    );
    this.name = "WochenplanPlanActivationConflictError";
  }
}

export class WochenplanPlanAllocationEventNotFoundError extends Error {
  readonly code = "WOCHENPLAN_PLAN_ALLOCATION_EVENT_NOT_FOUND" as const;
  constructor(eventId: string) {
    super(`Event not found for allocation: ${eventId}`);
    this.name = "WochenplanPlanAllocationEventNotFoundError";
  }
}
