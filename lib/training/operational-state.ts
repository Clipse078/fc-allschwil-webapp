/**
 * lib/training/operational-state.ts
 *
 * TRAININGCENTER-01 — operational readiness / open-action derivation for
 * canonical TrainingSession occurrences.
 *
 * Mirrors the Matchcenter operational-state contract (Alle | Offen |
 * Erledigt — see lib/matchcenter/operational-state.ts) so the two sibling
 * modules feel like one product family, while encoding the Training-
 * specific domain rule:
 *
 *   Trainings are always HOME activities. There is no away-training
 *   exception — pitch and dressing-room allocation are always relevant.
 *   (Contrast with Matchcenter, where AWAY matches never require FCA
 *   home-facility setup.)
 *
 * Allocation is series-level (TrainingAllocation belongs to TrainingSeries,
 * not to an individual TrainingSession) — every occurrence generated from a
 * series inherits that series' allocation state. A once-CANCELLED (or
 * otherwise inactive) occurrence has nothing left to operationally prepare,
 * exactly like a completed/cancelled Matchcenter match.
 *
 * Pure, synchronous, no I/O.
 */

import type { TrainingSessionDto } from "./types";

export type TrainingActionStatus = "READY" | "OPEN" | "NOT_APPLICABLE";

export type TrainingOperationalAction = {
  key: "pitch" | "dressing-room";
  label: string;
};

export type TrainingOperationalAssessment = {
  status: TrainingActionStatus;
  actions: TrainingOperationalAction[];
  actionCount: number;
};

/** Per-TrainingSeries allocation coverage, derived from TrainingAllocation rows. */
export type TrainingAllocationSummary = {
  hasPitchAllocation: boolean;
  hasDressingRoomAllocation: boolean;
};

const NOT_APPLICABLE: TrainingOperationalAssessment = {
  status: "NOT_APPLICABLE",
  actions: [],
  actionCount: 0,
};

/** Statuses that still represent an active, operationally-relevant occurrence. */
function isSessionActionable(session: Pick<TrainingSessionDto, "status">): boolean {
  return session.status === "SCHEDULED";
}

/**
 * Assesses the operational open-action state of a single TrainingSession.
 *
 * HARD RULE (mirrors Matchcenter §10): a CANCELLED / POSTPONED / MOVED /
 * RECURRENCE_REMOVED occurrence is unconditionally NOT_APPLICABLE — there
 * is nothing left to operationally prepare for it, even when the parent
 * series' allocation is incomplete.
 *
 * For SCHEDULED occurrences: trainings are always HOME activities, so both
 * a pitch/resource allocation and a dressing-room allocation are always
 * relevant (no away-training exception, unlike Matchcenter).
 */
export function assessTrainingOperationalState(
  session: Pick<TrainingSessionDto, "status">,
  allocationSummary: TrainingAllocationSummary | undefined,
): TrainingOperationalAssessment {
  if (!isSessionActionable(session)) {
    return NOT_APPLICABLE;
  }

  const summary = allocationSummary ?? {
    hasPitchAllocation: false,
    hasDressingRoomAllocation: false,
  };

  const actions: TrainingOperationalAction[] = [];
  if (!summary.hasPitchAllocation) {
    actions.push({ key: "pitch", label: "Spielfeld/Halle" });
  }
  if (!summary.hasDressingRoomAllocation) {
    actions.push({ key: "dressing-room", label: "Garderobe" });
  }

  if (actions.length === 0) {
    return { status: "READY", actions: [], actionCount: 0 };
  }

  return { status: "OPEN", actions, actionCount: actions.length };
}

export function isTrainingSessionOperationallyOpen(
  session: Pick<TrainingSessionDto, "status">,
  allocationSummary: TrainingAllocationSummary | undefined,
): boolean {
  return assessTrainingOperationalState(session, allocationSummary).status === "OPEN";
}
