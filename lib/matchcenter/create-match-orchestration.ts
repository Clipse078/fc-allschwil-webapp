/**
 * lib/matchcenter/create-match-orchestration.ts
 *
 * PLANNING-CREATION-UX-01C — orchestrates the guided "Match erstellen"
 * workflow as ONE coherent step from the user's perspective, mirroring
 * lib/tournaments/create-tournament-orchestration.ts and
 * lib/training/create-training-series-orchestration.ts.
 *
 * The canonical architecture still requires two sequential calls:
 *   1. POST /api/events (type=MATCH) — creates the Event and lets the
 *      EXISTING event-review policy (lib/workflow/event-review-policy.ts)
 *      decide reviewStage (APPROVED vs SUBMITTED) purely from the actor's
 *      permissions. Nothing here invents a new lifecycle/state.
 *   2. PATCH /api/matchcenter/:matchId (HOME only, only when at least one
 *      Spielfeld/Halle or Garderobe resource was chosen) — writes the
 *      legacy pitchCode/homeDressingRoomCode/awayDressingRoomCode string
 *      fields, the SAME fields MatchcenterDetailOperational already
 *      updates. These are still the canonical persistence for
 *      Event(type=MATCH) allocation (see lib/facilities/availability-service.ts
 *      module doc) — no FacilityResource-id migration is introduced here.
 *
 * Deliberately NOT a transaction/job framework: if step 2 fails, the Event
 * from step 1 is NOT rolled back — it remains real and editable via the
 * existing Matchcenter detail page. Same partial-failure philosophy as the
 * Tournament/Training guided-creation orchestrators.
 */

export type MatchCreationPlan = {
  homeAway: "HOME" | "AWAY";
  /** FacilityResource.code for the selected pitch/hall — HOME only. */
  pitchCode: string | null;
  /** FacilityResource.code for the home dressing room — HOME only. */
  homeDressingRoomCode: string | null;
  /** FacilityResource.code for the away dressing room — HOME only. */
  awayDressingRoomCode: string | null;
};

export type MatchCreationEventResult = {
  eventId: string;
  reviewStage: string;
  allowsDirectExecution: boolean;
};

export type MatchCreationDeps = {
  /** Creates the canonical Event(type=MATCH) via POST /api/events. */
  createEvent: () => Promise<MatchCreationEventResult>;
  /** Writes pitch/dressing-room codes via PATCH /api/matchcenter/:matchId. */
  updateOperationalFields: (
    eventId: string,
    fields: {
      pitchCode: string | null;
      homeDressingRoomCode: string | null;
      awayDressingRoomCode: string | null;
    },
  ) => Promise<void>;
};

export type MatchCreationResult = MatchCreationEventResult & {
  /** Set when the Event was created but the operational-fields PATCH failed. */
  operationalFieldsError: string | null;
  /** true only when the Event was created AND (if attempted) the PATCH succeeded. */
  ok: boolean;
};

function errorMessage(err: unknown, fallback: string): string {
  return err instanceof Error && err.message ? err.message : fallback;
}

/**
 * Runs the Event → operational-fields (Spielfeld/Halle + Garderobe, HOME
 * only) sequence for a single "Match erstellen" submission.
 *
 * @throws whatever `deps.createEvent()` throws — if the Event itself
 *   cannot be created, nothing else is attempted.
 */
export async function orchestrateMatchCreation(
  plan: MatchCreationPlan,
  deps: MatchCreationDeps,
): Promise<MatchCreationResult> {
  const event = await deps.createEvent();

  const hasOperationalFields =
    plan.homeAway === "HOME" &&
    (!!plan.pitchCode || !!plan.homeDressingRoomCode || !!plan.awayDressingRoomCode);

  let operationalFieldsError: string | null = null;

  if (hasOperationalFields) {
    try {
      await deps.updateOperationalFields(event.eventId, {
        pitchCode: plan.pitchCode,
        homeDressingRoomCode: plan.homeDressingRoomCode,
        awayDressingRoomCode: plan.awayDressingRoomCode,
      });
    } catch (err) {
      operationalFieldsError = errorMessage(
        err,
        "Zuteilung konnte nicht gespeichert werden.",
      );
    }
  }

  return {
    ...event,
    operationalFieldsError,
    ok: !operationalFieldsError,
  };
}
