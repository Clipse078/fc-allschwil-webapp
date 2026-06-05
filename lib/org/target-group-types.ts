/**
 * TargetGroup Rule Type System
 *
 * Defines the ruleJson structure stored on TargetGroup.ruleJson.
 * Rules are deterministic — no AI, no probabilistic logic.
 * The resolver evaluates them to a concrete set of member IDs.
 *
 * Rule schema is a recursive union/intersection tree over leaf clause types.
 * All clause types are additive or subtractive — never ambiguous.
 *
 * Future consumers: communication, polls, newsletters, meetings,
 * initiatives, strategy, registrations, finance, mobile app.
 */

// ── Leaf clause types ─────────────────────────────────────────────────────────

/** Match users by explicit user ID list */
export type UserIdsClause = {
  type: "userIds";
  value: string[];
};

/** Match persons by explicit person ID list */
export type PersonIdsClause = {
  type: "personIds";
  value: string[];
};

/** Match all active members of the given org unit IDs */
export type OrgUnitIdsClause = {
  type: "orgUnitIds";
  value: string[];
};

/** Match all members who hold the given role keys */
export type RoleKeysClause = {
  type: "roleKeys";
  value: string[];
};

/** Match all active team members (PlayerSquadMember + TrainerTeamMember) of given team IDs */
export type TeamIdsClause = {
  type: "teamIds";
  value: string[];
};

// ── Composite clause types ────────────────────────────────────────────────────

/** Union: member is in ANY of the sub-clauses (logical OR) */
export type UnionClause = {
  type: "union";
  clauses: TargetGroupClause[];
};

/** Intersection: member must be in ALL sub-clauses (logical AND) */
export type IntersectionClause = {
  type: "intersection";
  clauses: TargetGroupClause[];
};

// ── Root discriminated union ──────────────────────────────────────────────────

export type TargetGroupClause =
  | UserIdsClause
  | PersonIdsClause
  | OrgUnitIdsClause
  | RoleKeysClause
  | TeamIdsClause
  | UnionClause
  | IntersectionClause;

// ── Resolved member shape ─────────────────────────────────────────────────────

export type ResolvedMembership = {
  userId: string | null;
  personId: string | null;
  roleKey: string | null;
  displayName: string;
  email: string | null;
  memberType: "user" | "person";
  /** Which org unit IDs contributed to this member being included */
  viaOrgUnitIds?: string[];
  /** Which role keys contributed to this member being included */
  viaRoleKeys?: string[];
  /** Which team IDs contributed to this member being included */
  viaTeamIds?: string[];
};

// ── Resolver result ───────────────────────────────────────────────────────────

export type TargetGroupResolveResult = {
  targetGroupId: string;
  /** Unique user IDs in the resolved group */
  userIds: string[];
  /** Unique person IDs in the resolved group */
  personIds: string[];
  /** Full member details with attribution */
  members: ResolvedMembership[];
  /** Resolver performance metadata */
  resolvedAt: string;
  memberCount: number;
};

// ── Validation ────────────────────────────────────────────────────────────────

const VALID_CLAUSE_TYPES = new Set([
  "userIds",
  "personIds",
  "orgUnitIds",
  "roleKeys",
  "teamIds",
  "union",
  "intersection",
]);

/**
 * Validates a ruleJson blob against the TargetGroupClause schema.
 * Returns null if valid; returns an error string if invalid.
 */
export function validateRuleJson(ruleJson: unknown): string | null {
  if (ruleJson === null || ruleJson === undefined) return null;
  return validateClause(ruleJson, 0);
}

function validateClause(clause: unknown, depth: number): string | null {
  if (depth > 10) return "Regel zu tief verschachtelt (max 10 Ebenen)";
  if (!clause || typeof clause !== "object" || Array.isArray(clause)) {
    return "Ungültiger Regelknoten: muss ein Objekt sein";
  }
  const c = clause as Record<string, unknown>;
  if (!c.type || typeof c.type !== "string") return "Regelknoten ohne type";
  if (!VALID_CLAUSE_TYPES.has(c.type)) {
    return `Unbekannter Regeltyp: ${c.type}`;
  }

  if (c.type === "union" || c.type === "intersection") {
    if (!Array.isArray(c.clauses)) {
      return `${c.type} muss ein clauses-Array haben`;
    }
    for (const sub of c.clauses as unknown[]) {
      const err = validateClause(sub, depth + 1);
      if (err) return err;
    }
    return null;
  }

  if (!Array.isArray(c.value)) {
    return `${c.type} muss ein value-Array haben`;
  }
  if (!c.value.every((v: unknown) => typeof v === "string")) {
    return `${c.type}.value darf nur Strings enthalten`;
  }
  return null;
}
