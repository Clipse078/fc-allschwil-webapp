/**
 * lib/training/create-training-series-orchestration.ts
 *
 * PLANNING-CREATION-UX-01B — orchestrates the guided "Trainingsserie
 * erstellen" workflow as ONE coherent step from the user's perspective,
 * even though the canonical architecture requires the TrainingSeries to
 * exist (POST /api/training-series, which also generates the first
 * occurrence(s) synchronously) before TrainingAllocation rows can be
 * attached to it (POST /api/training-series/:id/allocations).
 *
 * Mirrors lib/tournaments/create-tournament-orchestration.ts (TOURNAMENTCENTER-01D):
 * this module does NOT talk to Prisma or fetch() directly — it is a small,
 * pure sequencing function over caller-supplied `deps` (dependency
 * injection), so it can be unit-tested without a network or database, and
 * reused as-is from the client (TrainingSeriesCreateForm wires `deps` to
 * fetch() calls against the EXISTING, already-reviewed API routes).
 *
 * Deliberately NOT a transaction/job framework: creation happens with plain
 * sequential awaits and per-step error collection. If a later step fails
 * (e.g. an already-allocated or archived facility resource), the
 * TrainingSeries (and whatever allocations already succeeded) is NOT rolled
 * back — it remains real, tenant-scoped, and editable via the existing
 * TrainingCenter allocations page. Same partial-failure philosophy as
 * TOURNAMENTCENTER-01D-V, without introducing new schema or a saga/job queue.
 */

export type TrainingSeriesAllocationDraft = {
  facilityResourceId: string;
  facilityResourceName: string;
};

export type TrainingSeriesCreationPlan = {
  /** Spielfeld/Halle resources to allocate to the newly created series. */
  pitchHallAllocations: TrainingSeriesAllocationDraft[];
  /** Garderobe resources to allocate to the newly created series. */
  dressingRoomAllocations: TrainingSeriesAllocationDraft[];
};

export type TrainingSeriesCreationDeps<TGeneration> = {
  /** Creates the canonical TrainingSeries (+ first occurrence(s)) and returns its id + generation result. */
  createSeries: () => Promise<{ seriesId: string; generation: TGeneration }>;
  /** Adds one TrainingAllocation (Spielfeld/Halle or Garderobe — same endpoint for both groups). */
  addAllocation: (seriesId: string, draft: TrainingSeriesAllocationDraft) => Promise<void>;
};

export type TrainingSeriesCreationStepError = {
  draft: TrainingSeriesAllocationDraft;
  error: string;
};

export type TrainingSeriesCreationOrchestrationResult<TGeneration> = {
  seriesId: string;
  generation: TGeneration;
  resourceAllocationErrors: TrainingSeriesCreationStepError[];
  dressingRoomAllocationErrors: TrainingSeriesCreationStepError[];
  /** true only when every requested allocation succeeded — the series is still created either way. */
  ok: boolean;
};

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

/**
 * Runs the TrainingSeries → Spielfeld/Halle allocations → Garderobe
 * allocations sequence for a single "Trainingsserie erstellen" submission.
 *
 * @throws whatever `deps.createSeries()` throws — if the series itself
 *   cannot be created, nothing else is attempted (there is nothing to
 *   attach allocations to).
 */
export async function orchestrateTrainingSeriesCreation<TGeneration>(
  plan: TrainingSeriesCreationPlan,
  deps: TrainingSeriesCreationDeps<TGeneration>,
): Promise<TrainingSeriesCreationOrchestrationResult<TGeneration>> {
  const { seriesId, generation } = await deps.createSeries();

  const resourceAllocationErrors: TrainingSeriesCreationStepError[] = [];
  for (const draft of plan.pitchHallAllocations) {
    try {
      await deps.addAllocation(seriesId, draft);
    } catch (err) {
      resourceAllocationErrors.push({
        draft,
        error: errorMessage(err, "Ressource konnte nicht zugewiesen werden."),
      });
    }
  }

  const dressingRoomAllocationErrors: TrainingSeriesCreationStepError[] = [];
  for (const draft of plan.dressingRoomAllocations) {
    try {
      await deps.addAllocation(seriesId, draft);
    } catch (err) {
      dressingRoomAllocationErrors.push({
        draft,
        error: errorMessage(err, "Garderobe konnte nicht zugewiesen werden."),
      });
    }
  }

  const ok = resourceAllocationErrors.length === 0 && dressingRoomAllocationErrors.length === 0;

  return { seriesId, generation, resourceAllocationErrors, dressingRoomAllocationErrors, ok };
}
