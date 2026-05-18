/**
 * Four-eye enforcement for stage transitions.
 *
 * The four-eye principle (Vier-Augen-Prinzip) requires that a second actor —
 * not the creator — approves or publishes a governed entity. This prevents
 * self-approval on sensitive governance actions.
 *
 * Enforcement order (mandatory — do not reorder):
 *   1. Visibility check   (requireXxxAccess)  → 404-mask
 *   2. Permission check   (requireXxxAccess)  → 403 Forbidden
 *   3. Stage-machine check (canTransitionTo)  → 422 Invalid transition
 *   4. Four-eye check      (this module)      → 403 Self-approval blocked
 *   5. DB update
 *
 * Blocked stages (when requiresFourEyeReview === true):
 *   APPROVED  — requires a different authorized actor
 *   PUBLISHED — requires a different authorized actor
 *
 * Always allowed by any actor with sufficient permissions:
 *   DRAFT     — going back to draft
 *   SUBMITTED — creator submits for review
 *   REJECTED  — reviewer rejects (or admin sends back)
 *
 * Phase 2 TODOs:
 *
 * TODO: reviewer role validation
 *   In addition to blocking self-approval, verify that the approving actor
 *   holds a role listed in RoleWorkflowReviewAssignment for this entity's
 *   WorkflowDomain. Requires loading review assignments from DB at transition time.
 *
 * TODO: partial approval chains
 *   When multiple required reviewers exist (sortOrder on RoleWorkflowReviewAssignment),
 *   track partial approval state and only allow final APPROVED when all required
 *   reviewers have signed off. Requires a MeetingReviewSignoff / junction model.
 *
 * TODO: audit log on blocked attempt
 *   When self-approval is blocked, emit an AuditLog entry recording who attempted
 *   to self-approve and when, for compliance traceability.
 */

import { NextResponse } from "next/server";
import { ReviewWorkflowStage } from "@prisma/client";

/** Stages that require a different reviewer when four-eye is active. */
const FOUR_EYE_STAGES: ReadonlySet<ReviewWorkflowStage> = new Set([
  ReviewWorkflowStage.APPROVED,
  ReviewWorkflowStage.PUBLISHED,
]);

type FourEyeResult = { ok: true } | { ok: false; response: NextResponse };

/**
 * Asserts that the stage transition is allowed under the four-eye policy.
 *
 * Returns { ok: true } if the transition is permitted.
 * Returns { ok: false, response } with a 403 NextResponse if self-approval
 * is attempted when requiresFourEyeReview is true.
 *
 * Call this AFTER:
 *   - requireXxxAccess() (visibility + permission)
 *   - canTransitionTo() (state-machine validity)
 * Call this BEFORE the DB update.
 */
export function assertFourEyeAllowed(opts: {
  actorUserId: string;
  createdByUserId: string | null;
  requiresFourEyeReview: boolean;
  toStage: ReviewWorkflowStage;
}): FourEyeResult {
  // Four-eye only applies to APPROVED and PUBLISHED
  if (!FOUR_EYE_STAGES.has(opts.toStage)) {
    return { ok: true };
  }

  // If the entity does not require four-eye review, allow anyone with permission
  if (!opts.requiresFourEyeReview) {
    return { ok: true };
  }

  // No creator on record — fail safe: block the transition
  // (An entity with no createdByUserId and requiresFourEyeReview=true is in an
  //  unexpected state; blocking is the conservative safe default.)
  if (!opts.createdByUserId) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error:
            "Vier-Augen-Prinzip: Kein Ersteller erfasst — Genehmigung nicht möglich.",
        },
        { status: 403 },
      ),
    };
  }

  // Self-approval: creator cannot approve their own record
  if (opts.actorUserId === opts.createdByUserId) {
    return {
      ok: false,
      response: NextResponse.json(
        {
          error:
            "Vier-Augen-Prinzip: Der Ersteller kann diesen Schritt nicht selbst genehmigen.",
        },
        { status: 403 },
      ),
    };
  }

  return { ok: true };
}
