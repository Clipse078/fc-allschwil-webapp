export type ReviewPolicyMode =
  | "EXEMPT"
  | "DIRECT_ALLOWED_PHASE1"
  | "REVIEW_REQUIRED";

export type ReviewTargetDomain =
  | "events"
  | "seasons"
  | "teams"
  | "people"
  | "users"
  | "imports"
  | "session_security";

export type ReviewCapabilityKey =
  | "create"
  | "review"
  | "approve"
  | "publish"
  | "direct_manage"
  | "series_review";

export type ReviewActorCapabilities = {
  canCreate?: boolean;
  canReview?: boolean;
  canApprove?: boolean;
  canPublish?: boolean;
  canDirectManage?: boolean;
  canReviewSeries?: boolean;
};

export type ReviewPolicyDefinition = {
  domain: ReviewTargetDomain;
  mode: ReviewPolicyMode;
  rationale: string;
};

export type ReviewResolution = {
  domain: ReviewTargetDomain;
  mode: ReviewPolicyMode;
  requiresReview: boolean;
  allowsDirectExecution: boolean;
  allowsReview: boolean;
  allowsApproval: boolean;
  allowsPublish: boolean;
  allowsSeriesReview: boolean;
};

export const REVIEW_POLICY = {
  SESSION_SECURITY: {
    domain: "session_security",
    mode: "EXEMPT",
    rationale:
      "Session and impersonation operations are security/administration flows and must remain immediate.",
  },
  IMPORT_PREVIEW: {
    domain: "imports",
    mode: "DIRECT_ALLOWED_PHASE1",
    rationale:
      "Preview and preparation flows are non-publishing support actions and may remain direct in phase 1.",
  },
  EVENTS: {
    domain: "events",
    mode: "REVIEW_REQUIRED",
    rationale:
      "Events affect downstream channels such as Website, Wochenplan and Infoboard and therefore require four-eye workflow.",
  },
  SEASONS: {
    domain: "seasons",
    mode: "REVIEW_REQUIRED",
    rationale:
      "Season creation and activation are governing operations and should move to review-based approval.",
  },
  TEAMS: {
    domain: "teams",
    mode: "REVIEW_REQUIRED",
    rationale:
      "Team, team season, squad and trainer assignments are domain master-data mutations and should move to review-based approval.",
  },
  PEOPLE: {
    domain: "people",
    mode: "REVIEW_REQUIRED",
    rationale:
      "Person master-data mutations should move to review-based approval to support data quality and later field-level governance.",
  },
  USERS: {
    domain: "users",
    mode: "REVIEW_REQUIRED",
    rationale:
      "User, role and password mutations are high-impact admin actions and should later support stricter dual control or equivalent privileged workflow.",
  },
} as const;

export function resolveReviewPolicy(
  policy: ReviewPolicyDefinition,
  capabilities?: ReviewActorCapabilities,
): ReviewResolution {
  const canReview = Boolean(capabilities?.canReview);
  const canApprove = Boolean(capabilities?.canApprove);
  const canPublish = Boolean(capabilities?.canPublish);
  const canDirectManage = Boolean(capabilities?.canDirectManage);
  const canReviewSeries = Boolean(capabilities?.canReviewSeries);

  if (policy.mode === "EXEMPT") {
    return {
      domain: policy.domain,
      mode: policy.mode,
      requiresReview: false,
      allowsDirectExecution: true,
      allowsReview: canReview,
      allowsApproval: canApprove,
      allowsPublish: canPublish,
      allowsSeriesReview: canReviewSeries,
    };
  }

  if (policy.mode === "DIRECT_ALLOWED_PHASE1") {
    return {
      domain: policy.domain,
      mode: policy.mode,
      requiresReview: false,
      allowsDirectExecution: true,
      allowsReview: canReview,
      allowsApproval: canApprove,
      allowsPublish: canPublish,
      allowsSeriesReview: canReviewSeries,
    };
  }

  return {
    domain: policy.domain,
    mode: policy.mode,
    requiresReview: !canDirectManage,
    allowsDirectExecution: canDirectManage,
    allowsReview: canReview,
    allowsApproval: canApprove,
    allowsPublish: canPublish,
    allowsSeriesReview: canReviewSeries,
  };
}
