/**
 * lib/tournaments/create-tournament-orchestration.ts
 *
 * TOURNAMENTCENTER-01D — orchestrates the "Turnier erstellen" creation
 * workflow as ONE coherent step from the user's perspective, even though
 * the canonical architecture (PR #325 / TOURNAMENTCENTER-01B) requires the
 * Event to exist before TournamentParticipant / TournamentResourceAllocation
 * / TournamentParticipantAllocation rows can be created.
 *
 * This module intentionally does NOT talk to Prisma or fetch() directly —
 * it is a small, pure sequencing function over caller-supplied `deps`
 * (dependency injection), so it can be:
 *   - unit-tested without a network or database (see __tests__), and
 *   - reused as-is from the client (TournamentCreateForm wires `deps` to
 *     fetch() calls against the EXISTING, already-reviewed API routes —
 *     POST /api/events, POST /api/tournaments/:id/participants,
 *     POST /api/tournaments/:id/resource-allocations,
 *     POST /api/tournaments/:id/participants/:id/dressing-room-allocations).
 *
 * Deliberately NOT a transaction/job framework: creation happens with
 * plain sequential awaits and per-step error collection. If a later step
 * fails (e.g. a duplicate participant, or an archived facility resource),
 * earlier successfully-created rows are NOT rolled back — the Event and
 * whatever was created remain real, tenant-scoped, and editable via the
 * existing TournamentCenter edit flow. This is the "handle partial failure
 * safely" behaviour called for by TOURNAMENTCENTER-01D, without introducing
 * new schema, a saga/job queue, or a bespoke multi-entity transaction.
 */

/**
 * EXTERNAL_TEAM is HISTORICAL ONLY — kept so the orchestration type remains
 * compatible with any pre-existing draft data shape; TournamentCreateForm no
 * longer produces EXTERNAL_TEAM drafts (see TOURNAMENTCENTER-UX-03 — new
 * external participants use EXTERNAL_CLUB + displayName instead).
 */
export type TournamentParticipantDraftKind = "TEAM" | "EXTERNAL_CLUB" | "EXTERNAL_TEAM" | "MANUAL";

export type TournamentParticipantDraft = {
  /** Client-only correlation id — never sent to the server. */
  localId: string;
  kind: TournamentParticipantDraftKind;
  teamId?: string;
  externalTeamId?: string;
  externalClubId?: string;
  /** Tournament-specific "Anzeigename" — only meaningful together with externalClubId. */
  displayName?: string;
  manualLabel?: string;
};

export type TournamentResourceAllocationDraft = {
  localId: string;
  facilityResourceId: string;
};

export type TournamentDressingRoomAllocationDraft = {
  /** Correlates to a TournamentParticipantDraft.localId. */
  participantLocalId: string;
  facilityResourceId: string;
};

export type TournamentCreationPlan = {
  homeAway: "HOME" | "AWAY";
  participants: TournamentParticipantDraft[];
  /** Only ever applied when homeAway === "HOME" — AWAY has no FCA facility requirement. */
  resourceAllocations: TournamentResourceAllocationDraft[];
  /** Only ever applied when homeAway === "HOME" — AWAY has no FCA dressing-room requirement. */
  dressingRoomAllocations: TournamentDressingRoomAllocationDraft[];
};

export type TournamentCreationOrchestrationDeps = {
  /** Creates the canonical Event(type=TOURNAMENT) and returns its id. */
  createEvent: () => Promise<string>;
  /** Adds one TournamentParticipant and returns its id. */
  addParticipant: (tournamentId: string, draft: TournamentParticipantDraft) => Promise<string>;
  /** Adds one TournamentResourceAllocation (Spielfeld/Halle). */
  addResourceAllocation: (tournamentId: string, draft: TournamentResourceAllocationDraft) => Promise<void>;
  /** Adds one TournamentParticipantAllocation (Garderobe) for the given (already-created) participant. */
  addDressingRoomAllocation: (
    tournamentId: string,
    participantId: string,
    draft: TournamentDressingRoomAllocationDraft,
  ) => Promise<void>;
};

export type TournamentCreationStepError<TDraft> = {
  draft: TDraft;
  error: string;
};

export type TournamentCreationOrchestrationResult = {
  tournamentId: string;
  /** participant.localId -> created TournamentParticipant.id, for successfully created participants only. */
  createdParticipantIds: Map<string, string>;
  participantErrors: TournamentCreationStepError<TournamentParticipantDraft>[];
  resourceAllocationErrors: TournamentCreationStepError<TournamentResourceAllocationDraft>[];
  dressingRoomAllocationErrors: TournamentCreationStepError<TournamentDressingRoomAllocationDraft>[];
  /** true only when every requested sub-step succeeded — the tournament is still created either way. */
  ok: boolean;
};

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

/**
 * Runs the Event → participants → resource allocations → dressing-room
 * allocations sequence for a single "Turnier erstellen" submission.
 *
 * Ordering is deliberate: participants are created before resource/
 * dressing-room allocations because dressing-room allocations require a
 * real TournamentParticipant id.
 *
 * @throws whatever `deps.createEvent()` throws — if the Event itself
 *   cannot be created, nothing else is attempted (there is nothing to
 *   attach participants/allocations to).
 */
export async function orchestrateTournamentCreation(
  plan: TournamentCreationPlan,
  deps: TournamentCreationOrchestrationDeps,
): Promise<TournamentCreationOrchestrationResult> {
  const tournamentId = await deps.createEvent();

  const createdParticipantIds = new Map<string, string>();
  const participantErrors: TournamentCreationStepError<TournamentParticipantDraft>[] = [];

  for (const draft of plan.participants) {
    try {
      const participantId = await deps.addParticipant(tournamentId, draft);
      createdParticipantIds.set(draft.localId, participantId);
    } catch (err) {
      participantErrors.push({ draft, error: errorMessage(err, "Teilnehmer konnte nicht angelegt werden.") });
    }
  }

  const resourceAllocationErrors: TournamentCreationStepError<TournamentResourceAllocationDraft>[] = [];
  const dressingRoomAllocationErrors: TournamentCreationStepError<TournamentDressingRoomAllocationDraft>[] = [];

  // AWAY tournaments have no FCA facility requirement at all (see
  // lib/tournaments/operational-state.ts) — never create resource or
  // dressing-room allocations for one, even if drafts were somehow present.
  if (plan.homeAway === "HOME") {
    for (const draft of plan.resourceAllocations) {
      try {
        await deps.addResourceAllocation(tournamentId, draft);
      } catch (err) {
        resourceAllocationErrors.push({
          draft,
          error: errorMessage(err, "Ressource konnte nicht zugewiesen werden."),
        });
      }
    }

    for (const draft of plan.dressingRoomAllocations) {
      const participantId = createdParticipantIds.get(draft.participantLocalId);
      if (!participantId) {
        dressingRoomAllocationErrors.push({
          draft,
          error: "Zugehöriger Teilnehmer wurde nicht angelegt.",
        });
        continue;
      }
      try {
        await deps.addDressingRoomAllocation(tournamentId, participantId, draft);
      } catch (err) {
        dressingRoomAllocationErrors.push({
          draft,
          error: errorMessage(err, "Garderobe konnte nicht zugewiesen werden."),
        });
      }
    }
  }

  const ok =
    participantErrors.length === 0 &&
    resourceAllocationErrors.length === 0 &&
    dressingRoomAllocationErrors.length === 0;

  return {
    tournamentId,
    createdParticipantIds,
    participantErrors,
    resourceAllocationErrors,
    dressingRoomAllocationErrors,
    ok,
  };
}
