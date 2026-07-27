/**
 * lib/training/errors.ts
 *
 * Domain error types for the Training module.
 *
 * Typed errors allow callers to distinguish failure modes without
 * parsing error messages.
 */

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
