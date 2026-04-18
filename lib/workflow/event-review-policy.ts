import {
  REVIEW_POLICY,
  resolveReviewPolicy,
  type ReviewActorCapabilities,
} from "@/lib/workflow/review-policy";

export type EventReviewAction =
  | "create_event"
  | "update_event"
  | "delete_event"
  | "import_events"
  | "publish_website"
  | "publish_infoboard"
  | "approve_series"
  | "reject_series";

export type EventReviewWorkflowStage =
  | "draft"
  | "submitted"
  | "approved"
  | "rejected"
  | "published";

export type EventReviewPolicyDefinition = {
  action: EventReviewAction;
  policyMode: (typeof REVIEW_POLICY.EVENTS)["mode"];
  requiresReview: boolean;
  allowsDirectPublish: boolean;
  initialStage: EventReviewWorkflowStage;
  targetStage: EventReviewWorkflowStage;
  rationale: string;
};

export type EventReviewDecision = EventReviewPolicyDefinition & {
  allowsDirectExecution: boolean;
  allowsReview: boolean;
  allowsApproval: boolean;
  allowsPublish: boolean;
  allowsSeriesReview: boolean;
};

export const EVENT_REVIEW_POLICIES: Record<
  EventReviewAction,
  EventReviewPolicyDefinition
> = {
  create_event: {
    action: "create_event",
    policyMode: REVIEW_POLICY.EVENTS.mode,
    requiresReview: true,
    allowsDirectPublish: false,
    initialStage: "draft",
    targetStage: "submitted",
    rationale:
      "New events should not directly reach publishable downstream channels without review unless an explicitly empowered actor is allowed to manage directly.",
  },
  update_event: {
    action: "update_event",
    policyMode: REVIEW_POLICY.EVENTS.mode,
    requiresReview: true,
    allowsDirectPublish: false,
    initialStage: "draft",
    targetStage: "submitted",
    rationale:
      "Event changes may affect planners, Website and Infoboard and therefore require review unless the actor is explicitly allowed to manage directly.",
  },
  delete_event: {
    action: "delete_event",
    policyMode: REVIEW_POLICY.EVENTS.mode,
    requiresReview: true,
    allowsDirectPublish: false,
    initialStage: "draft",
    targetStage: "submitted",
    rationale:
      "Deleting events is a high-impact change and should require review before execution unless explicitly allowed for a leading role capability set.",
  },
  import_events: {
    action: "import_events",
    policyMode: REVIEW_POLICY.EVENTS.mode,
    requiresReview: true,
    allowsDirectPublish: false,
    initialStage: "draft",
    targetStage: "submitted",
    rationale:
      "Imported events should be reviewed before becoming active operational truth.",
  },
  publish_website: {
    action: "publish_website",
    policyMode: REVIEW_POLICY.EVENTS.mode,
    requiresReview: true,
    allowsDirectPublish: false,
    initialStage: "approved",
    targetStage: "published",
    rationale:
      "Website publication must remain controlled under the four-eye principle.",
  },
  publish_infoboard: {
    action: "publish_infoboard",
    policyMode: REVIEW_POLICY.EVENTS.mode,
    requiresReview: true,
    allowsDirectPublish: false,
    initialStage: "approved",
    targetStage: "published",
    rationale:
      "Infoboard publication must remain controlled because it affects live operational communication.",
  },
  approve_series: {
    action: "approve_series",
    policyMode: REVIEW_POLICY.EVENTS.mode,
    requiresReview: true,
    allowsDirectPublish: false,
    initialStage: "submitted",
    targetStage: "approved",
    rationale:
      "Recurring training series should be reviewable and approvable as one grouped workflow action.",
  },
  reject_series: {
    action: "reject_series",
    policyMode: REVIEW_POLICY.EVENTS.mode,
    requiresReview: true,
    allowsDirectPublish: false,
    initialStage: "submitted",
    targetStage: "rejected",
    rationale:
      "Recurring training series should also be rejectable as one grouped workflow action.",
  },
};

export function getEventReviewPolicy(action: EventReviewAction) {
  return EVENT_REVIEW_POLICIES[action];
}

export function resolveEventReviewDecision(
  action: EventReviewAction,
  capabilities?: ReviewActorCapabilities,
): EventReviewDecision {
  const policy = getEventReviewPolicy(action);
  const resolved = resolveReviewPolicy(REVIEW_POLICY.EVENTS, capabilities);

  const allowsDirectExecution =
    action === "create_event" ||
    action === "update_event" ||
    action === "delete_event"
      ? resolved.allowsDirectExecution
      : false;

  const allowsReview =
    action === "approve_series" || action === "reject_series"
      ? resolved.allowsReview && resolved.allowsSeriesReview
      : resolved.allowsReview;

  const allowsApproval =
    action === "approve_series"
      ? resolved.allowsApproval && resolved.allowsSeriesReview
      : resolved.allowsApproval;

  const allowsPublish =
    action === "publish_website" || action === "publish_infoboard"
      ? resolved.allowsPublish
      : false;

  return {
    ...policy,
    requiresReview: allowsDirectExecution ? false : policy.requiresReview,
    allowsDirectExecution,
    allowsReview,
    allowsApproval,
    allowsPublish,
    allowsSeriesReview: resolved.allowsSeriesReview,
  };
}
