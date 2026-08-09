/**
 * lib/tournaments/errors.ts
 *
 * Typed errors for the TournamentCenter domain service, mirroring the
 * error-class conventions established by lib/training/errors.ts and
 * lib/matchcenter (tenant-scoped not-found + validation + transition
 * errors).
 */

export class TournamentNotFoundError extends Error {
  constructor(tournamentId: string) {
    super(`Tournament "${tournamentId}" was not found.`);
    this.name = "TournamentNotFoundError";
  }
}

export class TournamentValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TournamentValidationError";
  }
}

export class TournamentInvalidTransitionError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TournamentInvalidTransitionError";
  }
}

// =============================================================================
// TOURNAMENTCENTER-01B errors — multi-team participation
// (lib/tournaments/participant-service.ts)
// =============================================================================

/** The requested TournamentParticipant was not found (or belongs to another tenant/tournament). */
export class TournamentParticipantNotFoundError extends Error {
  constructor(participantId: string) {
    super(`TournamentParticipant "${participantId}" was not found.`);
    this.name = "TournamentParticipantNotFoundError";
  }
}

/** The participant input is invalid (e.g. none or more than one of team/externalTeam/manualLabel set). */
export class TournamentParticipantValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TournamentParticipantValidationError";
  }
}

/** The same canonical Team or ExternalTeam is already a participant of this tournament. */
export class TournamentParticipantDuplicateError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TournamentParticipantDuplicateError";
  }
}

/** The referenced Team or ExternalTeam does not belong to the tournament's tenant. */
export class TournamentParticipantTenantMismatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "TournamentParticipantTenantMismatchError";
  }
}

// =============================================================================
// TOURNAMENTCENTER-01B errors — tournament-level Spielfeld/Halle allocations
// (lib/tournaments/resource-allocation-service.ts). Mirrors the
// TRAINING-ALLOCATIONS-01 error shapes verbatim, scoped to a Tournament
// (Event, type=TOURNAMENT) instead of a TrainingSeries.
// =============================================================================

export class TournamentResourceAllocationNotFoundError extends Error {
  constructor(allocationId: string) {
    super(`TournamentResourceAllocation not found: ${allocationId}`);
    this.name = "TournamentResourceAllocationNotFoundError";
  }
}

export class TournamentResourceAllocationDuplicateError extends Error {
  constructor(eventId: string, facilityResourceId: string) {
    super(`FacilityResource "${facilityResourceId}" is already allocated to Tournament "${eventId}"`);
    this.name = "TournamentResourceAllocationDuplicateError";
  }
}

export class TournamentResourceAllocationArchivedResourceError extends Error {
  constructor(facilityResourceId: string) {
    super(`FacilityResource "${facilityResourceId}" is archived and cannot receive new allocations`);
    this.name = "TournamentResourceAllocationArchivedResourceError";
  }
}

export class TournamentResourceAllocationArchivedFacilityError extends Error {
  constructor(facilityId: string) {
    super(`Facility "${facilityId}" is archived. Its resources cannot receive new allocations.`);
    this.name = "TournamentResourceAllocationArchivedFacilityError";
  }
}

export class TournamentResourceAllocationResourceNotFoundError extends Error {
  constructor(facilityResourceId: string) {
    super(`FacilityResource not found: ${facilityResourceId}`);
    this.name = "TournamentResourceAllocationResourceNotFoundError";
  }
}

// =============================================================================
// TOURNAMENTCENTER-01B errors — per-participant Garderobe allocations
// (lib/tournaments/participant-allocation-service.ts)
// =============================================================================

export class TournamentParticipantAllocationNotFoundError extends Error {
  constructor(allocationId: string) {
    super(`TournamentParticipantAllocation not found: ${allocationId}`);
    this.name = "TournamentParticipantAllocationNotFoundError";
  }
}

export class TournamentParticipantAllocationDuplicateError extends Error {
  constructor(participantId: string, facilityResourceId: string) {
    super(
      `FacilityResource "${facilityResourceId}" is already allocated to TournamentParticipant "${participantId}"`,
    );
    this.name = "TournamentParticipantAllocationDuplicateError";
  }
}

export class TournamentParticipantAllocationArchivedResourceError extends Error {
  constructor(facilityResourceId: string) {
    super(`FacilityResource "${facilityResourceId}" is archived and cannot receive new allocations`);
    this.name = "TournamentParticipantAllocationArchivedResourceError";
  }
}

export class TournamentParticipantAllocationArchivedFacilityError extends Error {
  constructor(facilityId: string) {
    super(`Facility "${facilityId}" is archived. Its resources cannot receive new allocations.`);
    this.name = "TournamentParticipantAllocationArchivedFacilityError";
  }
}

export class TournamentParticipantAllocationResourceNotFoundError extends Error {
  constructor(facilityResourceId: string) {
    super(`FacilityResource not found: ${facilityResourceId}`);
    this.name = "TournamentParticipantAllocationResourceNotFoundError";
  }
}
