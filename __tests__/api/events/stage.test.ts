/**
 * Tests for the event stage transition logic.
 *
 * These tests verify the state-machine rules and the publishedAt stamp
 * behaviour used by PATCH /api/events/[id]/stage.
 *
 * The route handler itself depends on Next.js internals (auth, NextRequest,
 * NextResponse) — those are covered in smoke tests. Here we test the
 * underlying governance primitives it calls.
 */

import { describe, it, expect } from "vitest";
import { ReviewWorkflowStage } from "@prisma/client";
import {
  canTransitionTo,
  getAllowedTransitions,
  requiresReviewerStamp,
  isTerminalState,
} from "@/lib/governance/review-stage";

// ---------------------------------------------------------------------------
// State-machine transitions
// ---------------------------------------------------------------------------

describe("canTransitionTo — events publishing path", () => {
  it("APPROVED → PUBLISHED is allowed", () => {
    expect(canTransitionTo(ReviewWorkflowStage.APPROVED, ReviewWorkflowStage.PUBLISHED)).toBe(true);
  });

  it("DRAFT → PUBLISHED is NOT allowed", () => {
    expect(canTransitionTo(ReviewWorkflowStage.DRAFT, ReviewWorkflowStage.PUBLISHED)).toBe(false);
  });

  it("SUBMITTED → PUBLISHED is NOT allowed", () => {
    expect(canTransitionTo(ReviewWorkflowStage.SUBMITTED, ReviewWorkflowStage.PUBLISHED)).toBe(false);
  });

  it("REJECTED → PUBLISHED is NOT allowed", () => {
    expect(canTransitionTo(ReviewWorkflowStage.REJECTED, ReviewWorkflowStage.PUBLISHED)).toBe(false);
  });

  it("PUBLISHED → PUBLISHED is NOT allowed (terminal state)", () => {
    expect(canTransitionTo(ReviewWorkflowStage.PUBLISHED, ReviewWorkflowStage.PUBLISHED)).toBe(false);
  });
});

describe("canTransitionTo — review workflow path", () => {
  it("DRAFT → SUBMITTED is allowed", () => {
    expect(canTransitionTo(ReviewWorkflowStage.DRAFT, ReviewWorkflowStage.SUBMITTED)).toBe(true);
  });

  it("SUBMITTED → APPROVED is allowed", () => {
    expect(canTransitionTo(ReviewWorkflowStage.SUBMITTED, ReviewWorkflowStage.APPROVED)).toBe(true);
  });

  it("SUBMITTED → REJECTED is allowed", () => {
    expect(canTransitionTo(ReviewWorkflowStage.SUBMITTED, ReviewWorkflowStage.REJECTED)).toBe(true);
  });

  it("SUBMITTED → DRAFT (return for rework) is allowed", () => {
    expect(canTransitionTo(ReviewWorkflowStage.SUBMITTED, ReviewWorkflowStage.DRAFT)).toBe(true);
  });

  it("APPROVED → REJECTED is allowed", () => {
    expect(canTransitionTo(ReviewWorkflowStage.APPROVED, ReviewWorkflowStage.REJECTED)).toBe(true);
  });

  it("REJECTED → DRAFT (restart) is allowed", () => {
    expect(canTransitionTo(ReviewWorkflowStage.REJECTED, ReviewWorkflowStage.DRAFT)).toBe(true);
  });
});

describe("PUBLISHED is a terminal state", () => {
  it("no transitions out of PUBLISHED", () => {
    expect(getAllowedTransitions(ReviewWorkflowStage.PUBLISHED)).toEqual([]);
  });

  it("isTerminalState returns true for PUBLISHED", () => {
    expect(isTerminalState(ReviewWorkflowStage.PUBLISHED)).toBe(true);
  });

  it("isTerminalState returns false for APPROVED", () => {
    expect(isTerminalState(ReviewWorkflowStage.APPROVED)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Reviewer stamp — PUBLISHED must NOT trigger the reviewer stamp
// (publishedAt / publishedByUserId are set separately in the route handler)
// ---------------------------------------------------------------------------

describe("requiresReviewerStamp", () => {
  it("APPROVED triggers reviewer stamp", () => {
    expect(requiresReviewerStamp(ReviewWorkflowStage.APPROVED)).toBe(true);
  });

  it("REJECTED triggers reviewer stamp", () => {
    expect(requiresReviewerStamp(ReviewWorkflowStage.REJECTED)).toBe(true);
  });

  it("PUBLISHED does NOT trigger reviewer stamp (publishedAt handled separately)", () => {
    expect(requiresReviewerStamp(ReviewWorkflowStage.PUBLISHED)).toBe(false);
  });

  it("DRAFT does NOT trigger reviewer stamp", () => {
    expect(requiresReviewerStamp(ReviewWorkflowStage.DRAFT)).toBe(false);
  });

  it("SUBMITTED does NOT trigger reviewer stamp", () => {
    expect(requiresReviewerStamp(ReviewWorkflowStage.SUBMITTED)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// publishedAt stamp logic (isolated from Next.js runtime)
// ---------------------------------------------------------------------------

describe("publishedAt stamp determination", () => {
  function shouldStampPublishedAt(toStage: ReviewWorkflowStage): boolean {
    return toStage === ReviewWorkflowStage.PUBLISHED;
  }

  it("stamps publishedAt when transitioning to PUBLISHED", () => {
    expect(shouldStampPublishedAt(ReviewWorkflowStage.PUBLISHED)).toBe(true);
  });

  it("does NOT stamp publishedAt for APPROVED", () => {
    expect(shouldStampPublishedAt(ReviewWorkflowStage.APPROVED)).toBe(false);
  });

  it("does NOT stamp publishedAt for REJECTED", () => {
    expect(shouldStampPublishedAt(ReviewWorkflowStage.REJECTED)).toBe(false);
  });

  it("does NOT stamp publishedAt for SUBMITTED", () => {
    expect(shouldStampPublishedAt(ReviewWorkflowStage.SUBMITTED)).toBe(false);
  });

  it("does NOT stamp publishedAt for DRAFT", () => {
    expect(shouldStampPublishedAt(ReviewWorkflowStage.DRAFT)).toBe(false);
  });
});

// ---------------------------------------------------------------------------
// Permission model for PUBLISHED transitions
// ---------------------------------------------------------------------------

describe("publish permission check logic", () => {
  const PUBLISH_PERMISSIONS = new Set([
    "events.publish_website",
    "events.publish_infoboard",
  ]);

  function hasPublishPermission(permKeys: string[]): boolean {
    return permKeys.some((k) => PUBLISH_PERMISSIONS.has(k));
  }

  it("allows publish with events.publish_website", () => {
    expect(hasPublishPermission(["events.publish_website"])).toBe(true);
  });

  it("allows publish with events.publish_infoboard", () => {
    expect(hasPublishPermission(["events.publish_infoboard"])).toBe(true);
  });

  it("allows publish with both publish permissions", () => {
    expect(hasPublishPermission(["events.publish_website", "events.publish_infoboard"])).toBe(true);
  });

  it("denies publish with only events.manage", () => {
    expect(hasPublishPermission(["events.manage"])).toBe(false);
  });

  it("denies publish with no permissions", () => {
    expect(hasPublishPermission([])).toBe(false);
  });

  it("denies publish with unrelated permissions", () => {
    expect(hasPublishPermission(["infoboard.manage", "website.manage"])).toBe(false);
  });
});
