/**
 * lib/club-directory/plan-fingerprint.ts
 *
 * CLUB-DIRECTORY-02C-EXEC — deterministic plan fingerprint.
 *
 * PURPOSE
 *   A human reviews a dry-run consolidation plan (see
 *   scripts/club-directory-02c-sfv-consolidation.ts#buildTenantPlan and
 *   GET /api/ops/club-directory-02c-sfv-consolidation?mode=dry-run) and pins
 *   it as the ONLY plan the temporary execute endpoint
 *   (app/api/ops/club-directory-02c-sfv-consolidation-execute/route.ts) is
 *   allowed to act on. Raw JSON equality is not a safe pinning mechanism —
 *   key ordering, array ordering, and incidental whitespace must not matter,
 *   and the comparison must be trivial to carry from a browser/PowerShell
 *   session into a POST body. A single SHA-256 hex digest over a normalized
 *   ("canonical") representation of the plan solves both problems.
 *
 * SCOPE
 *   Pure, side-effect-free, deterministic. No DB/network access. Shared by:
 *     - the read-only ops endpoint (adds `planFingerprint` to its dry-run
 *       response so an operator can pin exactly what they reviewed);
 *     - the temporary execute endpoint (recomputes the fingerprint from a
 *       freshly regenerated plan immediately before any mutation and
 *       refuses to proceed unless it matches the operator-supplied
 *       `expectedPlanFingerprint` exactly).
 *   Never imported by, and never imports from, any mutation-capable module
 *   (lib/club-directory/consolidation-service.ts,
 *   lib/integrations/sfv/sync/club-consolidation.ts) — this module cannot
 *   write anything.
 *
 * CANONICAL REPRESENTATION
 *   Per group (minimum required fields, per task spec):
 *     - providerClubId
 *     - canonicalClubId
 *     - clubsToArchive (sorted lexicographically — order must not matter)
 *     - teamsToMove
 *     - logoAdoptedFromClubId
 *   Groups themselves are sorted by providerClubId. The whole plan is bound
 *   to `tenantKey` so a fingerprint computed for one tenant can never be
 *   mistaken for, or replayed against, another tenant.
 */

import { createHash } from "node:crypto";

export type PlanFingerprintGroup = {
  providerClubId: number;
  canonicalClubId: string;
  clubsToArchive: readonly string[];
  teamsToMove: number;
  logoAdoptedFromClubId: string | null;
};

export type PlanFingerprintInput = {
  tenantKey: string;
  groups: readonly PlanFingerprintGroup[];
};

/** One group's canonical (order-independent, whitespace-independent) shape. */
export type CanonicalPlanGroup = {
  providerClubId: number;
  canonicalClubId: string;
  clubsToArchive: string[];
  teamsToMove: number;
  logoAdoptedFromClubId: string | null;
};

export type CanonicalPlanRepresentation = {
  tenantKey: string;
  groups: CanonicalPlanGroup[];
};

function canonicalizeGroup(group: PlanFingerprintGroup): CanonicalPlanGroup {
  return {
    providerClubId: group.providerClubId,
    canonicalClubId: group.canonicalClubId,
    clubsToArchive: [...group.clubsToArchive].sort(),
    teamsToMove: group.teamsToMove,
    logoAdoptedFromClubId: group.logoAdoptedFromClubId,
  };
}

/**
 * Builds the normalized, order-independent representation a fingerprint is
 * computed over. Exported so tests (and, if ever useful, an operator debug
 * tool) can inspect exactly what is being hashed without re-deriving it.
 */
export function buildCanonicalPlanRepresentation(
  input: PlanFingerprintInput,
): CanonicalPlanRepresentation {
  const groups = [...input.groups]
    .map(canonicalizeGroup)
    .sort((a, b) => a.providerClubId - b.providerClubId);

  return { tenantKey: input.tenantKey, groups };
}

/**
 * Computes a deterministic SHA-256 hex digest of `input`'s canonical
 * representation. Identical plan content always yields the identical
 * fingerprint regardless of group/array ordering; any change to a group's
 * providerClubId, canonicalClubId, clubsToArchive set, teamsToMove, or
 * logoAdoptedFromClubId — or to the set of groups itself, or to the tenant —
 * changes the fingerprint.
 */
export function computePlanFingerprint(input: PlanFingerprintInput): string {
  const canonical = buildCanonicalPlanRepresentation(input);
  return createHash("sha256").update(JSON.stringify(canonical)).digest("hex");
}
